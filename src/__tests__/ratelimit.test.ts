// T1-5 — Rate limiter: allow up to `max` in a window, then block; the window
// slides so old hits expire.
import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, _resetRateLimits } from "@/lib/ratelimit";

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimits());

  it("allows up to max, then blocks within the window", () => {
    const t = 1_000_000;
    expect(rateLimit("k", 3, 1000, t)).toBe(true);
    expect(rateLimit("k", 3, 1000, t)).toBe(true);
    expect(rateLimit("k", 3, 1000, t)).toBe(true);
    expect(rateLimit("k", 3, 1000, t)).toBe(false); // 4th in-window blocked
  });

  it("lets hits expire as the window slides", () => {
    const t = 2_000_000;
    expect(rateLimit("k", 2, 1000, t)).toBe(true);
    expect(rateLimit("k", 2, 1000, t)).toBe(true);
    expect(rateLimit("k", 2, 1000, t)).toBe(false);
    expect(rateLimit("k", 2, 1000, t + 1001)).toBe(true); // window moved on
  });

  it("keys are independent (one IP/phone doesn't throttle another)", () => {
    const t = 3_000_000;
    expect(rateLimit("a", 1, 1000, t)).toBe(true);
    expect(rateLimit("a", 1, 1000, t)).toBe(false);
    expect(rateLimit("b", 1, 1000, t)).toBe(true); // different key unaffected
  });
});
