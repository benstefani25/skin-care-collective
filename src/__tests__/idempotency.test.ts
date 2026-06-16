// T1-3 / T1-4 — Webhook idempotency: the first claim of a (provider, id)
// succeeds; every retry is rejected, so callers skip reprocessing. This is the
// guard that stops Twilio/Stripe retries from double-booking, double-messaging,
// or re-activating.
import { afterAll, describe, expect, it } from "vitest";
import { admin, rand } from "./helpers/db";
import { claimWebhook } from "@/lib/idempotency";

const SID = `SM_test_${rand()}`;
const EVT = `evt_test_${rand()}`;
const db = admin();

afterAll(async () => {
  await db.from("processed_webhooks").delete().in("external_id", [SID, EVT]);
});

describe("claimWebhook", () => {
  it("claims a new id once, rejects every retry", async () => {
    expect(await claimWebhook("twilio", SID)).toBe(true); // first delivery
    expect(await claimWebhook("twilio", SID)).toBe(false); // retry
    expect(await claimWebhook("twilio", SID)).toBe(false); // retry
  });

  it("namespaces by provider (same id, different provider is independent)", async () => {
    expect(await claimWebhook("stripe", EVT)).toBe(true);
    expect(await claimWebhook("stripe", EVT)).toBe(false);
  });

  it("treats an empty id as always-process (nothing to dedup on)", async () => {
    expect(await claimWebhook("twilio", "")).toBe(true);
    expect(await claimWebhook("twilio", "")).toBe(true);
  });
});
