"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { config } from "@/config/app";
import { rateLimit } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";
import { normalizePhone } from "@/lib/phone";
import { memberToken } from "@/lib/links";
import { copy } from "@/config/copy";
import { TablesInsert } from "@/lib/supabase/types";
import type { Cadence } from "@/lib/pricing";

export async function startSignup(formData: FormData) {
  // House is resolved from the opaque per-house signup token (T2-4) — never a
  // public house id, so no endpoint enumerates all houses.
  const houseToken = String(formData.get("house_token") ?? "");
  const refCode = String(formData.get("ref") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const cadence: Cadence = formData.get("cadence") === "semester" ? "semester" : "monthly";
  // E-signature waiver + SMS consent (R2-5) — all required to complete signup.
  const waiverAccepted = formData.get("waiver") === "on";
  const smsConsent = formData.get("sms_consent") === "on";
  const signature = String(formData.get("signature") ?? "").trim();
  if (houseToken) {
    if (!waiverAccepted) redirect(`/join/${houseToken}?error=waiver`);
    if (!signature) redirect(`/join/${houseToken}?error=signature`);
    if (!smsConsent) redirect(`/join/${houseToken}?error=sms_consent`);
  }
  if (!houseToken || !firstName || !lastName || !email || !phone) {
    redirect("/signup?error=invalid");
  }

  // Throttle signup per IP — each attempt can mint a Stripe customer.
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const userAgent = hdrs.get("user-agent") ?? "unknown";
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

  // Referral attribution (T2-8): a liaison's ref code attributes this signup to
  // her. Must be a liaison in the SAME house. No reward logic — plumbing only.
  let referredBy: string | null = null;
  if (refCode) {
    const { data: liaison } = await db
      .from("members")
      .select("id")
      .eq("referral_code", refCode)
      .eq("is_liaison", true)
      .eq("house_id", houseId)
      .maybeSingle();
    referredBy = liaison?.id ?? null;
  }

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

  const fields: TablesInsert<"members"> = { house_id: houseId, first_name: firstName, last_name: lastName, email, phone };
  // Only set attribution on a genuinely new member, and never let someone
  // attribute themselves.
  if (referredBy && !existing) fields.referred_by_member_id = referredBy;
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

  // Deferred billing (C-1b): save the card now, charge at house launch.
  // We use mode:"setup" (SetupIntent) — no subscription is created here.
  // The founder triggers the real subscription per house via the launch action.
  // The cadence preference is stored in metadata so the launch script can
  // create the right interval subscription later.
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    currency: "usd",
    success_url: `${config.appBaseUrl}/signup/preferences?t=${memberToken(memberId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appBaseUrl}/join/${houseToken}?error=cancelled`,
    metadata: { member_id: memberId, cadence, house_id: houseId },
    setup_intent_data: { metadata: { member_id: memberId, cadence, house_id: houseId } },
  });

  await logEvent({
    type: "member.signup_started",
    actor_type: "member",
    actor_id: memberId,
    member_id: memberId,
    house_id: houseId,
    payload: { cadence },
  });
  // Immutable, tamper-evident consent records (append-only events log, R2-5).
  const signedAt = new Date().toISOString();
  await logEvent({
    type: "consent.waiver_signed",
    actor_type: "member",
    actor_id: memberId,
    member_id: memberId,
    house_id: houseId,
    payload: {
      waiver_version: copy.marketing.waiverVersion,
      signature,
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
    },
  });
  await logEvent({
    type: "consent.sms_opt_in",
    actor_type: "member",
    actor_id: memberId,
    member_id: memberId,
    house_id: houseId,
    payload: { opted_in: true, signed_at: signedAt, ip, user_agent: userAgent },
  });

  if (!session.url) backToForm("stripe");
  redirect(session.url!);
}
