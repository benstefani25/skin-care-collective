// T0-3 [A2] — The tech wall: the single most important invariant in the
// business. A tech may see, for HER OWN visit TODAY only, a member's first
// name + last initial, room, and service notes — never phone, email, full last
// name, other days, other techs' visits, or members not on today's run sheet.
//
// This test authenticates AS A TECH (not the service role) and asserts the wall
// holds at the database layer. Break security_invoker or widen a policy and it
// must fail.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, clientForUser, createAuthUser, deleteAuthUser, rand } from "./helpers/db";

const TAG = `walltest_${rand()}`;
const PW = "Test-" + rand() + rand();

let db: SupabaseClient;
let techClient: SupabaseClient;
const ids: {
  houseId?: string;
  techId?: string;
  techAuthId?: string;
  otherTechId?: string;
  bookedMemberId?: string;
  unbookedMemberId?: string;
  visitId?: string;
  otherVisitId?: string;
  slotIds: string[];
  apptIds: string[];
} = { slotIds: [], apptIds: [] };

function todayLocal(tz = "America/Chicago"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

beforeAll(async () => {
  db = admin();

  const { data: house } = await db
    .from("houses")
    .insert({
      name: `${TAG} House`,
      campus: "Test U",
      address: "1 Test Way",
      access_notes: "side door",
      house_director_name: "Secret Director",
      house_director_contact: "director-secret@example.com",
      visit_weekday: new Date().getDay(),
      visit_cadence: "biweekly",
      visit_window_start: "17:00",
      visit_window_end: "21:00",
      timezone: "America/Chicago",
      status: "active",
    })
    .select()
    .single();
  ids.houseId = house!.id;

  const techEmail = `${TAG}-tech@example.com`;
  ids.techAuthId = await createAuthUser(techEmail, PW);
  const { data: tech } = await db
    .from("techs")
    .insert({
      first_name: "Tess",
      last_name: "Technician",
      phone: "+15550009999",
      email: techEmail,
      status: "active",
      auth_user_id: ids.techAuthId,
    })
    .select()
    .single();
  ids.techId = tech!.id;
  await db.from("tech_house_assignments").insert({ tech_id: ids.techId, house_id: ids.houseId, active: true });

  // A second, unrelated tech with her own visit today (for cross-tech isolation).
  const { data: otherTech } = await db
    .from("techs")
    .insert({ first_name: "Olive", last_name: "Other", phone: "+15550008888", email: `${TAG}-other@example.com`, status: "active" })
    .select()
    .single();
  ids.otherTechId = otherTech!.id;

  // Two members with full contact info.
  const { data: booked } = await db
    .from("members")
    .insert({ house_id: ids.houseId, first_name: "Bridget", last_name: "Booked", phone: "+15551110001", email: "bridget@example.com", service_notes: "sensitive skin", shade_preference: "medium", status: "active" })
    .select()
    .single();
  ids.bookedMemberId = booked!.id;
  const { data: unbooked } = await db
    .from("members")
    .insert({ house_id: ids.houseId, first_name: "Uma", last_name: "Unbooked", phone: "+15551110002", email: "uma@example.com", status: "active" })
    .select()
    .single();
  ids.unbookedMemberId = unbooked!.id;

  const today = todayLocal();

  // This tech's visit today, with one slot booked by Bridget.
  const { data: visit } = await db
    .from("visits")
    .insert({ house_id: ids.houseId, tech_id: ids.techId, date: today, window_start: "17:00", window_end: "21:00", status: "scheduled" })
    .select()
    .single();
  ids.visitId = visit!.id;
  const { data: slot } = await db
    .from("slots")
    .insert({ visit_id: ids.visitId, start_time: "17:00", duration_minutes: 20, status: "booked" })
    .select()
    .single();
  ids.slotIds.push(slot!.id);
  const { data: appt } = await db
    .from("appointments")
    .insert({ slot_id: slot!.id, member_id: ids.bookedMemberId, status: "booked", source: "self_serve", room: "101" })
    .select()
    .single();
  ids.apptIds.push(appt!.id);

  // The OTHER tech's visit today (different tech, same house) — tech must not see it.
  const { data: otherVisit } = await db
    .from("visits")
    .insert({ house_id: ids.houseId, tech_id: ids.otherTechId, date: today, window_start: "17:00", window_end: "21:00", status: "scheduled" })
    .select()
    .single();
  ids.otherVisitId = otherVisit!.id;

  techClient = await clientForUser(techEmail, PW);
});

afterAll(async () => {
  // Clean up in FK-safe order.
  for (const id of ids.apptIds) await db.from("appointments").delete().eq("id", id);
  if (ids.visitId) await db.from("slots").delete().eq("visit_id", ids.visitId);
  if (ids.visitId) await db.from("visits").delete().eq("id", ids.visitId);
  if (ids.otherVisitId) await db.from("visits").delete().eq("id", ids.otherVisitId);
  if (ids.bookedMemberId) await db.from("members").delete().eq("id", ids.bookedMemberId);
  if (ids.unbookedMemberId) await db.from("members").delete().eq("id", ids.unbookedMemberId);
  if (ids.techId) await db.from("tech_house_assignments").delete().eq("tech_id", ids.techId);
  if (ids.techId) await db.from("techs").delete().eq("id", ids.techId);
  if (ids.otherTechId) await db.from("techs").delete().eq("id", ids.otherTechId);
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
  if (ids.techAuthId) await deleteAuthUser(ids.techAuthId);
});

const CONTACT_KEYS = ["phone", "email", "last_name", "stripe_customer_id", "stripe_subscription_id"];

describe("tech wall", () => {
  it("run sheet shows exactly today's booked member, as First L., with no contact columns", async () => {
    const { data, error } = await techClient.from("tech_runsheet").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const row = data![0];
    expect(row.member_display_name).toBe("Bridget B.");
    expect(row.service_notes).toBe("sensitive skin");
    for (const k of CONTACT_KEYS) expect(row).not.toHaveProperty(k);
    // full last name must never appear anywhere in the row
    expect(JSON.stringify(row)).not.toContain("Booked");
  });

  it("direct members query as the tech exposes no contact columns and not the unbooked member", async () => {
    const { data } = await techClient.from("members").select("*");
    const rows = data ?? [];
    // unbooked member must not be reachable
    expect(rows.find((r: any) => r.id === ids.unbookedMemberId)).toBeUndefined();
    // any rows returned (at most today's booked member) carry zero contact columns
    for (const r of rows) {
      for (const k of CONTACT_KEYS) expect(r[k]).toBeUndefined();
      expect(JSON.stringify(r)).not.toContain("Booked"); // no full last name
      expect(JSON.stringify(r)).not.toContain("@example.com"); // no email
    }
  });

  it("cannot read house director contact via the houses table", async () => {
    const { data } = await techClient.from("houses").select("*");
    for (const r of data ?? []) {
      expect(r.house_director_contact).toBeUndefined();
      expect(r.house_director_name).toBeUndefined();
    }
    expect(JSON.stringify(data ?? [])).not.toContain("director-secret");
  });

  it("sees only her own today visit, not the other tech's", async () => {
    const { data: visits } = await techClient.from("visits").select("id");
    const visitIds = (visits ?? []).map((v: any) => v.id);
    expect(visitIds).toContain(ids.visitId);
    expect(visitIds).not.toContain(ids.otherVisitId);
  });

  it("sees only today's own-visit appointments", async () => {
    const { data: appts } = await techClient.from("appointments").select("id, slot_id");
    const apptIds = (appts ?? []).map((a: any) => a.id);
    expect(apptIds).toEqual(ids.apptIds);
  });
});
