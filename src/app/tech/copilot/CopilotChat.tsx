"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string; escalated?: boolean };

export function CopilotChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/tech/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      setTurns((t) => [
        ...t,
        { role: "assistant", content: data.reply ?? "Something went wrong.", escalated: data.escalated },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Connection issue — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="copilot-thread">
        {turns.length === 0 && (
          <p className="muted">
            Ask me anything about the job — technique, prep, equipment, the process. I answer from
            our SOPs and loop in the owner for anything I&apos;m not sure about.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            {t.content}
            {t.escalated && <div className="fine">↑ Sent to the owner</div>}
          </div>
        ))}
        {busy && <div className="bubble assistant muted">…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          disabled={busy}
        />
        <button className="btn small" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
