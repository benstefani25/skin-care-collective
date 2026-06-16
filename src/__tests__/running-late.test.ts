// T1-8 — "Running late" broadcast: texts today's still-booked members, server-
// side (no numbers exposed to the tech), and logs an event. A no-show / not-yet-
// booked member is not in scope.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";
import { broadcastRunningLate } from "@/lib/techops";

const TAG = `late_${rand()}`;
let db: SupabaseClient;
const ids: { houseId?: string; techId?: string; memberId?: string; visitId?: string; slotIds: string[]; apptIds: string[] } = {
  slotIds: [],
  apptIds: [],
};

function todayLocal(tz = "America/Chicago"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

beforeAll(async () => {
  db = admin();
  const base = 4000000 + Math.floor(Math.random() * 5000000);
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_cadence: "biweekly", visit_window_start: "17:00", visit_window_end: "21:00", timezone: "America/Chicago", status: "active" })
    .select()
    .single();
  ids.houseId = house!.id;
  const { data: tech } = await db
    .from("techs")
    .insert({ first_name: "Lee", last_name: "Late", phone: `+1555${base}`, email: `${TAG}-tech@example.com`, status: "active" })
    .select()
    .single();
  ids.techId = tech!.id;
  const { data: member } = await db
    .from("members")
    .insert({ house_id: ids.houseId, first_name: "Bo", last_name: "Booked", phone: `+1555${base + 1}`, email: `${TAG}@example.com`, status: "active" })
    .select()
    .single();
  ids.memberId = member!.id;

  const { data: visit } = await db
    .from("visits")
    .insert({ house_id: ids.houseId, tech_id: ids.techId, date: todayLocal(), window_start: "17:00", window_end: "21:00", status: "in_progress" })
    .select()
    .single();
  ids.visitId = visit!.id;
  const { data: slot } = await db.from("slots").insert({ visit_id: visit!.id, start_time: "17:00", duration_minutes: 20, status: "booked" }).select().single();
  ids.slotIds.push(slot!.id);
  const { data: appt } = await db.from("appointments").insert({ slot_id: slot!.id, member_id: ids.memberId, status: "booked", source: "self_serve" }).select().single();
  ids.apptIds.push(appt!.id);
});

afterAll(async () => {
  for (const id of ids.apptIds) await db.from("appointments").delete().eq("id", id);
  for (const id of ids.slotIds) await db.from("slots").delete().eq("id", id);
  if (ids.visitId) await db.from("visits").delete().eq("id", ids.visitId);
  if (ids.memberId) await db.from("members").delete().eq("id", ids.memberId);
  if (ids.techId) await db.from("techs").delete().eq("id", ids.techId);
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("broadcastRunningLate", () => {
  it("notifies today's booked members and logs an event", async () => {
    const result = await broadcastRunningLate(ids.techId!, 15);
    expect(result.ok).toBe(true);
    expect(result.sent).toBe(1);

    const { count } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("tech_id", ids.techId!)
      .eq("type", "visit.running_late_broadcast");
    expect(count).toBe(1);
  });

  it("rejects a tech with no visit today", async () => {
    const { data: lonelyTech } = await db
      .from("techs")
      .insert({ first_name: "No", last_name: "Visit", phone: `+1555${5000000 + Math.floor(Math.random() * 4000000)}`, email: `${TAG}-nv@example.com`, status: "active" })
      .select()
      .single();
    const result = await broadcastRunningLate(lonelyTech!.id, 15);
    expect(result.ok).toBe(false);
    await db.from("techs").delete().eq("id", lonelyTech!.id);
  });
});
