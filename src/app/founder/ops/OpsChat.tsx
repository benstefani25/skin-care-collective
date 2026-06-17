"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's my labor % and outstanding deferred liability this month?",
  "Which houses need attention right now?",
  "How did this week's no-shows compare to usual?",
];

export function OpsChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/founder/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      setTurns((t) => [...t, { role: "assistant", content: data.reply ?? "Something went wrong." }]);
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
          <>
            <p className="muted">Ask anything about the business — it reads your real data and never changes anything.</p>
            <div className="stack" style={{ gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn small secondary" onClick={() => ask(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>{t.content}</div>
        ))}
        {busy && <div className="bubble assistant muted">…</div>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="row"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about the business…" disabled={busy} />
        <button className="btn small" type="submit" disabled={busy || !input.trim()}>Ask</button>
      </form>
    </div>
  );
}
