// The member concierge (spec §11a): inbound SMS → Claude with tools → SMS
// reply. Every tool is bound server-side to the texting member — the model
// can never act on (or see) anyone else's data. All mutations go through the
// same booking lib the app uses, and everything writes events.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { CONCIERGE_PROMPT_VERSION, conciergeSystemPrompt } from "@/config/prompts";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { sendSms } from "./twilio";
import { billingLink } from "./links";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "./booking";
import { fmtDate, fmtTime, hoursUntil, slotStart, todayISO } from "./time";
import { normalizePhone } from "./phone";

const MAX_TOOL_ROUNDS = 6;

const SAFE_FALLBACK =
  "Sorry — I'm having trouble on my end right now. A real human will follow up with you shortly!";

function conciergeModel(): string {
  return process.env.CONCIERGE_MODEL ?? config.defaultModel;
}

// ── Tool definitions ────────────────────────────────────────────────────────
// Note: no member_id parameters anywhere. The member is bound by the phone
// number that texted us; the model cannot reach across accounts.
const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_open_slots",
    description:
      "Call this to get the member's house's upcoming visit days and currently open time slots, with the slot_id needed for booking. Call it before offering times if the context data looks stale or a booking attempt failed.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "book_appointment",
    description:
      "Book the member into an open slot. Call this when the member picks a time. Use the slot_id from get_open_slots or the context.",
    input_schema: {
      type: "object",
      properties: {
        slot_id: { type: "string", description: "The id of the open slot to book" },
        room: { type: "string", description: "The member's room number, if she gave one" },
      },
      required: ["slot_id"],
    },
  },
  {
    name: "reschedule_appointment",
    description:
      "Move one of the member's booked appointments to a different open slot. Call this when she wants a different time.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "Her existing appointment's id" },
        new_slot_id: { type: "string", description: "The id of the open slot to move to" },
      },
      required: ["appointment_id", "new_slot_id"],
    },
  },
  {
    name: "cancel_appointment",
    description:
      "Cancel one of the member's booked appointments (also used for skipping a standing appointment — skipping never disables auto-booking).",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "Her appointment's id" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "toggle_standing",
    description:
      "Turn the member's auto-booking (standing appointment) on or off. Only call when she clearly asks to stop being auto-booked, or to turn it back on — skipping a single visit is cancel_appointment, not this.",
    input_schema: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "true = auto-book her each visit" },
      },
      required: ["enabled"],
    },
  },
  {
    name: "send_portal_link",
    description:
      "Text the member a secure Stripe billing portal link where she can update her card, pause for the summer, or cancel her membership. Call this for any billing/card/pause/cancel-membership request.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "forward_to_tech",
    description:
      "Forward a short day-of coordination note (running late, room number, arrival details) to the technician working the member's booked appointment. Only for logistics about an existing appointment — never for complaints or medical issues (escalate those).",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The note to pass to the technician" },
      },
      required: ["message"],
    },
  },
  {
    name: "escalate",
    description:
      "Flag this conversation for the owner to handle personally. Call IMMEDIATELY for anything medical (reactions, allergies, injuries, pregnancy), for complaints, refund requests, exceptions you can't grant, or anything outside your tools. The owner is notified right away.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "One sentence on why this needs a human" },
      },
      required: ["reason"],
    },
  },
];

// ── Context assembly ────────────────────────────────────────────────────────

async function buildMemberContext(member: any): Promise<string> {
  const db = supabaseAdmin();

  const { data: appts } = await db
    .from("appointments")
    .select("id, status, room, slot:slots(start_time, visit:visits(date, status))")
    .eq("member_id", member.id)
    .eq("status", "booked");
  const upcoming = (appts ?? [])
    .filter((a: any) => a.slot?.visit && slotStart(a.slot.visit.date, a.slot.start_time) > new Date())
    .map((a: any) => {
      const late = hoursUntil(slotStart(a.slot.visit.date, a.slot.start_time)) < config.cancellationWindowHours;
      return `- appointment_id ${a.id}: ${fmtDate(a.slot.visit.date)} at ${fmtTime(a.slot.start_time)}${a.room ? `, room ${a.room}` : ""}${late ? " (inside the late-change window)" : ""}`;
    });

  const slotsText = await openSlotsText(member.house_id);

  return `## This member (the person texting you)
Name: ${member.first_name} ${member.last_name}
Membership status: ${member.status}
Shade preference: ${member.shade_preference ?? "not set"}
Auto-booking (standing): ${member.standing_appointment ? "ON" : "OFF"}${member.standing_window ? ` (prefers ${member.standing_window} window)` : ""}

## Her upcoming appointments
${upcoming.length ? upcoming.join("\n") : "(none booked)"}

## Upcoming visits at her house with open times
${slotsText}

Today's date: ${todayISO()}`;
}

async function openSlotsText(houseId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: visits } = await db
    .from("visits")
    .select("id, date, status, slots(id, start_time, status)")
    .eq("house_id", houseId)
    .gte("date", todayISO())
    .in("status", ["scheduled", "under_threshold"])
    .order("date");

  const lines: string[] = [];
  for (const v of visits ?? []) {
    const open = (v.slots ?? [])
      .filter((s: any) => s.status === "open" && slotStart(v.date, s.start_time) > new Date())
      .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
    if (open.length === 0) {
      lines.push(`- ${fmtDate(v.date)}: fully booked`);
    } else {
      lines.push(
        `- ${fmtDate(v.date)}: ${open.map((s: any) => `${fmtTime(s.start_time)} (slot_id ${s.id})`).join(", ")}`
      );
    }
  }
  return lines.length ? lines.join("\n") : "(no visits on the calendar yet)";
}

async function recentHistory(memberId: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabaseAdmin()
    .from("messages")
    .select("direction, body, handled_by")
    .eq("member_id", memberId)
    .neq("handled_by", "relay")
    .order("created_at", { ascending: false })
    .limit(10);
  const history = (data ?? []).reverse();
  return history.map((m: any) => ({
    role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
    content: m.body,
  }));
}

// ── Tool execution ──────────────────────────────────────────────────────────

type ToolOutcome = { result: string; isError?: boolean };

async function ensureOwnAppointment(memberId: string, appointmentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("appointments")
    .select("member_id")
    .eq("id", appointmentId)
    .maybeSingle();
  return data?.member_id === memberId;
}

async function executeTool(
  name: string,
  input: any,
  member: any,
  state: { escalated: boolean }
): Promise<ToolOutcome> {
  const db = supabaseAdmin();
  const actor = { type: "ai" as const, id: null };

  switch (name) {
    case "get_open_slots":
      return { result: await openSlotsText(member.house_id) };

    case "book_appointment": {
      const res = await bookAppointment({
        memberId: member.id,
        slotId: String(input.slot_id ?? ""),
        source: "concierge",
        actor,
        room: input.room ? String(input.room) : null,
      });
      return res.ok
        ? { result: `Booked. appointment_id ${res.appointmentId}.` }
        : { result: `Booking failed: ${res.error}`, isError: true };
    }

    case "reschedule_appointment": {
      const apptId = String(input.appointment_id ?? "");
      if (!(await ensureOwnAppointment(member.id, apptId))) {
        return { result: "That appointment does not belong to this member.", isError: true };
      }
      const res = await rescheduleAppointment({
        appointmentId: apptId,
        newSlotId: String(input.new_slot_id ?? ""),
        actor,
      });
      return res.ok
        ? { result: `Moved. New appointment_id ${res.appointmentId}.${res.late ? " The old time was inside the late window, recorded as a late change (no fee)." : ""}` }
        : { result: `Reschedule failed: ${res.error}`, isError: true };
    }

    case "cancel_appointment": {
      const apptId = String(input.appointment_id ?? "");
      if (!(await ensureOwnAppointment(member.id, apptId))) {
        return { result: "That appointment does not belong to this member.", isError: true };
      }
      const res = await cancelAppointment({ appointmentId: apptId, actor, reason: "concierge" });
      return res.ok
        ? { result: `Cancelled.${res.late ? " It was inside the late window, recorded as a late cancel (no fee)." : ""} Her standing/auto-booking is unaffected.` }
        : { result: `Cancel failed: ${res.error}`, isError: true };
    }

    case "toggle_standing": {
      const enabled = Boolean(input.enabled);
      await db.from("members").update({ standing_appointment: enabled }).eq("id", member.id);
      await logEvent({
        type: "member.standing_toggled",
        actor_type: "ai",
        member_id: member.id,
        house_id: member.house_id,
        payload: { standing: enabled, via: "concierge" },
      });
      return { result: `Auto-booking is now ${enabled ? "ON" : "OFF"}.` };
    }

    case "send_portal_link": {
      if (!member.stripe_customer_id) {
        return { result: "No billing account on file — escalate instead.", isError: true };
      }
      await sendSms(member.phone, `Here's your secure billing link — card, summer pause, or cancel, all in one place: ${billingLink(member.id)}`);
      await logEvent({
        type: "message.portal_link_sent",
        actor_type: "ai",
        member_id: member.id,
        house_id: member.house_id,
      });
      return { result: "Portal link texted to the member (as a separate text)." };
    }

    case "forward_to_tech": {
      const note = String(input.message ?? "").slice(0, 480);
      // Find the tech on her next booked appointment (today preferred).
      const { data: appts } = await db
        .from("appointments")
        .select("id, slot:slots(start_time, visit:visits(date, tech_id))")
        .eq("member_id", member.id)
        .eq("status", "booked");
      const next: any = ((appts ?? []) as any[])
        .filter((a) => a.slot?.visit?.tech_id && slotStart(a.slot.visit.date, a.slot.start_time) > new Date(Date.now() - 2 * 36e5))
        .sort((a, b) => `${a.slot.visit.date}T${a.slot.start_time}`.localeCompare(`${b.slot.visit.date}T${b.slot.start_time}`))[0];
      if (!next) {
        return { result: "No booked appointment with an assigned technician found — nothing to forward to.", isError: true };
      }
      await db.from("messages").insert({
        member_id: member.id,
        tech_id: next.slot.visit.tech_id,
        direction: "inbound",
        body: note,
        channel: "sms",
        handled_by: "relay",
      });
      await logEvent({
        type: "message.relayed_to_tech",
        actor_type: "ai",
        member_id: member.id,
        tech_id: next.slot.visit.tech_id,
        appointment_id: next.id,
      });
      return { result: "Note forwarded to her technician's app (first name only, no contact info shared)." };
    }

    case "escalate": {
      state.escalated = true;
      const reason = String(input.reason ?? "unspecified");
      await logEvent({
        type: "message.escalated",
        actor_type: "ai",
        member_id: member.id,
        house_id: member.house_id,
        payload: { reason, prompt_version: CONCIERGE_PROMPT_VERSION },
      });
      const founderPhone = process.env.FOUNDER_PHONE;
      if (founderPhone) {
        await sendSms(founderPhone, `[${config.brandName}] Escalation for ${member.first_name} ${member.last_name}: ${reason}`);
      }
      return { result: "Escalated — the owner has been notified and will follow up with the member." };
    }

    default:
      return { result: `Unknown tool: ${name}`, isError: true };
  }
}

// ── Main entry: one inbound SMS in, one reply out ───────────────────────────

export async function handleInboundSms(fromPhone: string, body: string): Promise<string> {
  const db = supabaseAdmin();

  // Identity binds to the phone number, so the inbound lookup MUST normalize to
  // the exact E.164 form signup stored — otherwise a member silently becomes an
  // "unknown number" (T1-6). Twilio sends E.164, but normalize defensively.
  const lookupPhone = normalizePhone(fromPhone) ?? fromPhone;
  const { data: member } = await db
    .from("members")
    .select("*")
    .eq("phone", lookupPhone)
    .maybeSingle();

  // Unknown numbers get a polite signup pointer — no AI involved.
  if (!member) {
    const reply = `Hi! This is ${config.brandName}. We don't recognize this number — if you'd like to join, sign up here: ${config.appBaseUrl}/signup`;
    await sendSms(fromPhone, reply);
    return reply;
  }

  // History BEFORE logging the new message, so it becomes the final user turn.
  const history = await recentHistory(member.id);

  await db.from("messages").insert({
    member_id: member.id,
    direction: "inbound",
    body,
    channel: "sms",
    handled_by: "concierge_ai",
  });

  const state = { escalated: false };
  let reply = SAFE_FALLBACK;

  try {
    const anthropic = new Anthropic();
    const system = `${conciergeSystemPrompt()}\n\n${await buildMemberContext(member)}`;
    const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: body }];

    let rounds = 0;
    while (rounds++ < MAX_TOOL_ROUNDS) {
      const response = await anthropic.messages.create({
        model: conciergeModel(),
        max_tokens: 1000,
        system,
        tools: TOOLS,
        messages,
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUses.length === 0 || response.stop_reason === "end_turn") {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
        if (text) reply = text;
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const outcome = await executeTool(use.name, use.input, member, state);
        await logEvent({
          type: "concierge.tool_used",
          actor_type: "ai",
          member_id: member.id,
          house_id: member.house_id,
          payload: { tool: use.name, ok: !outcome.isError, prompt_version: CONCIERGE_PROMPT_VERSION },
        });
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: outcome.result,
          is_error: outcome.isError ?? false,
        });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    console.error("[concierge] failed:", err);
    state.escalated = true;
    await logEvent({
      type: "message.escalated",
      actor_type: "system",
      member_id: member.id,
      house_id: member.house_id,
      payload: { reason: "concierge_error", prompt_version: CONCIERGE_PROMPT_VERSION },
    });
  }

  // T0-6 [A4]: once escalated, NEVER send the model's free text — it may
  // contain improvised (e.g. medical) advice. Override with a fixed, safe
  // hand-off so the member only ever gets the canned reply.
  if (state.escalated) reply = copy.smsEscalationHandoff();

  await sendSms(member.phone, reply);
  await db.from("messages").insert({
    member_id: member.id,
    direction: "outbound",
    body: reply,
    channel: "sms",
    handled_by: "concierge_ai",
    escalated: state.escalated,
  });

  return reply;
}
