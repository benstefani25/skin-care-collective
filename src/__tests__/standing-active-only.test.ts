// T0-5 [B2] — Regression lock: standing-appointment generation must auto-book
// ONLY active members. A paused or cancelled member with standing_appointment
// = true must NOT be placed. (The filter already exists; this prevents a
// future edit from silently dropping it.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";
import { placeStandingAppointments } from "@/lib/slots";

const TAG = `standing_${rand()}`;
let db: SupabaseClient;
const ids: { houseId?: string; visitId?: string; slotIds: string[]; memberIds: string[] } = {
  slotIds: [],
  memberIds: [],
};

beforeAll(async () => {
  db = admin();
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_cadence: "biweekly", visit_window_start: "17:00", visit_window_end: "21:00", status: "active" })
    .select()
    .single();
  ids.houseId = house!.id;

  // One member of each status, all opted into standing. Unique E.164 phones.
  const base = 1000000 + Math.floor(Math.random() * 8000000); // 7 digits
  const statuses = [["Annie", "active"], ["Paula", "paused"], ["Cara", "cancelled"]] as const;
  for (let i = 0; i < statuses.length; i++) {
    const [first, status] = statuses[i];
    const { data: m } = await db
      .from("members")
      .insert({ house_id: ids.houseId, first_name: first, last_name: status[0].toUpperCase() + status.slice(1), phone: `+1555${base + i}`, email: `${first}-${TAG}@example.com`, status, standing_appointment: true })
      .select()
      .single();
    ids.memberIds.push(m!.id);
  }

  const { data: visit } = await db
    .from("visits")
    .insert({ house_id: ids.houseId, date: "2026-09-01", window_start: "17:00", window_end: "21:00", status: "scheduled" })
    .select()
    .single();
  ids.visitId = visit!.id;
  for (const t of ["17:00", "17:20", "17:40"]) {
    const { data: s } = await db.from("slots").insert({ visit_id: visit!.id, start_time: t, duration_minutes: 20, status: "open" }).select().single();
    ids.slotIds.push(s!.id);
  }
});

afterAll(async () => {
  await db.from("appointments").delete().in("slot_id", ids.slotIds);
  for (const id of ids.slotIds) await db.from("slots").delete().eq("id", id);
  if (ids.visitId) await db.from("visits").delete().eq("id", ids.visitId);
  for (const id of ids.memberIds) {
    await db.from("events").delete().eq("member_id", id);
    await db.from("members").delete().eq("id", id);
  }
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("standing placement", () => {
  it("books only the active member; paused and cancelled are skipped", async () => {
    const placed = await placeStandingAppointments(
      db,
      { id: ids.houseId!, visit_window_start: "17:00", visit_window_end: "21:00" },
      { id: ids.visitId!, date: "2026-09-01" },
      ids.slotIds.map((id, i) => ({ id, start_time: ["17:00", "17:20", "17:40"][i] }))
    );
    expect(placed).toBe(1);

    const { data: appts } = await db
      .from("appointments")
      .select("member_id, source")
      .in("slot_id", ids.slotIds);
    expect(appts).toHaveLength(1);
    expect(appts![0].member_id).toBe(ids.memberIds[0]); // the active member
    expect(appts![0].source).toBe("standing");
  });
});
