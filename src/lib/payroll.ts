// Payroll (spec §10): deterministic code only — the Claude API is never in
// this path, and bonus_ledger rows are only ever written here and in
// techops.completeAppointment.
import { config } from "@/config/app";
import { supabaseAdmin } from "./supabase/admin";
import { logEvent } from "./events";
import { addDaysISO, todayISO } from "./time";

// Deferred escalator (DECIDED): $2.50 base, +$2.50 per completed semester
// retained, capped at $7.50. Applied at accrual time from the tech's
// current semester_number; prior accruals are never restated.
export function deferredRateForSemester(semesterNumber: number): number {
  const n = Math.max(1, semesterNumber || 1);
  return Math.min(config.deferredRateBaseCents * n, config.deferredRateCapCents);
}

// Biweekly periods anchored at config.payPeriodAnchor. Start inclusive,
// end exclusive.
export function currentPayPeriod(today = todayISO()): { start: string; end: string } {
  const anchor = new Date(`${config.payPeriodAnchor}T12:00:00`);
  const now = new Date(`${today}T12:00:00`);
  const daysSince = Math.floor((now.getTime() - anchor.getTime()) / 864e5);
  const periodIndex = Math.floor(daysSince / 14);
  const start = addDaysISO(config.payPeriodAnchor, periodIndex * 14);
  return { start, end: addDaysISO(start, 14) };
}

export type PayrollRow = {
  tech: string;
  period_start: string;
  period_end: string;
  completed_tans: number;
  base_pay_cents: number;
  hours_worked: number;
  wage_floor_cents_per_hour: number;
  wage_floor_topup_cents: number;
  deferred_accrued_cents: number;
  deferred_balance_cents: number;
};

// Computes the period for every active tech, applies the minimum-wage
// true-up (writes a ledger adjustment + event when owed — idempotent per
// period via the note key), and returns rows ready for CSV.
export async function runPayroll(periodStart?: string): Promise<PayrollRow[]> {
  const db = supabaseAdmin();
  const period = periodStart
    ? { start: periodStart, end: addDaysISO(periodStart, 14) }
    : currentPayPeriod();

  const { data: techs } = await db.from("techs").select("*").eq("status", "active");
  const rows: PayrollRow[] = [];

  for (const tech of techs ?? []) {
    // Completed tans in period, attributed by visit date.
    const { data: completed } = await db
      .from("appointments")
      .select("id, slot:slots!inner(visit:visits!inner(id, date, house_id, checked_in_at, checked_out_at, tech_id))")
      .eq("status", "completed")
      .eq("slot.visit.tech_id", tech.id)
      .gte("slot.visit.date", period.start)
      .lt("slot.visit.date", period.end);
    const tans = completed ?? [];
    const basePay = tans.length * config.baseRateCents;

    // Hours: sum of visit check-in→check-out plus a travel/setup allowance
    // per attended visit (spec §10).
    const visitsAttended = new Map<string, { in: string | null; out: string | null; house_id: string }>();
    for (const t of tans as any[]) {
      const v = t.slot.visit;
      visitsAttended.set(v.id, { in: v.checked_in_at, out: v.checked_out_at, house_id: v.house_id });
    }
    let hours = 0;
    for (const v of visitsAttended.values()) {
      if (v.in && v.out) {
        hours += (new Date(v.out).getTime() - new Date(v.in).getTime()) / 36e5;
      }
      hours += config.travelSetupAllowanceMinutes / 60;
    }

    // Wage floor: the strictest floor among houses worked this period.
    let floor = config.defaultMinimumWageCents;
    const houseIds = [...new Set([...visitsAttended.values()].map((v) => v.house_id))];
    if (houseIds.length > 0) {
      const { data: houses } = await db
        .from("houses")
        .select("minimum_wage_cents")
        .in("id", houseIds);
      for (const h of houses ?? []) {
        if (h.minimum_wage_cents && h.minimum_wage_cents > floor) floor = h.minimum_wage_cents;
      }
    }

    // True-up counts only base pay toward the floor — never deferred accruals.
    let topup = 0;
    if (hours > 0) {
      topup = Math.max(0, Math.round(floor * hours) - basePay);
    }
    if (topup > 0) {
      const noteKey = `wage_floor_topup:${period.start}`;
      const { data: existing } = await db
        .from("bonus_ledger")
        .select("id")
        .eq("tech_id", tech.id)
        .eq("type", "adjustment")
        .eq("note", noteKey)
        .maybeSingle();
      if (!existing) {
        await db.from("bonus_ledger").insert({
          tech_id: tech.id,
          type: "adjustment",
          amount_cents: topup,
          semester: config.currentSemester,
          note: noteKey,
        });
        await logEvent({
          type: "payroll.wage_floor_topup",
          actor_type: "system",
          tech_id: tech.id,
          payload: { period_start: period.start, hours, base_pay_cents: basePay, floor_cents: floor, topup_cents: topup },
        });
      }
    }

    // Deferred accrued this period + lifetime balance still owed.
    const { data: ledger } = await db.from("bonus_ledger").select("*").eq("tech_id", tech.id);
    let accruedThisPeriod = 0;
    let balance = 0;
    for (const row of ledger ?? []) {
      if (row.type === "deferred_accrual") {
        balance += row.amount_cents;
        const created = row.created_at.slice(0, 10);
        if (created >= period.start && created < period.end) accruedThisPeriod += row.amount_cents;
      } else if (row.type === "payout" || row.type === "forfeiture") {
        balance -= row.amount_cents;
      }
    }

    rows.push({
      tech: `${tech.first_name} ${tech.last_name}`,
      period_start: period.start,
      period_end: period.end,
      completed_tans: tans.length,
      base_pay_cents: basePay,
      hours_worked: Math.round(hours * 100) / 100,
      wage_floor_cents_per_hour: floor,
      wage_floor_topup_cents: topup,
      deferred_accrued_cents: accruedThisPeriod,
      deferred_balance_cents: balance,
    });
  }

  return rows;
}

export function payrollCsv(rows: PayrollRow[]): string {
  const header =
    "tech,period_start,period_end,completed_tans,base_pay,hours_worked,wage_floor_per_hour,wage_floor_topup,deferred_accrued,deferred_balance";
  const dollars = (c: number) => (c / 100).toFixed(2);
  const lines = rows.map((r) =>
    [
      `"${r.tech}"`,
      r.period_start,
      r.period_end,
      r.completed_tans,
      dollars(r.base_pay_cents),
      r.hours_worked,
      dollars(r.wage_floor_cents_per_hour),
      dollars(r.wage_floor_topup_cents),
      dollars(r.deferred_accrued_cents),
      dollars(r.deferred_balance_cents),
    ].join(",")
  );
  return [header, ...lines].join("\n");
}
