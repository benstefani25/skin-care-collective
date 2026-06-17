// T2-5 — house_contacts is founder-only. A seeded contact is readable via the
// service role but INVISIBLE to an authenticated non-founder (member) session.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, clientForUser, createAuthUser, deleteAuthUser, rand } from "./helpers/db";

const TAG = `hc_${rand()}`;
const db: SupabaseClient = admin();
const pw = "Pw-" + rand() + rand();
const memberEmail = `${TAG}-mem@example.com`;
const ids: { houseId?: string; contactId?: string; memberAuth?: string } = {};
let memberClient: SupabaseClient;

beforeAll(async () => {
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_window_start: "17:00", visit_window_end: "21:00", status: "active" })
    .select("id")
    .single();
  ids.houseId = house!.id;
  const { data: contact } = await db
    .from("house_contacts")
    .insert({ house_id: ids.houseId, role: "House mom", name: "Pat Patterson", contact: "secret-housemom@x.com", notes: "prefers texts" })
    .select("id")
    .single();
  ids.contactId = contact!.id;

  ids.memberAuth = await createAuthUser(memberEmail, pw);
  await db.from("members").insert({ house_id: ids.houseId, first_name: "Mara", last_name: TAG, phone: "+15558880001", email: memberEmail, status: "active", auth_user_id: ids.memberAuth });
  memberClient = await clientForUser(memberEmail, pw);
});

afterAll(async () => {
  if (ids.contactId) await db.from("house_contacts").delete().eq("id", ids.contactId);
  await db.from("members").delete().eq("email", memberEmail);
  if (ids.memberAuth) await deleteAuthUser(ids.memberAuth);
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("house_contacts (founder-only)", () => {
  it("is readable via the service role", async () => {
    const { data } = await db.from("house_contacts").select("*").eq("id", ids.contactId!);
    expect(data).toHaveLength(1);
  });

  it("is invisible to an authenticated member, even seeded", async () => {
    const { data } = await memberClient.from("house_contacts").select("*");
    expect(data ?? []).toHaveLength(0);
    expect(JSON.stringify(data ?? [])).not.toContain("secret-housemom");
  });

  it("supports founder delete", async () => {
    await db.from("house_contacts").delete().eq("id", ids.contactId!);
    const { data } = await db.from("house_contacts").select("id").eq("id", ids.contactId!);
    expect(data ?? []).toHaveLength(0);
    ids.contactId = undefined;
  });
});
