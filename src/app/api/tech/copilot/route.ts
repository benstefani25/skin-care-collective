// Copilot chat endpoint. Tech-authenticated; the tech id comes from the
// session, never the request body.
import { requireTech } from "@/lib/auth";
import { handleCopilotMessage, ChatTurn } from "@/lib/copilot";

export async function POST(req: Request) {
  const tech = await requireTech();
  const body = await req.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  const history: ChatTurn[] = Array.isArray(body?.history)
    ? body.history
        .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string")
        .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 2000) }))
    : [];
  if (!question) return Response.json({ error: "empty" }, { status: 400 });

  const result = await handleCopilotMessage(tech.id, history, question.slice(0, 2000));
  return Response.json(result);
}
