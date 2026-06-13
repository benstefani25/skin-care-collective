// Tech copilot (spec §11b): SOP-grounded chat in the tech app. The entire
// active SOP corpus is injected directly (no vector search needed at this
// size). Today's run-sheet metadata is included WITHOUT any contact info —
// the same wall applies to context construction. Every Q&A is logged: the
// questions are the founder's map of where training is thin.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/config/app";
import { COPILOT_PROMPT_VERSION, copilotSystemPrompt } from "@/config/prompts";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { sendSms } from "./twilio";
import { todayISO } from "./time";

const MAX_TOOL_ROUNDS = 4;

export type ChatTurn = { role: "user" | "assistant"; content: string };

function copilotModel(): string {
  return process.env.COPILOT_MODEL ?? "claude-opus-4-8";
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "escalate",
    description:
      "Flag this question for the owner. Call this whenever the SOPs don't cover the question, or for ANYTHING medical (skin reactions, allergies, injuries, a client's medical condition). Better to escalate than to guess.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "One line on what was asked and why it needs the owner" } },
      required: ["reason"],
    },
  },
  {
    name: "search_sops",
    description:
      "Search the SOP library for a keyword or phrase. Optional — the active SOPs are already in your context, but use this to double-check exact wording before answering a procedural question.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Keyword or phrase to look for" } },
      required: ["query"],
    },
  },
];

// Run-sheet metadata for context — house, counts, and service-notes flags
// only. Never member names, phones, emails, or last initials here.
async function runsheetSummary(techId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: visit } = await db
    .from("visits")
    .select("id, window_start, window_end, house:houses(name)")
    .eq("tech_id", techId)
    .eq("date", todayISO())
    .maybeSingle();
  if (!visit) return "No visit assigned today.";

  const { data: appts } = await db
    .from("appointments")
    .select("status, member:members(service_notes)")
    .in("slot_id", (
      (await db.from("slots").select("id").eq("visit_id", visit.id)).data ?? []
    ).map((s: any) => s.id));
  const booked = (appts ?? []).filter((a: any) => a.status === "booked").length;
  const flags = (appts ?? [])
    .map((a: any) => a.member?.service_notes)
    .filter(Boolean) as string[];

  const house = visit.house as any;
  let out = `${house?.name ?? "House"}, window ${visit.window_start}–${visit.window_end}, ${booked} booked.`;
  if (flags.length) out += ` Service notes to be aware of: ${flags.join("; ")}.`;
  return out;
}

async function searchSops(query: string): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("sop_documents")
    .select("title, body")
    .eq("active", true)
    .ilike("body", `%${query}%`)
    .limit(3);
  if (!data || data.length === 0) return `No SOP matches for "${query}".`;
  return data.map((d: any) => `## ${d.title}\n${d.body}`).join("\n\n");
}

export async function handleCopilotMessage(
  techId: string,
  history: ChatTurn[],
  question: string
): Promise<{ reply: string; escalated: boolean }> {
  const db = supabaseAdmin();

  const { data: sops } = await db
    .from("sop_documents")
    .select("title, body, category")
    .eq("active", true)
    .order("category");
  const sopText = (sops ?? [])
    .map((d: any) => `### ${d.title}${d.category ? ` (${d.category})` : ""}\n${d.body}`)
    .join("\n\n");

  const system = copilotSystemPrompt(sopText, await runsheetSummary(techId));

  let escalated = false;
  let reply = "Sorry — I'm having trouble right now. I've flagged this for the owner.";

  try {
    const anthropic = new Anthropic();
    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
      { role: "user" as const, content: question },
    ];

    let rounds = 0;
    while (rounds++ < MAX_TOOL_ROUNDS) {
      const response = await anthropic.messages.create({
        model: copilotModel(),
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
        let result = "";
        if (use.name === "search_sops") {
          result = await searchSops(String((use.input as any).query ?? ""));
        } else if (use.name === "escalate") {
          escalated = true;
          const reason = String((use.input as any).reason ?? "unspecified");
          await logEvent({
            type: "copilot.escalated",
            actor_type: "ai",
            tech_id: techId,
            payload: { reason, question, prompt_version: COPILOT_PROMPT_VERSION },
          });
          const founderPhone = process.env.FOUNDER_PHONE;
          if (founderPhone) {
            await sendSms(founderPhone, `[${config.brandName}] Tech copilot escalation: ${reason}`);
          }
          result = "Escalated to the owner. Tell the tech the owner will follow up.";
        }
        results.push({ type: "tool_result", tool_use_id: use.id, content: result });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    console.error("[copilot] failed:", err);
    escalated = true;
  }

  // Log every Q&A — this is the founder's map of where SOPs are thin.
  await logEvent({
    type: "copilot.qa",
    actor_type: "ai",
    tech_id: techId,
    payload: { question, answered: !escalated, escalated, prompt_version: COPILOT_PROMPT_VERSION },
  });

  return { reply, escalated };
}
