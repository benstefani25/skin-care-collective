// T2-7 — Provider payroll export. Columns map to a Gusto-style import, and the
// money reconciles: total_gross = base pay + wage-floor top-up; base pay =
// completed tans × base rate. (Pure formatting test over a known row — no DB.)
import { describe, expect, it } from "vitest";
import { payrollProviderCsv, type PayrollRow } from "@/lib/payroll";

const row: PayrollRow = {
  tech: "Jordan Reyes",
  tech_first: "Jordan",
  tech_last: "Reyes",
  tech_email: "jordan@example.com",
  period_start: "2026-06-08",
  period_end: "2026-06-22",
  completed_tans: 7,
  base_pay_cents: 7000, // 7 tans × $10
  hours_worked: 9.5,
  wage_floor_cents_per_hour: 1500,
  wage_floor_topup_cents: 500,
  deferred_accrued_cents: 1750,
  deferred_balance_cents: 4250,
};

describe("payrollProviderCsv", () => {
  const csv = payrollProviderCsv([row]);
  const [header, line] = csv.split("\n");
  const cols = Object.fromEntries(header.split(",").map((h, i) => [h, line.split(",")[i]]));

  it("has provider-importable headers", () => {
    for (const h of ["first_name", "last_name", "email", "pay_period_start", "regular_hours", "gross_base_pay", "total_gross_pay"]) {
      expect(header).toContain(h);
    }
  });

  it("reconciles total gross = base + top-up", () => {
    expect(cols.gross_base_pay).toBe("70.00");
    expect(cols.wage_floor_top_up).toBe("5.00");
    expect(cols.total_gross_pay).toBe("75.00");
  });

  it("carries deferred figures as memo only (not in gross)", () => {
    expect(cols.deferred_accrued_memo).toBe("17.50");
    expect(cols.deferred_balance_memo).toBe("42.50");
    // deferred is excluded from total gross
    expect(cols.total_gross_pay).not.toBe("92.50");
  });
});
