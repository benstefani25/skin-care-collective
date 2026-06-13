"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendSms } from "@/lib/twilio";
import { minutesToTime, timeToMinutes } from "@/lib/time";

export async function createVisitAction(formData: FormData) {
  await requireFounder();
  const houseId = String(formData.get("house_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const techId = String(formData.get("tech_id") ?? "") || null;
  if (!houseId || !date) redirect("/founder/visits?error=1");

  const db = supabaseAdmin();
  const { data: house } = await db.from("houses").select("*").eq("id", houseId).maybeSingle();
  if (!house) redirect("/founder/visits?error=1");

  const { data: existing } = await db
    .from("visits")
    .select("id")
    .eq("house_id", houseId)
    .eq("date", date)
    .maybeSingle();
  if (existing) redirect("/founder/visits?error=1");

  const { data: visit, error } = await db
    .from("visits")
    .insert({
      house_id: houseId,
      tech_id: techId,
      date,
      window_start: house.visit_window_start,
      window_end: house.visit_window_end,
      status: "scheduled",
    })
    .select()
    .single();
  if (error || !visit) redirect("/founder/visits?error=1");

  const start = timeToMinutes(house.visit_window_start);
  const end = timeToMinutes(house.visit_window_end);
  const dur = house.slot_duration_minutes || config.defaultSlotDurationMinutes;
  const rows = [];
  for (let t = start; t + dur <= end; t += dur) {
    rows.push({ visit_id: visit.id, start_time: minutesToTime(t), duration_minutes: dur, status: "open" });
  }
  await db.from("slots").insert(rows);
  await logEvent({ type: "visit.scheduled", actor_type: "founder", house_id: houseId, tech_id: techId, payload: { visit_id: visit.id, date, manual: true } });
  redirect("/founder/visits?ok=1");
}

export async function reassignVisitAction(formData: FormData) {
  await requireFounder();
  const visitId = String(formData.get("visit_id") ?? "");
  const techId = String(formData.get("tech_id") ?? "") || null;
  if (!visitId) redirect("/founder/visits?error=1");

  const db = supabaseAdmin();
  await db.from("visits").update({ tech_id: techId }).eq("id", visitId);
  await logEvent({ type: "visit.reassigned", actor_type: "founder", tech_id: techId, payload: { visit_id: visitId } });
  redirect("/founder/visits?ok=1");
}

// Cancelling a visit frees its slots and notifies booked members with a
// rebook link (spec §4 — founder decides; concierge-style notification).
export async function cancelVisitAction(formData: FormData) {
  await requireFounder();
  const visitId = String(formData.get("visit_id") ?? "");
  if (!visitId) redirect("/founder/visits?error=1");

  const db = supabaseAdmin();
  const { data: visit } = await db.from("visits").select("house_id").eq("id", visitId).maybeSingle();

  const { data: appts } = await db
    .from("appointments")
    .select("id, member:members(phone)")
    .eq("status", "booked")
    .in("slot_id", (
      (await db.from("slots").select("id").eq("visit_id", visitId)).data ?? []
    ).map((s: any) => s.id));

  for (const a of appts ?? []) {
    await db.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
    const phone = (a.member as any)?.phone;
    if (phone) await sendSms(phone, copy.smsMissedYou(`${config.appBaseUrl}/book`));
  }

  await db.from("slots").update({ status: "blocked" }).eq("visit_id", visitId);
  await db.from("visits").update({ status: "cancelled" }).eq("id", visitId);
  await logEvent({
    type: "visit.cancelled",
    actor_type: "founder",
    house_id: visit?.house_id ?? null,
    payload: { visit_id: visitId, notified: (appts ?? []).length },
  });
  redirect("/founder/visits?ok=1");
}
