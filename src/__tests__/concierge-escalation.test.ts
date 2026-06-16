// T0-6 [A4] — When the concierge escalates (e.g. a medical message), the
// member must receive the FIXED safe hand-off, never the model's free text.
// The model is stubbed to (a) call escalate, then (b) emit improvised advice;
// the test asserts the outbound SMS is the canned reply and that an escalation
// event + founder SMS fire.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { admin, rand } from "./helpers/db";

const TAG = `esc_${rand()}`;
const MEMBER_PHONE = `+1555${2000000 + Math.floor(Math.random() * 7000000)}`;
const FOUNDER_PHONE = "+15550000001";
const IMPROVISED = "You should apply hydrocortisone and it will be fine."; // model's unsafe text

// Stub the Anthropic SDK: round 1 → escalate tool_use; round 2 → improvised text.
vi.mock("@anthropic-ai/sdk", () => {
  let call = 0;
  class FakeAnthropic {
    messages = {
      create: async () => {
        call++;
        if (call === 1) {
          return {
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "toolu_1", name: "escalate", input: { reason: "member reports a skin rash after tan (medical)" } }],
          };
        }
        return { stop_reason: "end_turn", content: [{ type: "text", text: IMPROVISED }] };
      },
    };
  }
  return { default: FakeAnthropic };
});

// Capture outbound SMS instead of sending.
const sent: Array<{ to: string; body: string }> = [];
vi.mock("@/lib/twilio", () => ({
  sendSms: vi.fn(async (to: string, body: string) => {
    sent.push({ to, body });
  }),
}));

let db: SupabaseClient;
const ids: { houseId?: string; memberId?: string } = {};

beforeAll(async () => {
  process.env.FOUNDER_PHONE = FOUNDER_PHONE;
  db = admin();
  const { data: house } = await db
    .from("houses")
    .insert({ name: `${TAG} House`, campus: "Test U", address: "x", visit_weekday: 1, visit_cadence: "biweekly", visit_window_start: "17:00", visit_window_end: "21:00", status: "active" })
    .select()
    .single();
  ids.houseId = house!.id;
  const { data: member } = await db
    .from("members")
    .insert({ house_id: ids.houseId, first_name: "Mara", last_name: "Medical", phone: MEMBER_PHONE, email: `mara-${TAG}@example.com`, status: "active" })
    .select()
    .single();
  ids.memberId = member!.id;
});

afterAll(async () => {
  // events are append-only; deleting the member nulls their event refs (0006).
  if (ids.memberId) {
    await db.from("messages").delete().eq("member_id", ids.memberId);
    await db.from("members").delete().eq("id", ids.memberId);
  }
  if (ids.houseId) await db.from("houses").delete().eq("id", ids.houseId);
});

describe("concierge escalation reply", () => {
  it("sends the fixed safe hand-off, not the model's improvised advice", async () => {
    const { handleInboundSms } = await import("@/lib/concierge");
    const { copy } = await import("@/config/copy");

    const reply = await handleInboundSms(MEMBER_PHONE, "I'm breaking out in a rash after my tan");

    // The member-facing reply is the canned hand-off, never the model's text.
    expect(reply).toBe(copy.smsEscalationHandoff());
    expect(reply).not.toContain("hydrocortisone");

    const toMember = sent.find((s) => s.to === MEMBER_PHONE);
    expect(toMember?.body).toBe(copy.smsEscalationHandoff());
    expect(sent.some((s) => s.body === IMPROVISED)).toBe(false);

    // Founder is notified.
    expect(sent.some((s) => s.to === FOUNDER_PHONE && /escalation/i.test(s.body))).toBe(true);

    // An escalation event was logged.
    const { count } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("member_id", ids.memberId!)
      .eq("type", "message.escalated");
    expect(count).toBe(1);

    // The stored outbound message is also the safe reply, flagged escalated.
    const { data: outbound } = await db
      .from("messages")
      .select("body, escalated")
      .eq("member_id", ids.memberId!)
      .eq("direction", "outbound")
      .maybeSingle();
    expect(outbound?.body).toBe(copy.smsEscalationHandoff());
    expect(outbound?.escalated).toBe(true);
  });
});
