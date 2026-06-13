import { TechNav } from "@/components/TechNav";
import { requireTech } from "@/lib/auth";
import { CopilotChat } from "./CopilotChat";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  await requireTech(); // gate the page; the API re-checks on every message
  return (
    <div className="stack">
      <TechNav active="copilot" />
      <h1>Copilot</h1>
      <CopilotChat />
    </div>
  );
}
