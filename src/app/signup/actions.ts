"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { config } from "@/config/app";
import { rateLimit } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";
import { normalizePhone } from "@/lib/phone";
import { memberToken } from "@/lib/links";
import { cadenceCheckout, Cadence } from "@/lib/pricing";

export async function startSignup(formData: FormData) {
  // House is resolved from the opaque per-house signup token (T2-4) — never a
  // public house id, so no endpoint enumerates all houses.
  const houseToken = String(formData.get("house_token") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const cadence: Cadence = formData.get("cadence") === "semester" ? "semester" : "monthly";
  if (!houseToken || !firstName || !lastName || !email || !phone) {
    redirect("/signup?error=invalid");
  }

  // Throttle signup per IP — each attempt can mint a Stripe customer.
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!rateLimit(`signup:${ip}`, config.signupMaxPerWindow, config.signupWindowMs)) {
    redirect(`/join/${houseToken}?error=rate_limited`);
  }

  const db = supabaseAdmin();
  const { data: house } = await db
    .from("houses")
    .select("*")
    .eq("signup_token", houseToken)
    .eq("status", "active")
    .maybeSingle();
  if (!house) redirect("/signup?error=invalid");
  const houseId = house.id;
  const backToForm = (err: string) => redirect(`/join/${houseToken}?error=${err}`);

  // Re-signup after an abandoned checkout (or a cancelled membership) reuses
  // the existing row; an active/paused/past_due member is sent to login.
  const { data: existing } = await db
    .from("members")
    .select("id, status, stripe_customer_id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing && existing.status !== "pending" && existing.status !== "cancelled") {
    backToForm("already_member");
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
    if (error || !created) backToForm("invalid");
    memberId = created!.id;
  }

  const stripe = getStripe();
  // Reuse a Stripe customer if this pending/cancelled member already has one
  // (abandoned-then-retried signup) — don't orphan a fresh customer each try.
  let customerId = existing?.stripe_customer_id ?? null;
  if (customerId) {
    await stripe.customers.update(customerId, { name: `${firstName} ${lastName}`, email, phone });
  } else {
    const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email,
      phone,
      metadata: { member_id: memberId },
    });
    customerId = customer.id;
    await db.from("members").update({ stripe_customer_id: customerId }).eq("id", memberId);
  }

  // Cadence: monthly recurring, or a prepaid semester (a 4-month-interval
  // subscription, derived from the house's own monthly price). Both reuse the
  // existing subscription machinery — portal, pause, cancel, dunning all work.
  const billing = cadenceCheckout(cadence, house.monthly_price_cents);
  // Sales tax (T1-2): when enabled, let Stripe compute tax and collect the
  // address it needs. Gated so checkout never breaks before Stripe Tax is set
  // up in the dashboard. Processing fees are baked into the price, never
  // surcharged.
  const tax: Stripe.Checkout.SessionCreateParams = config.enableStripeTax
    ? {
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        customer_update: { address: "auto" },
      }
    : {};
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: billing.unit_amount,
          recurring: { interval: billing.interval, interval_count: billing.interval_count },
          ...(config.enableStripeTax ? { tax_behavior: "exclusive" as const } : {}),
          product_data: { name: `${config.brandName} membership — ${house.name} (${billing.label})` },
        },
      },
    ],
    success_url: `${config.appBaseUrl}/signup/preferences?t=${memberToken(memberId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appBaseUrl}/join/${houseToken}?error=cancelled`,
    metadata: { member_id: memberId },
    subscription_data: { metadata: { member_id: memberId, cadence } },
    ...tax,
  });

  await logEvent({
    type: "member.signup_started",
    actor_type: "member",
    actor_id: memberId,
    member_id: memberId,
    house_id: houseId,
    payload: { cadence, amount_cents: billing.unit_amount },
  });

  if (!session.url) backToForm("stripe");
  redirect(session.url!);
}
