// All FOUNDER DECISION stubs live here (spec §15). Change config, not code.
export const config = {
  // Brand is undecided — never hardcode customer-facing copy elsewhere.
  get brandName() {
    return process.env.BRAND_NAME ?? "Skin Care Collective";
  },
  get appBaseUrl() {
    return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get timezone() {
    return process.env.APP_TIMEZONE ?? "America/Chicago";
  },
  // Founder console is one user (spec §7); gate on this email. Multi-founder
  // roles are explicitly out of scope (§14).
  get founderEmail() {
    return (process.env.FOUNDER_EMAIL ?? "").toLowerCase();
  },

  // Booking engine (spec §4)
  slotGenerationWeeksAhead: 3,
  cancellationWindowHours: 24, // FOUNDER DECISION
  visitMinimum: 5, // FOUNDER DECISION — under-threshold flag, no auto-cancel in MVP

  // Defaults applied to new houses (each house can override in its row)
  defaultSlotDurationMinutes: 20, // FOUNDER DECISION
  defaultMonthlyPriceCents: 8900, // FOUNDER DECISION — $89/mo (confirmed 2026-06)

  // Semester-prepay is a CADENCE choice, not a tier (T1-1). The semester amount
  // is derived from each house's own monthly price (per-house pricing is the
  // founder's lever) × the interval, with an optional prepay discount.
  semesterIntervalMonths: 4, // FOUNDER DECISION — billing interval for a prepaid semester
  semesterPrepayDiscountPct: 0, // FOUNDER DECISION — e.g. 10 = 10% off vs. paying monthly

  // Pay (DECIDED per spec §15)
  baseRateCents: 1000,
  deferredRateBaseCents: 250, // $2.50, +$2.50 per retained semester…
  deferredRateCapCents: 750, // …capped at $7.50 unless founder overrides
  travelSetupAllowanceMinutes: 60, // wage-floor true-up hours allowance
  defaultMinimumWageCents: 1500, // per-hour floor when a house has no override (FOUNDER DECISION — jurisdiction-specific)
  payPeriodAnchor: "2026-01-05", // a Monday; biweekly periods count from here
  currentSemester: "F26", // FOUNDER DECISION — semester dates per campus
  semesterEndDate: "2026-12-18", // F26 payout date
  techDayStartHour: 6, // run sheet unlocks at 6:00 AM local on visit days

  // Payments (spec §9)
  pastDueGraceAppointments: 1, // FOUNDER DECISION — honor 1 booked appt

  // Sales tax (T1-2). Leave FALSE until Stripe Tax is activated in the Stripe
  // dashboard (set a default tax code/category + add a registration for each
  // campus state). Flipping this on before that is configured makes checkout
  // error. When true, checkout collects a billing address and lets Stripe
  // compute tax. Never surcharge processing fees — bake them into the price.
  enableStripeTax: false, // FOUNDER DECISION
};
