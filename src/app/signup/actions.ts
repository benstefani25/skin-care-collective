"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";
import { normalizePhone } from "@/lib/phone";
import { memberToken } from "@/lib/links";
import { cadenceCheckout, Cadence } from "@/lib/pricing";

export async function startSignup(formData: FormData) {
  const houseId = String(formData.get("house_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const cadence: Cadence = formData.get("cadence") === "semester" ? "semester" : "monthly";
  if (!houseId || !firstName || !lastName || !email || !phone) {
    redirect("/signup?error=invalid");
  }

  const db = supabaseAdmin();
  const { data: house } = await db
    .from("houses")
    .select("*")
    .eq("id", houseId)
    .eq("status", "active")
    .maybeSingle();
  if (!house) redirect("/signup?error=invalid");

  // Re-signup after an abandoned checkout (or a cancelled membership) reuses
  // the existing row; an active/paused/past_due member is sent to login.
  const { data: existing } = await db
    .from("members")
    .select("id, status")
    .eq("phone", phone)
    .maybeSingle();
  if (existing && existing.status !== "pending" && existing.status !== "cancelled") {
    redirect("/signup?error=already_member");
  }

  const fields = { house_id: houseId, first_name: firstName, last_name: lastName, email, phone };
  let memberId: string;
  if (existing) {
    memberId = existing.id;
    await db.from("members").update({ ...fields, status: "pending" }).eq("id", memberId);
  } else {
    const { data: created, error } = await db
      .from("members")
      .insert({ ...fields, status: "pending" })
      .select("id")
      .single();
    if (error || !created) redirect("/signup?error=invalid");
    memberId = created!.id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: `${firstName} ${lastName}`,
    email,
    phone,
    metadata: { member_id: memberId },
  });
  await db.from("members").update({ stripe_customer_id: customer.id }).eq("id", memberId);

  // Cadence: monthly recurring, or a prepaid semester (a 4-month-interval
  // subscription, derived from the house's own monthly price). Both reuse the
  // existing subscription machinery — portal, pause, cancel, dunning all work.
  const billing = cadenceCheckout(cadence, house.monthly_price_cents);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: billing.unit_amount,
          recurring: { interval: billing.interval, interval_count: billing.interval_count },
          product_data: { name: `${config.brandName} membership — ${house.name} (${billing.label})` },
        },
      },
    ],
    success_url: `${config.appBaseUrl}/signup/preferences?t=${memberToken(memberId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appBaseUrl}/signup?error=cancelled`,
    metadata: { member_id: memberId },
    subscription_data: { metadata: { member_id: memberId, cadence } },
  });

  await logEvent({
    type: "member.signup_started",
    actor_type: "member",
    actor_id: memberId,
    member_id: memberId,
    house_id: houseId,
    payload: { cadence, amount_cents: billing.unit_amount },
  });

  redirect(session.url ?? "/signup?error=stripe");
}
