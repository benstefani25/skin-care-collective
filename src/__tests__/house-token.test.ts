// T2-4 — Tokenized per-house signup: a valid token resolves to exactly its
// house; an invalid token resolves to nothing. (The public /signup page renders
// no house list — verified by reading the source.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";

const TAG = `ht_${rand()}`;
const db: SupabaseClient = admin();
const ids: { aId?: string; bId?: string } = {};
let tokenA = "";

beforeAll(async () => {
  const mk = (n: string) =>
    db.from("houses").insert({ name: `${TAG} ${n}`, campus: "Test U", address: "x", visit_weekday: 1, visit_window_start: "17:00", visit_window_end: "21:00", status: "active" }).select("id, signup_token").single();
  const a = await mk("A");
  const b = await mk("B");
  ids.aId = a.data!.id;
  ids.bId = b.data!.id;
  tokenA = a.data!.signup_token;
});

afterAll(async () => {
  if (ids.aId) await db.from("houses").delete().eq("id", ids.aId);
  if (ids.bId) await db.from("houses").delete().eq("id", ids.bId);
});

describe("house signup tokens", () => {
  it("auto-generates a unique token per house", async () => {
    const { data } = await db.from("houses").select("signup_token").in("id", [ids.aId!, ids.bId!]);
    const tokens = data!.map((h) => h.signup_token);
    expect(tokens[0]).toBeTruthy();
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it("resolves a valid token to exactly its house", async () => {
    const { data } = await db.from("houses").select("id, name").eq("signup_token", tokenA).maybeSingle();
    expect(data!.id).toBe(ids.aId);
  });

  it("resolves an invalid token to nothing", async () => {
    const { data } = await db.from("houses").select("id").eq("signup_token", "not-a-real-token").maybeSingle();
    expect(data).toBeNull();
  });

  it("public /signup page does not enumerate houses", () => {
    const src = readFileSync("src/app/signup/page.tsx", "utf8");
    expect(src).not.toMatch(/from\(["']houses["']\)/);
    expect(src).not.toMatch(/\.select\(/);
  });
});
