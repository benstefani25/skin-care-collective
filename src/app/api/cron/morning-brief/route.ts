// Daily founder morning brief (T2-6). Hobby-plan compatible (once daily).
import { cronAuthorized } from "@/lib/cron";
import { generateMorningBrief } from "@/lib/ops";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await generateMorningBrief();
  return Response.json({ ok: !!result, id: result?.id ?? null });
}
