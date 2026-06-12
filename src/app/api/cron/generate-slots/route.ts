// Daily job: roll visits + slots forward N weeks and place standing
// appointments (spec §4). Idempotent — existing visit dates are skipped.
import { cronAuthorized } from "@/lib/cron";
import { generateVisitsAndSlots } from "@/lib/slots";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const generated = await generateVisitsAndSlots();
  return Response.json({ generated });
}
