// T2-8 — Liaison flag + referral attribution (no cash logic). A member can be
// a liaison with a referral code; a new member can be attributed to her;
// attribution is the only effect (no ledger/cash side effects).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";

const TAG = `li_${rand()}`;
const db: SupabaseClient = admin();
const ids: { houseId?: string; liaisonId?: string; recruitId?: string } = {};

beforeAll(async () => {
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_window_start: "17:00", visit_window_end: "21:00", status: "active" })
    .select("id")
    .single();
  ids.houseId = house!.id;
});

afterAll(async () => {
  if (ids.recruitId) await db.from("members").delete().eq("id", ids.recruitId);
  if (ids.liaisonId) await db.from("members").delete().eq("id", ids.liaisonId);
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("liaison referrals", () => {
  it("marks a member as a liaison with a referral code", async () => {
    const code = randomBytes(5).toString("hex");
    const { data: liaison } = await db
      .from("members")
      .insert({ house_id: ids.houseId, first_name: "Lia", last_name: TAG, phone: "+15559990001", email: `lia-${TAG}@example.com`, status: "active", is_liaison: true, referral_code: code })
      .select("id, is_liaison, referral_code")
      .single();
    ids.liaisonId = liaison!.id;
    expect(liaison!.is_liaison).toBe(true);
    expect(liaison!.referral_code).toBe(code);
  });

  it("attributes a new signup to the liaison", async () => {
    const { data: recruit } = await db
      .from("members")
      .insert({ house_id: ids.houseId, first_name: "Newbie", last_name: TAG, phone: "+15559990002", email: `new-${TAG}@example.com`, status: "pending", referred_by_member_id: ids.liaisonId })
      .select("id, referred_by_member_id")
      .single();
    ids.recruitId = recruit!.id;
    expect(recruit!.referred_by_member_id).toBe(ids.liaisonId);

    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_member_id", ids.liaisonId!);
    expect(count).toBe(1);
  });

  it("writes no money/ledger side effects for a referral", async () => {
    const { count } = await db
      .from("bonus_ledger")
      .select("id", { count: "exact", head: true })
      .eq("note", `referral:${ids.recruitId}`);
    expect(count ?? 0).toBe(0);
  });
});
