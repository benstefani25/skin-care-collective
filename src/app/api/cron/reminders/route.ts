// Hourly job: T-48h confirmations, T-3h prep reminders (spec §4), plus the
// under-threshold flag at T-48h (no auto-cancel — founder decides in M4).
// Sends are deduped against the events log, so the job is safely re-runnable.
import { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { cronAuthorized } from "@/lib/cron";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendSms } from "@/lib/twilio";
import { appointmentLink } from "@/lib/links";
import { fmtDate, fmtTime, hoursUntil, slotStart } from "@/lib/time";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const db = supabaseAdmin();

  const { data: appts } = await db
    .from("appointments")
    .select("*, member:members(*), slot:slots(*, visit:visits(*))")
    .eq("status", "booked");

  const live = (appts ?? [])
    .filter((a: any) => a.member && a.slot?.visit)
    .map((a: any) => ({ a, start: slotStart(a.slot.visit.date, a.slot.start_time) }));

  // Generous windows + event-log dedupe: a missed cron run self-heals on the
  // next tick instead of silently dropping reminders.
  const due48 = live.filter(({ start }) => {
    const h = hoursUntil(start);
    return h > config.cancellationWindowHours && h <= 48;
  });
  const due3 = live.filter(({ start }) => {
    const h = hoursUntil(start);
    return h > 0.5 && h <= 3;
  });

  const candidateIds = [...new Set([...due48, ...due3].map(({ a }) => a.id))];
  const alreadySent = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: prior } = await db
      .from("events")
      .select("type, appointment_id")
      .in("appointment_id", candidateIds)
      .in("type", ["reminder.sent_48h", "reminder.sent_3h"]);
    for (const e of prior ?? []) alreadySent.add(`${e.type}:${e.appointment_id}`);
  }

  let sent48 = 0;
  for (const { a, start } of due48) {
    if (alreadySent.has(`reminder.sent_48h:${a.id}`)) continue;
    const link = appointmentLink(a.id, start);
    await sendSms(
      a.member.phone,
      copy.smsReminder48(fmtDate(a.slot.visit.date), fmtTime(a.slot.start_time), link)
    );
    await logEvent({
      type: "reminder.sent_48h",
      actor_type: "system",
      member_id: a.member_id,
      house_id: a.slot.visit.house_id,
      appointment_id: a.id,
    });
    sent48++;
  }

  let sent3 = 0;
  for (const { a } of due3) {
    if (alreadySent.has(`reminder.sent_3h:${a.id}`)) continue;
    await sendSms(a.member.phone, copy.smsReminder3(fmtTime(a.slot.start_time)));
    await logEvent({
      type: "reminder.sent_3h",
      actor_type: "system",
      member_id: a.member_id,
      house_id: a.slot.visit.house_id,
      appointment_id: a.id,
    });
    sent3++;
  }

  const underThreshold = await flagUnderThresholdVisits(db);

  return Response.json({ sent48, sent3, underThreshold });
}

async function flagUnderThresholdVisits(db: SupabaseClient): Promise<number> {
  const { data: visits } = await db.from("visits").select("*").eq("status", "scheduled");
  let flagged = 0;
  for (const v of visits ?? []) {
    const h = hoursUntil(slotStart(v.date, v.window_start));
    if (h > 48 || h <= 0) continue;
    const { count } = await db
      .from("slots")
      .select("id", { count: "exact", head: true })
      .eq("visit_id", v.id)
      .eq("status", "booked");
    if ((count ?? 0) < config.visitMinimum) {
      await db.from("visits").update({ status: "under_threshold" }).eq("id", v.id);
      await logEvent({
        type: "visit.under_threshold",
        actor_type: "system",
        house_id: v.house_id,
        tech_id: v.tech_id,
        payload: { visit_id: v.id, date: v.date, booked: count ?? 0, minimum: config.visitMinimum },
      });
      flagged++;
    }
  }
  return flagged;
}
