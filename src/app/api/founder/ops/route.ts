// Founder ops chat endpoint (T2-6). Founder-gated; read-only agent.
import { requireFounder } from "@/lib/auth";
import { runOpsChat, ChatTurn } from "@/lib/ops";

export async function POST(req: Request) {
  await requireFounder();
  const body = await req.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  const history: ChatTurn[] = Array.isArray(body?.history)
    ? body.history
        .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string")
        .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 4000) }))
    : [];
  if (!question) return Response.json({ error: "empty" }, { status: 400 });
  const reply = await runOpsChat(history, question.slice(0, 2000));
  return Response.json({ reply });
}
