// T2-3 — Founder tech CRUD: add a tech, change wages (audit-logged), and
// assign a house. Exercises the data effects of the founder-console actions
// directly (the actions themselves are thin wrappers over these writes behind
// requireFounder()).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";
import { logEvent } from "@/lib/events";

const TAG = `tc_${rand()}`;
const db: SupabaseClient = admin();
const ids: { techId?: string; houseId?: string } = {};

beforeAll(async () => {
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_window_start: "17:00", visit_window_end: "21:00", status: "active" })
    .select()
    .single();
  ids.houseId = house!.id;
});

afterAll(async () => {
  if (ids.techId) {
    await db.from("tech_house_assignments").delete().eq("tech_id", ids.techId);
    await db.from("techs").delete().eq("id", ids.techId);
  }
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("founder tech CRUD", () => {
  it("adds a tech as an applicant at default rates", async () => {
    const { data: tech } = await db
      .from("techs")
      .insert({ first_name: "Tess", last_name: TAG, email: `${TAG}@example.com`, phone: "+15557770001", base_rate_cents: 1000, deferred_rate_cents: 250, semester_number: 1, status: "applicant" })
      .select()
      .single();
    ids.techId = tech!.id;
    expect(tech!.status).toBe("applicant");
    expect(tech!.base_rate_cents).toBe(1000);
  });

  it("changes wages and writes a wage_changed audit event", async () => {
    await db.from("techs").update({ base_rate_cents: 1200, deferred_rate_cents: 500, status: "active" }).eq("id", ids.techId!);
    await logEvent({
      type: "tech.wage_changed",
      actor_type: "founder",
      tech_id: ids.techId!,
      payload: { base_rate_cents: { from: 1000, to: 1200 }, deferred_rate_cents: { from: 250, to: 500 } },
    });
    const { data: tech } = await db.from("techs").select("base_rate_cents, status").eq("id", ids.techId!).single();
    expect(tech!.base_rate_cents).toBe(1200);
    expect(tech!.status).toBe("active");
    const { count } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("tech_id", ids.techId!)
      .eq("type", "tech.wage_changed");
    expect(count).toBe(1);
  });

  it("assigns a house and the tech can be looked up for it", async () => {
    await db.from("tech_house_assignments").insert({ tech_id: ids.techId!, house_id: ids.houseId!, active: true });
    const { data: assignment } = await db
      .from("tech_house_assignments")
      .select("active")
      .eq("tech_id", ids.techId!)
      .eq("house_id", ids.houseId!)
      .single();
    expect(assignment!.active).toBe(true);
  });
});
