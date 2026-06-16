// T0-4 [B1] — When a membership ends or pauses, future booked appointments are
// released (status cancelled, slot reopened, one event each) so they don't show
// up as phantom bookings on a tech's run sheet. They are NOT cancelled_late.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";
import { cancelFutureAppointmentsForMember } from "@/lib/booking";

const TAG = `cf_${rand()}`;
let db: SupabaseClient;
const ids: { houseId?: string; memberId?: string; visitId?: string; slotIds: string[]; apptIds: string[] } = {
  slotIds: [],
  apptIds: [],
};

function futureISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

beforeAll(async () => {
  db = admin();
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_cadence: "biweekly", visit_window_start: "17:00", visit_window_end: "21:00", status: "active" })
    .select()
    .single();
  ids.houseId = house!.id;
  const phone = `+1555${3000000 + Math.floor(Math.random() * 6000000)}`;
  const { data: member } = await db
    .from("members")
    .insert({ house_id: ids.houseId, first_name: "Faye", last_name: "Future", phone, email: `faye-${TAG}@example.com`, status: "active" })
    .select()
    .single();
  ids.memberId = member!.id;

  // Two FUTURE visits, one booked slot each.
  for (const days of [7, 21]) {
    const { data: visit } = await db
      .from("visits")
      .insert({ house_id: ids.houseId, date: futureISO(days), window_start: "17:00", window_end: "21:00", status: "scheduled" })
      .select()
      .single();
    ids.visitId = visit!.id;
    const { data: slot } = await db
      .from("slots")
      .insert({ visit_id: visit!.id, start_time: "17:00", duration_minutes: 20, status: "booked" })
      .select()
      .single();
    ids.slotIds.push(slot!.id);
    const { data: appt } = await db
      .from("appointments")
      .insert({ slot_id: slot!.id, member_id: ids.memberId, status: "booked", source: "standing" })
      .select()
      .single();
    ids.apptIds.push(appt!.id);
  }
});

afterAll(async () => {
  for (const id of ids.apptIds) await db.from("appointments").delete().eq("id", id);
  for (const id of ids.slotIds) {
    const { data: s } = await db.from("slots").select("visit_id").eq("id", id).maybeSingle();
    await db.from("slots").delete().eq("id", id);
    if (s) await db.from("visits").delete().eq("id", s.visit_id);
  }
  // events are append-only; deleting the member nulls their event refs (0006).
  if (ids.memberId) await db.from("members").delete().eq("id", ids.memberId);
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("cancelFutureAppointmentsForMember", () => {
  it("releases all future booked appointments, reopens slots, writes one event each", async () => {
    const count = await cancelFutureAppointmentsForMember({
      memberId: ids.memberId!,
      actor: { type: "system" },
      reason: "membership_ended",
    });
    expect(count).toBe(2);

    const { data: appts } = await db.from("appointments").select("status").in("id", ids.apptIds);
    expect(appts!.every((a) => a.status === "cancelled")).toBe(true);
    // not cancelled_late — this is system-initiated, no fee
    expect(appts!.some((a) => a.status === "cancelled_late")).toBe(false);

    const { data: slots } = await db.from("slots").select("status").in("id", ids.slotIds);
    expect(slots!.every((s) => s.status === "open")).toBe(true);

    const { count: eventCount } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("member_id", ids.memberId!)
      .eq("type", "appointment.cancelled");
    expect(eventCount).toBe(2);
  });
});
