// Lightweight, dependency-free sliding-window rate limiter (T1-5). In-memory
// and per-instance — best-effort abuse protection appropriate at MVP scale (the
// review explicitly sanctions in-memory for single-region). It throttles bursts
// hitting a warm instance; it is NOT a distributed guarantee. The durable guard
// against orphaned Stripe customers lives in the signup action itself.
const hits = new Map<string, number[]>();

// Returns true if the action is ALLOWED, false if the key is over its limit.
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

// Test helper.
export function _resetRateLimits(): void {
  hits.clear();
}
