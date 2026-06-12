// Cron routes are unauthenticated HTTP endpoints — gate them on a shared
// secret. Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` when the
// env var is set; Supabase cron / curl can send the same header.
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
