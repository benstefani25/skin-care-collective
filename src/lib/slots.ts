// Slot generation (spec §4): a scheduled job creates visits from each house's
// cadence N weeks ahead, generates slots across the visit window, then places
// standing appointments FIRST. General booking opens immediately after —
// staged/conditional release is explicitly out of scope (§14).
import { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { bookAppointment } from "./booking";
import { sendSms } from "./twilio";
import { appointmentLink } from "./links";
import {
  addDaysISO,
  fmtDate,
  fmtTime,
  minutesToTime,
  slotStart,
  timeToMinutes,
  todayISO,
} from "./time";

export type GenerationSummary = {
  house: string;
  date: string;
  slots: number;
  standingPlaced: number;
};

export async function generateVisitsAndSlots(
  weeksAhead = config.slotGenerationWeeksAhead
): Promise<GenerationSummary[]> {
  const db = supabaseAdmin();
  const summary: GenerationSummary[] = [];

  const { data: houses } = await db.from("houses").select("*").eq("status", "active");

  for (const house of houses ?? []) {
    const dates = await upcomingVisitDates(db, house, weeksAhead);
    for (const date of dates) {
      const { data: existing } = await db
        .from("visits")
        .select("id")
        .eq("house_id", house.id)
        .eq("date", date)
        .maybeSingle();
      if (existing) continue;

      const techId = await assignedTechId(db, house.id);
      const { data: visit, error: visitErr } = await db
        .from("visits")
        .insert({
          house_id: house.id,
          tech_id: techId,
          date,
          window_start: house.visit_window_start,
          window_end: house.visit_window_end,
          status: "scheduled",
        })
        .select()
        .single();
      if (visitErr || !visit) {
        console.error(`[slots] visit insert failed for ${house.name} ${date}:`, visitErr?.message);
        continue;
      }

      const slotRows = buildSlotRows(visit.id, house);
      const { data: slots, error: slotErr } = await db.from("slots").insert(slotRows).select();
      if (slotErr || !slots) {
        console.error(`[slots] slot insert failed for ${house.name} ${date}:`, slotErr?.message);
        continue;
      }

      await logEvent({
        type: "visit.scheduled",
        actor_type: "system",
        house_id: house.id,
        tech_id: techId,
        payload: { visit_id: visit.id, date, slots: slots.length },
      });
      if (!techId) {
        await logEvent({
          type: "visit.unassigned",
          actor_type: "system",
          house_id: house.id,
          payload: { visit_id: visit.id, date },
        });
      }

      const standingPlaced = await placeStandingAppointments(db, house, visit, slots);
      summary.push({ house: house.name, date, slots: slots.length, standingPlaced });
    }
  }

  return summary;
}

// Cadence dates: anchored to the latest existing visit when there is one,
// otherwise the next occurrence of the house's visit weekday.
async function upcomingVisitDates(
  db: SupabaseClient,
  house: { id: string; visit_weekday: number; visit_cadence: string },
  weeksAhead: number
): Promise<string[]> {
  const today = todayISO();
  const horizon = addDaysISO(today, weeksAhead * 7);
  const interval = house.visit_cadence === "weekly" ? 7 : 14;

  const { data: last } = await db
    .from("visits")
    .select("date")
    .eq("house_id", house.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let cursor: string;
  if (last) {
    cursor = addDaysISO(last.date, interval);
  } else {
    const now = new Date(`${today}T12:00:00`);
    const daysOut = (house.visit_weekday - now.getDay() + 7) % 7 || 7;
    cursor = addDaysISO(today, daysOut);
  }

  const dates: string[] = [];
  while (cursor <= horizon) {
    if (cursor > today) dates.push(cursor);
    cursor = addDaysISO(cursor, interval);
  }
  return dates;
}

async function assignedTechId(db: SupabaseClient, houseId: string): Promise<string | null> {
  const { data } = await db
    .from("tech_house_assignments")
    .select("tech_id, tech:techs!inner(status)")
    .eq("house_id", houseId)
    .eq("active", true);
  const active = (data ?? []).find((a: any) => a.tech?.status === "active");
  return active?.tech_id ?? null;
}

function buildSlotRows(
  visitId: string,
  house: { visit_window_start: string; visit_window_end: string; slot_duration_minutes: number }
) {
  const start = timeToMinutes(house.visit_window_start);
  const end = timeToMinutes(house.visit_window_end);
  const duration = house.slot_duration_minutes || config.defaultSlotDurationMinutes;

  const rows: Array<{ visit_id: string; start_time: string; duration_minutes: number; status: string }> = [];
  for (let t = start; t + duration <= end; t += duration) {
    rows.push({
      visit_id: visitId,
      start_time: minutesToTime(t),
      duration_minutes: duration,
      status: "open",
    });
  }
  return rows;
}

// Standing members are placed first, in their coarse window preference
// (early/mid/late third of the visit window), then confirmed by SMS with a
// one-tap reschedule/skip link. Skipping never disables the standing flag.
// Exported only so the regression test can lock the active-only filter (B2).
export async function placeStandingAppointments(
  db: SupabaseClient,
  house: { id: string; visit_window_start: string; visit_window_end: string },
  visit: { id: string; date: string },
  slots: Array<{ id: string; start_time: string }>
): Promise<number> {
  const { data: members } = await db
    .from("members")
    .select("*")
    .eq("house_id", house.id)
    .eq("status", "active")
    .eq("standing_appointment", true);
  if (!members || members.length === 0) return 0;

  const windowStart = timeToMinutes(house.visit_window_start);
  const span = timeToMinutes(house.visit_window_end) - windowStart;
  const thirdOf = (t: string) => {
    const min = timeToMinutes(t);
    if (min < windowStart + span / 3) return "early";
    if (min < windowStart + (2 * span) / 3) return "mid";
    return "late";
  };

  const ordered = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const taken = new Set<string>();
  let placed = 0;

  for (const member of members) {
    const pick =
      ordered.find(
        (s) =>
          !taken.has(s.id) &&
          (!member.standing_window || thirdOf(s.start_time) === member.standing_window)
      ) ?? ordered.find((s) => !taken.has(s.id));

    if (!pick) {
      await logEvent({
        type: "visit.standing_overflow",
        actor_type: "system",
        house_id: house.id,
        member_id: member.id,
        payload: { visit_id: visit.id, date: visit.date },
      });
      continue;
    }
    taken.add(pick.id);

    const result = await bookAppointment({
      memberId: member.id,
      slotId: pick.id,
      source: "standing",
      actor: { type: "system" },
    });
    if (!result.ok) {
      console.error(`[slots] standing placement failed for member ${member.id}: ${result.error}`);
      continue;
    }
    placed++;

    const link = appointmentLink(result.appointmentId, slotStart(visit.date, pick.start_time));
    await sendSms(
      member.phone,
      copy.smsStandingConfirm(member.first_name, fmtDate(visit.date), fmtTime(pick.start_time), link)
    );
    await logEvent({
      type: "sms.standing_confirmation",
      actor_type: "system",
      house_id: house.id,
      member_id: member.id,
      appointment_id: result.appointmentId,
      payload: { date: visit.date, start_time: pick.start_time },
    });
  }

  return placed;
}
