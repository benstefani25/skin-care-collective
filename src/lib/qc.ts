// QC analyst (spec §11c): weekly, per house, trailing 14 days. Produces a
// Healthy / Watch / Act digest with one-line evidence per flag and a DRAFTED
// check-in message to any house director where Act applies. Stored to the
// console and emailed. NEVER auto-sent to anyone external.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/config/app";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { addDaysISO, slotStart, todayISO } from "./time";

export const QC_PROMPT_VERSION = "qc-v1";

function qcModel(): string {
  return process.env.QC_MODEL ?? config.defaultModel;
}

type HouseMetrics = {
  house: string;
  active_members: number;
  fill_rate_pct: number | null;
  fill_rate_prior_pct: number | null;
  no_show_rate_pct: number;
  late_cancel_rate_pct: number;
  no_show_rate_prior_pct: number;
  avg_rating: number | null;
  ratings: Array<{ rating: number; comment: string | null }>;
  escalations: number;
  message_sample: string[];
};

async function collectHouseMetrics(period: { start: string; end: string }, prior: { start: string; end: string }): Promise<HouseMetrics[]> {
  const db = supabaseAdmin();
  const { data: houses } = await db.from("houses").select("*").eq("status", "active").order("name");
  const out: HouseMetrics[] = [];

  for (const h of houses ?? []) {
    const fill = await fillRate(db, h.id, period);
    const fillPrior = await fillRate(db, h.id, prior);
    const cur = await apptOutcomes(db, h.id, period);
    const pri = await apptOutcomes(db, h.id, prior);

    const { count: active } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("house_id", h.id)
      .eq("status", "active");

    const ratings = await houseRatings(db, h.id, period);
    const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null;

    const { count: escalations } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("house_id", h.id)
      .eq("type", "message.escalated")
      .gte("created_at", period.start);

    const { data: msgs } = await db
      .from("messages")
      .select("body")
      .eq("direction", "inbound")
      .eq("handled_by", "concierge_ai")
      .gte("created_at", period.start)
      .limit(8);

    out.push({
      house: h.name,
      active_members: active ?? 0,
      fill_rate_pct: fill,
      fill_rate_prior_pct: fillPrior,
      no_show_rate_pct: cur.noShowRate,
      late_cancel_rate_pct: cur.lateCancelRate,
      no_show_rate_prior_pct: pri.noShowRate,
      avg_rating: avg,
      ratings,
      escalations: escalations ?? 0,
      message_sample: (msgs ?? []).map((m: any) => m.body).slice(0, 8),
    });
  }
  return out;
}

async function fillRate(db: any, houseId: string, period: { start: string; end: string }): Promise<number | null> {
  const { data: visits } = await db
    .from("visits")
    .select("slots(status)")
    .eq("house_id", houseId)
    .gte("date", period.start)
    .lt("date", period.end);
  let slots = 0;
  let booked = 0;
  for (const v of visits ?? []) {
    for (const s of (v.slots ?? []) as any[]) {
      slots++;
      if (s.status === "booked") booked++;
    }
  }
  return slots > 0 ? Math.round((booked / slots) * 100) : null;
}

async function apptOutcomes(db: any, houseId: string, period: { start: string; end: string }) {
  const { data } = await db
    .from("appointments")
    .select("status, slot:slots!inner(visit:visits!inner(house_id, date))")
    .eq("slot.visit.house_id", houseId)
    .gte("slot.visit.date", period.start)
    .lt("slot.visit.date", period.end);
  const rows = (data ?? []) as any[];
  const total = rows.length || 1;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const lateCancel = rows.filter((r) => r.status === "cancelled_late").length;
  return {
    noShowRate: Math.round((noShow / total) * 100),
    lateCancelRate: Math.round((lateCancel / total) * 100),
  };
}

async function houseRatings(db: any, houseId: string, period: { start: string; end: string }) {
  const { data } = await db
    .from("surveys")
    .select("rating, comment, appointment:appointments!inner(slot:slots!inner(visit:visits!inner(house_id)))")
    .eq("appointment.slot.visit.house_id", houseId)
    .gte("created_at", period.start);
  return ((data ?? []) as any[]).map((s) => ({ rating: s.rating, comment: s.comment }));
}

const QC_SYSTEM = `You are the QC analyst for ${config.brandName}, a mobile spray-tan membership service. Once a week you review per-house operational metrics for the owner, who runs the business fully remotely and cannot observe service in person — this digest is one of his only windows into quality.

Classify each house into exactly one of: "healthy", "watch", or "act".
- healthy: strong fill rate, good ratings, low no-shows, no escalations.
- watch: an early warning — a dip in fill rate or rating, a couple of no-shows, a single escalation.
- act: something needs the owner's attention now — low/falling fill rate, ratings at or below 3, an escalation cluster, a clear negative trend vs the prior period.

For every flagged house give ONE line of concrete evidence (cite the actual numbers).

For each house you place in "act", also draft a short, warm check-in message the owner could send to that house's director (he will review and send it himself — never sent automatically). Reference the issue tactfully without alarming language or sharing member specifics.

Respond ONLY with valid JSON, no markdown fences, in exactly this shape:
{
  "healthy": [{"house": "...", "evidence": "..."}],
  "watch": [{"house": "...", "evidence": "..."}],
  "act": [{"house": "...", "evidence": "..."}],
  "drafts": [{"house": "...", "message": "..."}]
}`;

export type DigestData = {
  healthy: Array<{ house: string; evidence: string }>;
  watch: Array<{ house: string; evidence: string }>;
  act: Array<{ house: string; evidence: string }>;
  drafts: Array<{ house: string; message: string }>;
};

export async function runWeeklyDigest(): Promise<{ id: string; data: DigestData; body: string } | null> {
  const db = supabaseAdmin();
  const end = todayISO();
  const start = addDaysISO(end, -14);
  const prior = { start: addDaysISO(start, -14), end: start };
  const metrics = await collectHouseMetrics({ start, end }, prior);

  if (metrics.length === 0) return null;

  let data: DigestData = { healthy: [], watch: [], act: [], drafts: [] };
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: qcModel(),
      max_tokens: 2000,
      system: QC_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Trailing-14-day metrics per house (prior period shown for trend). Produce the digest JSON.\n\n${JSON.stringify(metrics, null, 2)}`,
        },
      ],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const json = text.replace(/^```json?\s*/i, "").replace(/```$/, "").trim();
    data = JSON.parse(json);
  } catch (err) {
    console.error("[qc] digest generation failed:", err);
    return null;
  }

  const body = renderMarkdown(data, start, end);

  const { data: row, error } = await db
    .from("digests")
    .insert({ period_start: start, period_end: end, data, body, generated_by: "qc_ai" })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[qc] failed to store digest:", error?.message);
    return null;
  }

  await logEvent({
    type: "digest.generated",
    actor_type: "ai",
    payload: {
      period_start: start,
      period_end: end,
      act_count: data.act?.length ?? 0,
      prompt_version: QC_PROMPT_VERSION,
    },
  });

  // "Stored to the console and emailed" — email delivery is wired when an
  // email provider is configured; for now the console is the durable copy.
  return { id: row.id, data, body };
}

function renderMarkdown(d: DigestData, start: string, end: string): string {
  const lines: string[] = [`# Weekly digest — ${start} to ${end}`, ""];
  const section = (title: string, items: Array<{ house: string; evidence: string }>) => {
    lines.push(`## ${title}`);
    if (!items?.length) lines.push("_None_");
    for (const it of items ?? []) lines.push(`- **${it.house}** — ${it.evidence}`);
    lines.push("");
  };
  section("✅ Healthy", d.healthy);
  section("⚠️ Watch", d.watch);
  section("🚨 Act", d.act);
  if (d.drafts?.length) {
    lines.push("## Drafted check-ins (review before sending)");
    for (const dr of d.drafts) {
      lines.push(`**To ${dr.house}'s director:**`, "", `> ${dr.message}`, "");
    }
  }
  return lines.join("\n");
}
