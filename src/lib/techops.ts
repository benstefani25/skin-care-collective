// Tech-side operations (spec §6). Every function verifies the appointment or
// visit belongs to THIS tech and is for TODAY before mutating — form fields
// are never trusted. Member contact info is fetched only for server-side SMS
// sends and never returned to callers.
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { sendSms } from "./twilio";
import { deferredRateForSemester } from "./payroll";
import { todayISO } from "./time";

export type TechResult = { ok: true } | { ok: false; error: string };

// Today's visit header data — explicit column list; house director columns
// and any member contact must never be selected here.
export async function todayVisitForTech(techId: string) {
  const { data } = await supabaseAdmin()
    .from("visits")
    .select("id, date, window_start, window_end, status, checked_in_at, checked_out_at, house:houses(name, address, access_notes)")
    .eq("tech_id", techId)
    .eq("date", todayISO())
    .in("status", ["scheduled", "under_threshold", "in_progress", "completed"])
    .maybeSingle();
  return data;
}

async function ownedTodayVisit(visitId: string, techId: string) {
  const { data } = await supabaseAdmin()
    .from("visits")
    .select("id, house_id, status, checked_in_at, checked_out_at")
    .eq("id", visitId)
    .eq("tech_id", techId)
    .eq("date", todayISO())
    .maybeSingle();
  return data;
}

export async function checkInVisit(visitId: string, techId: string): Promise<TechResult> {
  const db = supabaseAdmin();
  const visit = await ownedTodayVisit(visitId, techId);
  if (!visit) return { ok: false, error: "not_your_visit" };
  if (visit.checked_in_at) return { ok: false, error: "already_checked_in" };

  await db
    .from("visits")
    .update({ checked_in_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", visitId);
  await logEvent({
    type: "visit.checked_in",
    actor_type: "tech",
    actor_id: techId,
    tech_id: techId,
    house_id: visit.house_id,
    payload: { visit_id: visitId },
  });
  return { ok: true };
}

export async function checkOutVisit(visitId: string, techId: string): Promise<TechResult> {
  const db = supabaseAdmin();
  const visit = await ownedTodayVisit(visitId, techId);
  if (!visit) return { ok: false, error: "not_your_visit" };
  if (!visit.checked_in_at) return { ok: false, error: "not_checked_in" };
  if (visit.checked_out_at) return { ok: false, error: "already_checked_out" };

  await db
    .from("visits")
    .update({ checked_out_at: new Date().toISOString(), status: "completed" })
    .eq("id", visitId);
  await logEvent({
    type: "visit.checked_out",
    actor_type: "tech",
    actor_id: techId,
    tech_id: techId,
    house_id: visit.house_id,
    payload: { visit_id: visitId },
  });
  return { ok: true };
}

// Returns the appointment only if it sits on this tech's visit for today.
async function ownedTodayAppointment(appointmentId: string, techId: string) {
  const { data } = await supabaseAdmin()
    .from("appointments")
    .select("id, status, member_id, slot:slots!inner(visit:visits!inner(id, date, tech_id, house_id))")
    .eq("id", appointmentId)
    .eq("slot.visit.tech_id", techId)
    .eq("slot.visit.date", todayISO())
    .maybeSingle();
  return data as
    | { id: string; status: string; member_id: string; slot: { visit: { id: string; house_id: string } } }
    | null;
}

export async function checkInAppointment(appointmentId: string, techId: string): Promise<TechResult> {
  const db = supabaseAdmin();
  const appt = await ownedTodayAppointment(appointmentId, techId);
  if (!appt) return { ok: false, error: "not_your_appointment" };
  if (appt.status !== "booked") return { ok: false, error: "not_booked" };

  await db
    .from("appointments")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", appointmentId);
  await logEvent({
    type: "appointment.checked_in",
    actor_type: "tech",
    actor_id: techId,
    tech_id: techId,
    house_id: appt.slot.visit.house_id,
    member_id: appt.member_id,
    appointment_id: appointmentId,
  });
  return { ok: true };
}

// Completing a tan is the payroll trigger: base pay is counted from
// completed appointments, and the deferred accrual is written here —
// deterministic code, never AI (spec §10).
export async function completeAppointment(appointmentId: string, techId: string): Promise<TechResult> {
  const db = supabaseAdmin();
  const appt = await ownedTodayAppointment(appointmentId, techId);
  if (!appt) return { ok: false, error: "not_your_appointment" };

  // Atomic flip guards double-completion (and double-accrual).
  const { data: flipped } = await db
    .from("appointments")
    .update({ status: "completed", checked_out_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("status", "booked")
    .select();
  if (!flipped || flipped.length === 0) return { ok: false, error: "not_booked" };

  await logEvent({
    type: "appointment.completed",
    actor_type: "tech",
    actor_id: techId,
    tech_id: techId,
    house_id: appt.slot.visit.house_id,
    member_id: appt.member_id,
    appointment_id: appointmentId,
  });

  const { data: tech } = await db
    .from("techs")
    .select("semester_number")
    .eq("id", techId)
    .single();
  const amount = deferredRateForSemester(tech?.semester_number ?? 1);
  await db.from("bonus_ledger").insert({
    tech_id: techId,
    appointment_id: appointmentId,
    type: "deferred_accrual",
    amount_cents: amount,
    semester: config.currentSemester,
    note: null,
  });
  await logEvent({
    type: "bonus.accrued",
    actor_type: "system",
    tech_id: techId,
    appointment_id: appointmentId,
    payload: { amount_cents: amount, semester: config.currentSemester },
  });

  return { ok: true };
}

export async function noShowAppointment(appointmentId: string, techId: string): Promise<TechResult> {
  const db = supabaseAdmin();
  const appt = await ownedTodayAppointment(appointmentId, techId);
  if (!appt) return { ok: false, error: "not_your_appointment" };

  const { data: flipped } = await db
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", appointmentId)
    .eq("status", "booked")
    .select();
  if (!flipped || flipped.length === 0) return { ok: false, error: "not_booked" };

  await logEvent({
    type: "appointment.no_show",
    actor_type: "tech",
    actor_id: techId,
    tech_id: techId,
    house_id: appt.slot.visit.house_id,
    member_id: appt.member_id,
    appointment_id: appointmentId,
  });

  // Friendly "we missed you" + rebook link (spec §4). Phone is fetched and
  // used server-side only — it never reaches the tech surface.
  const { data: member } = await db
    .from("members")
    .select("phone")
    .eq("id", appt.member_id)
    .maybeSingle();
  if (member?.phone) {
    await sendSms(member.phone, copy.smsMissedYou(`${config.appBaseUrl}/book`));
  }

  return { ok: true };
}

// "Running late" broadcast (T1-8): text today's still-booked members that the
// tech is behind. Phones are fetched and used SERVER-SIDE only — the tech never
// sees a number (the wall holds). Returns how many were notified.
export async function broadcastRunningLate(
  techId: string,
  minutes: number
): Promise<TechResult & { sent?: number }> {
  const db = supabaseAdmin();
  const visit = await ownedTodayVisitByDate(techId);
  if (!visit) return { ok: false, error: "not_your_visit" };

  const { data: appts } = await db
    .from("appointments")
    .select("member:members(phone), slot:slots!inner(visit_id)")
    .eq("slot.visit_id", visit.id)
    .eq("status", "booked");

  let sent = 0;
  for (const a of (appts ?? []) as any[]) {
    const phone = a.member?.phone;
    if (phone) {
      await sendSms(phone, copy.smsRunningLate(minutes));
      sent++;
    }
  }

  await logEvent({
    type: "visit.running_late_broadcast",
    actor_type: "tech",
    actor_id: techId,
    tech_id: techId,
    house_id: visit.house_id,
    payload: { visit_id: visit.id, minutes, notified: sent },
  });
  return { ok: true, sent };
}

async function ownedTodayVisitByDate(techId: string) {
  const { data } = await supabaseAdmin()
    .from("visits")
    .select("id, house_id")
    .eq("tech_id", techId)
    .eq("date", todayISO())
    .in("status", ["scheduled", "under_threshold", "in_progress"])
    .maybeSingle();
  return data;
}
