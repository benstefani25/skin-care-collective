// Weekly QC analyst digest (spec §11c). Schedule weekly in production.
import { cronAuthorized } from "@/lib/cron";
import { runWeeklyDigest } from "@/lib/qc";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await runWeeklyDigest();
  return Response.json({ ok: !!result, digest_id: result?.id ?? null });
}
