// The booking engine (spec §4). All mutations run server-side with the
// service role; every state change writes an event.
import { config } from "@/config/app";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent, ActorType } from "./events";
import { hoursUntil, slotStart } from "./time";

export type Actor = { type: ActorType; id?: string | null };
export type AppointmentSource = "standing" | "self_serve" | "concierge";

export type BookingResult =
  | { ok: true; appointmentId: string; late?: boolean }
  | { ok: false; error: string };

const BOOKABLE_VISIT_STATUSES = ["scheduled", "under_threshold"];

export async function bookAppointment(opts: {
  memberId: string;
  slotId: string;
  source: AppointmentSource;
  actor: Actor;
  room?: string | null;
}): Promise<BookingResult> {
  const db = supabaseAdmin();

  const { data: member } = await db
    .from("members")
    .select("*")
    .eq("id", opts.memberId)
    .maybeSingle();
  if (!member) return { ok: false, error: "member_not_found" };
  // Past-due policy (T1-9): blocked from NEW bookings. Appointments she already
  // booked are left untouched (honored until their visit); paying restores her.
  if (member.status === "past_due") return { ok: false, error: "past_due" };
  if (member.status !== "active") return { ok: false, error: "membership_inactive" };

  const { data: slot } = await db
    .from("slots")
    .select("*, visit:visits(*)")
    .eq("id", opts.slotId)
    .maybeSingle();
  if (!slot || !slot.visit) return { ok: false, error: "slot_not_found" };
  if (slot.visit.house_id !== member.house_id) return { ok: false, error: "wrong_house" };
  if (!BOOKABLE_VISIT_STATUSES.includes(slot.visit.status)) {
    return { ok: false, error: "visit_unavailable" };
  }
  if (slotStart(slot.visit.date, slot.start_time) < new Date()) {
    return { ok: false, error: "slot_in_past" };
  }

  // Atomic claim: only flips if the slot is still open.
  const { data: claimed } = await db
    .from("slots")
    .update({ status: "booked" })
    .eq("id", opts.slotId)
    .eq("status", "open")
    .select();
  if (!claimed || claimed.length === 0) return { ok: false, error: "slot_taken" };

  const { data: appt, error } = await db
    .from("appointments")
    .insert({
      slot_id: opts.slotId,
      member_id: opts.memberId,
      status: "booked",
      source: opts.source,
      room: opts.room ?? null,
    })
    .select()
    .single();
  if (error || !appt) {
    await db.from("slots").update({ status: "open" }).eq("id", opts.slotId);
    return { ok: false, error: "booking_failed" };
  }

  await logEvent({
    type: "appointment.booked",
    actor_type: opts.actor.type,
    actor_id: opts.actor.id ?? null,
    house_id: member.house_id,
    member_id: member.id,
    appointment_id: appt.id,
    payload: { source: opts.source, date: slot.visit.date, start_time: slot.start_time },
  });

  return { ok: true, appointmentId: appt.id };
}

// Cancellation policy: free until the window; after it the appointment is
// recorded as cancelled_late. MVP imposes no fee — the data informs future
// policy. Skipping a standing appointment never disables the standing flag.
export async function cancelAppointment(opts: {
  appointmentId: string;
  actor: Actor;
  reason?: string;
}): Promise<BookingResult> {
  const db = supabaseAdmin();

  const { data: appt } = await db
    .from("appointments")
    .select("*, slot:slots(*, visit:visits(*))")
    .eq("id", opts.appointmentId)
    .maybeSingle();
  if (!appt || !appt.slot?.visit) return { ok: false, error: "appointment_not_found" };
  if (appt.status !== "booked") return { ok: false, error: "not_booked" };

  const start = slotStart(appt.slot.visit.date, appt.slot.start_time);
  if (start < new Date()) return { ok: false, error: "already_started" };

  const late = hoursUntil(start) < config.cancellationWindowHours;
  await db
    .from("appointments")
    .update({ status: late ? "cancelled_late" : "cancelled" })
    .eq("id", appt.id);
  await db.from("slots").update({ status: "open" }).eq("id", appt.slot_id);

  await logEvent({
    type: late ? "appointment.cancelled_late" : "appointment.cancelled",
    actor_type: opts.actor.type,
    actor_id: opts.actor.id ?? null,
    house_id: appt.slot.visit.house_id,
    member_id: appt.member_id,
    appointment_id: appt.id,
    payload: { reason: opts.reason ?? null, source: appt.source },
  });

  return { ok: true, appointmentId: appt.id, late };
}

export async function rescheduleAppointment(opts: {
  appointmentId: string;
  newSlotId: string;
  actor: Actor;
}): Promise<BookingResult> {
  const db = supabaseAdmin();

  const { data: appt } = await db
    .from("appointments")
    .select("*, slot:slots(*, visit:visits(*)), member:members(*)")
    .eq("id", opts.appointmentId)
    .maybeSingle();
  if (!appt || !appt.slot?.visit || !appt.member) {
    return { ok: false, error: "appointment_not_found" };
  }
  if (appt.status !== "booked") return { ok: false, error: "not_booked" };

  const { data: newSlot } = await db
    .from("slots")
    .select("*, visit:visits(*)")
    .eq("id", opts.newSlotId)
    .maybeSingle();
  if (!newSlot || !newSlot.visit) return { ok: false, error: "slot_not_found" };
  if (newSlot.visit.house_id !== appt.member.house_id) {
    return { ok: false, error: "wrong_house" };
  }
  if (!BOOKABLE_VISIT_STATUSES.includes(newSlot.visit.status)) {
    return { ok: false, error: "visit_unavailable" };
  }
  if (slotStart(newSlot.visit.date, newSlot.start_time) < new Date()) {
    return { ok: false, error: "slot_in_past" };
  }

  // Claim the new slot before releasing the old one, so a failure can't
  // leave the member with nothing.
  const { data: claimed } = await db
    .from("slots")
    .update({ status: "booked" })
    .eq("id", opts.newSlotId)
    .eq("status", "open")
    .select();
  if (!claimed || claimed.length === 0) return { ok: false, error: "slot_taken" };

  const oldStart = slotStart(appt.slot.visit.date, appt.slot.start_time);
  const late = hoursUntil(oldStart) < config.cancellationWindowHours;

  await db
    .from("appointments")
    .update({ status: late ? "cancelled_late" : "cancelled" })
    .eq("id", appt.id);
  await db.from("slots").update({ status: "open" }).eq("id", appt.slot_id);

  const { data: next, error } = await db
    .from("appointments")
    .insert({
      slot_id: opts.newSlotId,
      member_id: appt.member_id,
      status: "booked",
      source: appt.source, // keep the origin: a moved standing appt is still standing
      room: appt.room,
    })
    .select()
    .single();
  if (error || !next) {
    await db.from("slots").update({ status: "open" }).eq("id", opts.newSlotId);
    return { ok: false, error: "booking_failed" };
  }

  await logEvent({
    type: "appointment.rescheduled",
    actor_type: opts.actor.type,
    actor_id: opts.actor.id ?? null,
    house_id: newSlot.visit.house_id,
    member_id: appt.member_id,
    appointment_id: next.id,
    payload: {
      from_appointment_id: appt.id,
      late,
      from: { date: appt.slot.visit.date, start_time: appt.slot.start_time },
      to: { date: newSlot.visit.date, start_time: newSlot.start_time },
    },
  });

  return { ok: true, appointmentId: next.id, late };
}

// Membership ended/paused → release all FUTURE booked appointments so they
// don't appear as phantom bookings on tech run sheets (T0-4 [B1]). These are
// system-initiated, not member-initiated, so they are NOT marked
// `cancelled_late` (no fee) regardless of the cancellation window. Returns the
// number of appointments released.
export async function cancelFutureAppointmentsForMember(opts: {
  memberId: string;
  actor: Actor;
  reason: string;
}): Promise<number> {
  const db = supabaseAdmin();
  const { data: appts } = await db
    .from("appointments")
    .select("*, slot:slots(*, visit:visits(*))")
    .eq("member_id", opts.memberId)
    .eq("status", "booked");

  let count = 0;
  for (const appt of appts ?? []) {
    if (!appt.slot?.visit) continue;
    if (slotStart(appt.slot.visit.date, appt.slot.start_time) <= new Date()) continue; // future only
    await db.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);
    await db.from("slots").update({ status: "open" }).eq("id", appt.slot_id);
    await logEvent({
      type: "appointment.cancelled",
      actor_type: opts.actor.type,
      actor_id: opts.actor.id ?? null,
      house_id: appt.slot.visit.house_id,
      member_id: opts.memberId,
      appointment_id: appt.id,
      payload: { reason: opts.reason, source: appt.source },
    });
    count++;
  }
  return count;
}
