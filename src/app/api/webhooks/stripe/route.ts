// Stripe webhooks (spec §9): signature-validated, then status sync + events.
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";
import { sendSms } from "@/lib/twilio";
import { billingLink } from "@/lib/links";
import { cancelFutureAppointmentsForMember } from "@/lib/booking";
import { claimWebhook } from "@/lib/idempotency";
import { TablesUpdate } from "@/lib/supabase/types";
import { copy } from "@/config/copy";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency (T1-4): Stripe re-delivers events. Process each event.id once so
  // side effects (activation, dunning SMS) never duplicate on a retry.
  if (!(await claimWebhook("stripe", event.id))) {
    return Response.json({ received: true, duplicate: true });
  }

  const db = supabaseAdmin();

  async function memberByCustomer(customer: unknown) {
    const customerId =
      typeof customer === "string" ? customer : (customer as { id?: string } | null)?.id;
    if (!customerId) return null;
    const { data } = await db
      .from("members")
      .select("*")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.member_id;
      if (!memberId) break;

      if (session.mode === "setup") {
        // Deferred billing (C-1b): SetupIntent completed — card saved, no charge.
        // Retrieve the payment method from the SetupIntent and store it so the
        // launch action can create the subscription without another checkout.
        const setupIntentId = typeof session.setup_intent === "string"
          ? session.setup_intent
          : session.setup_intent?.id;
        let paymentMethodId: string | null = null;
        if (setupIntentId) {
          const si = await getStripe().setupIntents.retrieve(setupIntentId);
          paymentMethodId = typeof si.payment_method === "string"
            ? si.payment_method
            : si.payment_method?.id ?? null;
          // Set as the customer's default so the launch subscription charges it.
          if (paymentMethodId && typeof session.customer === "string") {
            await getStripe().customers.update(session.customer, {
              invoice_settings: { default_payment_method: paymentMethodId },
            });
          }
        }
        // Update status; then separately update payment method id if captured.
        // Two updates because the generated type doesn't include the new column
        // until types are regenerated post-migration.
        await db.from("members").update({ status: "card_on_file" }).eq("id", memberId);
        if (paymentMethodId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db.from("members") as any)
            .update({ stripe_payment_method_id: paymentMethodId })
            .eq("id", memberId);
        }
        await logEvent({
          type: "member.card_saved",
          actor_type: "system",
          member_id: memberId,
          payload: { checkout_session: session.id, setup_intent: setupIntentId },
        });
      } else if (session.mode === "subscription") {
        // Direct subscription checkout (used by the launch action redirect path,
        // or future non-deferred signups).
        const update: TablesUpdate<"members"> = { status: "active" };
        if (typeof session.customer === "string") update.stripe_customer_id = session.customer;
        if (typeof session.subscription === "string") {
          update.stripe_subscription_id = session.subscription;
        }
        await db.from("members").update(update).eq("id", memberId);
        await logEvent({
          type: "member.activated",
          actor_type: "system",
          member_id: memberId,
          payload: { checkout_session: session.id },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const member = await memberByCustomer(invoice.customer);
      if (member) {
        await db.from("members").update({ status: "past_due" }).eq("id", member.id);
        await logEvent({
          type: "payment.failed",
          actor_type: "system",
          member_id: member.id,
          house_id: member.house_id,
          payload: { invoice: invoice.id },
        });
        // Friendly nudge with a portal link (full concierge dunning lands in M3).
        await sendSms(member.phone, copy.smsPaymentFailed(billingLink(member.id)));
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const member = await memberByCustomer(invoice.customer);
      if (member && member.status === "past_due") {
        await db.from("members").update({ status: "active" }).eq("id", member.id);
        await logEvent({
          type: "member.reactivated",
          actor_type: "system",
          member_id: member.id,
          house_id: member.house_id,
          payload: { invoice: invoice.id },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const member = await memberByCustomer(sub.customer);
      if (member) {
        if (sub.pause_collection && member.status === "active") {
          await db.from("members").update({ status: "paused" }).eq("id", member.id);
          await logEvent({
            type: "member.paused",
            actor_type: "system",
            member_id: member.id,
            house_id: member.house_id,
          });
          // Pause semantics: a paused member isn't being charged, so she should
          // not hold future slots. Release them now; normal slot generation
          // re-books her standing appointment next cycle once she resumes.
          await cancelFutureAppointmentsForMember({
            memberId: member.id,
            actor: { type: "system" },
            reason: "membership_paused",
          });
        } else if (!sub.pause_collection && member.status === "paused") {
          await db.from("members").update({ status: "active" }).eq("id", member.id);
          await logEvent({
            type: "member.resumed",
            actor_type: "system",
            member_id: member.id,
            house_id: member.house_id,
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const member = await memberByCustomer(sub.customer);
      if (member) {
        await db.from("members").update({ status: "cancelled" }).eq("id", member.id);
        await logEvent({
          type: "member.cancelled",
          actor_type: "system",
          member_id: member.id,
          house_id: member.house_id,
        });
        // Release any future booked appointments so they don't linger as
        // phantom bookings on tech run sheets.
        await cancelFutureAppointmentsForMember({
          memberId: member.id,
          actor: { type: "system" },
          reason: "membership_ended",
        });
      }
      break;
    }
  }

  return Response.json({ received: true });
}
