"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";

// Create a house (T2-4). Starts in the 'prospect' pipeline stage; the DB
// auto-generates its opaque signup_token. Founder-gated + event-logged.
export async function createHouseAction(formData: FormData) {
  await requireFounder();
  const name = String(formData.get("name") ?? "").trim();
  const campus = String(formData.get("campus") ?? "").trim();
  const weekday = parseInt(String(formData.get("visit_weekday") ?? ""), 10);
  const windowStart = String(formData.get("visit_window_start") ?? "").trim();
  const windowEnd = String(formData.get("visit_window_end") ?? "").trim();
  if (!name || !campus || Number.isNaN(weekday) || !windowStart || !windowEnd) {
    redirect("/founder/houses?error=invalid");
  }

  const priceDollars = parseFloat(String(formData.get("monthly_price") ?? ""));
  const monthly = Number.isFinite(priceDollars) && priceDollars > 0
    ? Math.round(priceDollars * 100)
    : config.defaultMonthlyPriceCents;

  const { data: house, error } = await supabaseAdmin()
    .from("houses")
    .insert({
      name,
      campus,
      address: String(formData.get("address") ?? "").trim(),
      visit_weekday: weekday,
      visit_window_start: windowStart,
      visit_window_end: windowEnd,
      slot_duration_minutes: config.defaultSlotDurationMinutes,
      monthly_price_cents: monthly,
      status: "prospect",
    })
    .select("id")
    .single();
  if (error || !house) redirect("/founder/houses?error=invalid");

  await logEvent({ type: "house.created", actor_type: "founder", house_id: house.id, payload: { name, campus } });
  redirect(`/founder/houses/${house.id}?ok=1`);
}
