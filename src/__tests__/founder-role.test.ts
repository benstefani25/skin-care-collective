// T2-2 [A3] — Role-based founder access: a user with an active
// staff(role='founder') row is a founder; an unrelated authenticated user is
// not. (The env FOUNDER_EMAIL bootstrap is exercised separately by the live
// founder login.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createAuthUser, deleteAuthUser, rand } from "./helpers/db";
import { resolveFounder } from "@/lib/auth";

const TAG = `role_${rand()}`;
const FOUNDER_EMAIL = `${TAG}-founder@example.com`;
const OTHER_EMAIL = `${TAG}-nobody@example.com`;
const db = admin();
const ids: { founderAuth?: string; otherAuth?: string } = {};

beforeAll(async () => {
  // A staff founder row created by email (not yet linked to an auth user).
  await db.from("staff").insert({ email: FOUNDER_EMAIL, role: "founder", first_name: "Test", last_name: "Founder" });
  ids.founderAuth = await createAuthUser(FOUNDER_EMAIL, "Pw-" + rand() + rand());
  ids.otherAuth = await createAuthUser(OTHER_EMAIL, "Pw-" + rand() + rand());
});

afterAll(async () => {
  await db.from("staff").delete().eq("email", FOUNDER_EMAIL);
  if (ids.founderAuth) await deleteAuthUser(ids.founderAuth);
  if (ids.otherAuth) await deleteAuthUser(ids.otherAuth);
});

describe("resolveFounder", () => {
  it("recognizes a staff founder (and links the auth user on first resolve)", async () => {
    const ok = await resolveFounder({ id: ids.founderAuth!, email: FOUNDER_EMAIL });
    expect(ok).toBe(true);
    // now linked by auth_user_id
    const { data } = await db.from("staff").select("auth_user_id").eq("email", FOUNDER_EMAIL).single();
    expect(data!.auth_user_id).toBe(ids.founderAuth);
    // resolves again purely by auth_user_id
    expect(await resolveFounder({ id: ids.founderAuth!, email: FOUNDER_EMAIL })).toBe(true);
  });

  it("denies an unrelated authenticated user", async () => {
    expect(await resolveFounder({ id: ids.otherAuth!, email: OTHER_EMAIL })).toBe(false);
  });
});
