// Stripe webhooks (spec §9): signature-validated, then status sync + events.
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";
import { sendSms } from "@/lib/twilio";
import { billingLink } from "@/lib/links";
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
      if (memberId) {
        const update: Record<string, unknown> = { status: "active" };
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
      }
      break;
    }
  }

  return Response.json({ received: true });
}
