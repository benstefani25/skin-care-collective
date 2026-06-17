"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { normalizePhone } from "@/lib/phone";

function dollarsToCents(v: string, fallback: number): number {
  const n = Math.round(parseFloat(v) * 100);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Add a tech (T2-3). Wages default from config; all fields founder-set.
export async function addTechAction(formData: FormData) {
  await requireFounder();
  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!first || !last || !email || !phone) redirect("/founder/techs?error=invalid");

  const { data: tech, error } = await supabaseAdmin()
    .from("techs")
    .insert({
      first_name: first,
      last_name: last,
      email,
      phone,
      base_rate_cents: config.baseRateCents,
      deferred_rate_cents: config.deferredRateBaseCents,
      semester_number: 1,
      status: "applicant",
    })
    .select("id")
    .single();
  if (error || !tech) redirect("/founder/techs?error=invalid");

  await logEvent({ type: "tech.added", actor_type: "founder", tech_id: tech.id, payload: { email } });
  redirect("/founder/techs?ok=1");
}

// Edit a tech: status, semester, AND wages. Wage changes are founder-only and
// audit-logged with before/after (T2-3).
export async function saveTechAction(formData: FormData) {
  await requireFounder();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/founder/techs");

  const db = supabaseAdmin();
  const { data: before } = await db
    .from("techs")
    .select("status, semester_number, base_rate_cents, deferred_rate_cents")
    .eq("id", id)
    .maybeSingle();
  if (!before) redirect("/founder/techs?error=invalid");

  const status = String(formData.get("status") ?? "active");
  const semester = parseInt(String(formData.get("semester_number") ?? "1"), 10) || 1;
  const baseRate = dollarsToCents(String(formData.get("base_rate") ?? ""), before.base_rate_cents);
  const deferredRate = dollarsToCents(String(formData.get("deferred_rate") ?? ""), before.deferred_rate_cents);

  const update: Record<string, unknown> = {
    status,
    semester_number: semester,
    base_rate_cents: baseRate,
    deferred_rate_cents: deferredRate,
  };
  if (status === "offboarded" && before.status !== "offboarded") {
    update.offboarded_at = new Date().toISOString();
  }
  await db.from("techs").update(update).eq("id", id);

  await logEvent({ type: "tech.edited", actor_type: "founder", tech_id: id, payload: { status, semester } });
  // Separate, explicit audit row when pay changed.
  if (baseRate !== before.base_rate_cents || deferredRate !== before.deferred_rate_cents) {
    await logEvent({
      type: "tech.wage_changed",
      actor_type: "founder",
      tech_id: id,
      payload: {
        base_rate_cents: { from: before.base_rate_cents, to: baseRate },
        deferred_rate_cents: { from: before.deferred_rate_cents, to: deferredRate },
      },
    });
  }
  redirect("/founder/techs?ok=1");
}

// Toggle a house assignment for a tech (assign or deactivate).
export async function assignHouseAction(formData: FormData) {
  await requireFounder();
  const techId = String(formData.get("tech_id") ?? "");
  const houseId = String(formData.get("house_id") ?? "");
  if (!techId || !houseId) redirect("/founder/techs?error=invalid");

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("tech_house_assignments")
    .select("id, active")
    .eq("tech_id", techId)
    .eq("house_id", houseId)
    .maybeSingle();

  let active: boolean;
  if (existing) {
    active = !existing.active;
    await db.from("tech_house_assignments").update({ active }).eq("id", existing.id);
  } else {
    active = true;
    await db.from("tech_house_assignments").insert({ tech_id: techId, house_id: houseId, active: true });
  }
  await logEvent({
    type: "tech.assignment_changed",
    actor_type: "founder",
    tech_id: techId,
    house_id: houseId,
    payload: { active },
  });
  redirect("/founder/techs?ok=1");
}
