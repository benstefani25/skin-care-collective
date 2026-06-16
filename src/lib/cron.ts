// Cron routes are unauthenticated HTTP endpoints — gate them on a shared
// secret. Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` when the
// env var is set; Supabase cron / curl can send the same header.
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail OPEN in dev (so local cron testing works), fail CLOSED in prod.
    // A production deploy without CRON_SECRET means every cron call is denied
    // and scheduled jobs never run — loud warning so it can't pass silently.
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] CRON_SECRET is not set in production — all cron routes will 401 and jobs will NOT run.");
      return false;
    }
    return true;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
