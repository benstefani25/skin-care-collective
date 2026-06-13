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

  // Booking engine (spec §4)
  slotGenerationWeeksAhead: 3,
  cancellationWindowHours: 24, // FOUNDER DECISION
  visitMinimum: 5, // FOUNDER DECISION — under-threshold flag, no auto-cancel in MVP

  // Defaults applied to new houses (each house can override in its row)
  defaultSlotDurationMinutes: 20, // FOUNDER DECISION
  defaultMonthlyPriceCents: 6500, // FOUNDER DECISION

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
};
