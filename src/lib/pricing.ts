// Pricing helpers (T1-1). Semester-prepay is a cadence choice derived from each
// house's own monthly price, so per-house pricing flows through both cadences.
import { config } from "@/config/app";

export type Cadence = "monthly" | "semester";

// Total charged once per prepaid semester, from a house's monthly price.
export function semesterAmountCents(monthlyCents: number): number {
  const gross = monthlyCents * config.semesterIntervalMonths;
  const discounted = gross * (1 - config.semesterPrepayDiscountPct / 100);
  return Math.round(discounted);
}

export function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// The Stripe price_data recurrence + amount for a cadence at a given house price.
export function cadenceCheckout(cadence: Cadence, monthlyCents: number): {
  unit_amount: number;
  interval: "month";
  interval_count: number;
  label: string;
} {
  if (cadence === "semester") {
    return {
      unit_amount: semesterAmountCents(monthlyCents),
      interval: "month",
      interval_count: config.semesterIntervalMonths,
      label: `Semester (${config.semesterIntervalMonths} months prepaid)`,
    };
  }
  return { unit_amount: monthlyCents, interval: "month", interval_count: 1, label: "Monthly" };
}
