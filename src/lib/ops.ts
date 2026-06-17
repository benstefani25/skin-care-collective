// Founder ops agent / "Jarvis" (T2-6). A single READ-ONLY brain behind two
// entry points: the ask-anytime console chat and the scheduled morning brief.
// It also subsumes the QC weekly digest's role (qc.ts still runs the formal
// Healthy/Watch/Act digest; this agent answers everything else and can draft).
// NO mutating tools are bound — by construction it cannot change data, move
// money, or message anyone. It may DRAFT a check-in for the founder to send.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/config/app";
import { OPS_PROMPT_VERSION, opsSystemPrompt } from "@/config/prompts";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { getExceptions, getHouseHealth } from "./founder";
import { runPayroll, currentPayPeriod } from "./payroll";
import { addDaysISO, todayISO } from "./time";

const MAX_TOOL_ROUNDS = 6;

function opsModel(): string {
  return process.env.OPS_MODEL ?? config.defaultModel;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

// ── Read-only metrics ───────────────────────────────────────────────────────
export type OpsMetrics = {
  active_members: number;
  monthly_revenue: string;
  completed_tans_month: number;
  labor_cost_month: string;
  labor_pct_of_revenue: number | null;
  deferred_liability_outstanding: string;
  wage_topups_month: string;
  fill_rate_pct_30d: number | null;
};

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function computeOpsMetrics(): Promise<OpsMetrics> {
  const db = supabaseAdmin();
  const monthStart = addDaysISO(todayISO(), -30);

  // Revenue ≈ active members × their house's monthly price.
  const { data: members } = await db
    .from("members")
    .select("status, house:houses(monthly_price_cents)")
    .eq("status", "active");
  const activeMembers = (members ?? []).length;
  const revenueCents = (members ?? []).reduce(
    (sum, m: any) => sum + (m.house?.monthly_price_cents ?? 0),
    0
  );

  // Completed tans (last 30d) and their base pay (per-tech base rate).
  const { data: completed } = await db
    .from("appointments")
    .select("slot:slots!inner(visit:visits!inner(date, tech:techs(base_rate_cents)))")
    .eq("status", "completed")
    .gte("slot.visit.date", monthStart);
  const tans = (completed ?? []) as any[];
  const basePayCents = tans.reduce((sum, a) => sum + (a.slot?.visit?.tech?.base_rate_cents ?? 0), 0);

  // Bonus ledger: deferred liability outstanding + topups in the last 30d.
  const { data: ledger } = await db.from("bonus_ledger").select("type, amount_cents, created_at");
  let deferred = 0;
  let topupsMonth = 0;
  for (const row of (ledger ?? []) as any[]) {
    if (row.type === "deferred_accrual") deferred += row.amount_cents;
    else if (row.type === "payout" || row.type === "forfeiture") deferred -= row.amount_cents;
    if (row.type === "adjustment" && row.created_at >= monthStart) topupsMonth += row.amount_cents;
  }

  const laborCents = basePayCents + topupsMonth;
  const laborPct = revenueCents > 0 ? Math.round((laborCents / revenueCents) * 1000) / 10 : null;

  // Fill rate across the last 30d of visits.
  const { data: visits } = await db
    .from("visits")
    .select("slots(status)")
    .gte("date", monthStart);
  let slots = 0;
  let booked = 0;
  for (const v of (visits ?? []) as any[]) {
    for (const s of v.slots ?? []) {
      slots++;
      if (s.status === "booked") booked++;
    }
  }

  return {
    active_members: activeMembers,
    monthly_revenue: usd(revenueCents),
    completed_tans_month: tans.length,
    labor_cost_month: usd(laborCents),
    labor_pct_of_revenue: laborPct,
    deferred_liability_outstanding: usd(deferred),
    wage_topups_month: usd(topupsMonth),
    fill_rate_pct_30d: slots > 0 ? Math.round((booked / slots) * 100) : null,
  };
}

// ── Read-only tools ─────────────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  { name: "get_metrics", description: "Business metrics: active members, monthly revenue, completed tans, labor cost & labor % of revenue, outstanding deferred bonus liability, wage top-ups, 30-day fill rate.", input_schema: { type: "object", properties: {} } },
  { name: "get_exceptions", description: "The current exceptions feed: escalations, failed payments, under-booked visits, low ratings, no-show spikes, techs not checked in.", input_schema: { type: "object", properties: {} } },
  { name: "get_house_health", description: "Per-house health: active members, churn, average rating, fill rate.", input_schema: { type: "object", properties: {} } },
  { name: "get_payroll", description: "Current pay-period payroll rows per tech: completed tans, base pay, hours, wage-floor top-up, deferred balance.", input_schema: { type: "object", properties: {} } },
  { name: "recent_events", description: "Recent rows from the append-only events log, optionally filtered by type, newest first.", input_schema: { type: "object", properties: { type: { type: "string", description: "optional event type filter, e.g. 'appointment.no_show'" }, days: { type: "number", description: "lookback window in days (default 7)" } } } },
  { name: "draft_director_checkin", description: "DRAFT (do not send) a warm check-in message to a house director for the founder to review and send himself.", input_schema: { type: "object", properties: { house: { type: "string" }, concern: { type: "string", description: "what to tactfully address" } }, required: ["house", "concern"] } },
];

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "get_metrics":
      return JSON.stringify(await computeOpsMetrics());
    case "get_exceptions":
      return JSON.stringify(await getExceptions());
    case "get_house_health":
      return JSON.stringify(await getHouseHealth());
    case "get_payroll": {
      const period = currentPayPeriod();
      return JSON.stringify({ period, rows: await runPayroll() });
    }
    case "recent_events": {
      const days = Number(input?.days) > 0 ? Number(input.days) : 7;
      let q = supabaseAdmin()
        .from("events")
        .select("type, actor_type, created_at, payload")
        .gte("created_at", addDaysISO(todayISO(), -days))
        .order("created_at", { ascending: false })
        .limit(60);
      if (input?.type) q = q.eq("type", String(input.type));
      const { data } = await q;
      return JSON.stringify(data ?? []);
    }
    case "draft_director_checkin":
      // Pure drafting — returns text to the model; never sends anything.
      return `DRAFT ONLY (founder must review & send). House: ${input?.house}. Concern: ${input?.concern}.`;
    default:
      return `Unknown tool: ${name}`;
  }
}

async function runAgent(messages: Anthropic.MessageParam[]): Promise<string> {
  const anthropic = new Anthropic();
  let rounds = 0;
  let reply = "I couldn't pull that together right now.";
  while (rounds++ < MAX_TOOL_ROUNDS) {
    const response = await anthropic.messages.create({
      model: opsModel(),
      max_tokens: 1500,
      system: opsSystemPrompt(),
      tools: TOOLS,
      messages,
    });
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ").trim();
      if (text) reply = text;
      break;
    }
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      results.push({ type: "tool_result", tool_use_id: use.id, content: await executeTool(use.name, use.input) });
    }
    messages.push({ role: "user", content: results });
  }
  return reply;
}

// Ask-anytime console chat.
export async function runOpsChat(history: ChatTurn[], question: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: question },
  ];
  let reply = "Sorry — I hit a snag pulling that.";
  try {
    reply = await runAgent(messages);
  } catch (err) {
    console.error("[ops] chat failed:", err);
  }
  await logEvent({ type: "ops.query", actor_type: "ai", payload: { question, prompt_version: OPS_PROMPT_VERSION } });
  return reply;
}

// Scheduled morning brief — stored in the digests table (generated_by tags it).
export async function generateMorningBrief(): Promise<{ id: string; body: string } | null> {
  const db = supabaseAdmin();
  let body = "";
  try {
    body = await runAgent([
      {
        role: "user",
        content:
          "Write the founder's morning brief for today. Pull metrics, exceptions, and house health. Lead with anything that needs action today, then a 3-5 bullet state-of-the-business (members, revenue, labor %, deferred liability, fill rate). Keep it tight.",
      },
    ]);
  } catch (err) {
    console.error("[ops] morning brief failed:", err);
    return null;
  }
  const today = todayISO();
  const { data, error } = await db
    .from("digests")
    .insert({ period_start: today, period_end: today, data: {}, body, generated_by: "ops_morning_brief" })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[ops] failed to store morning brief:", error?.message);
    return null;
  }
  await logEvent({ type: "ops.morning_brief", actor_type: "ai", payload: { prompt_version: OPS_PROMPT_VERSION } });
  return { id: data.id, body };
}
