import { FounderNav } from "@/components/FounderNav";
import { getExceptions } from "@/lib/founder";
import { fmtDate } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  under_threshold: "Under-booked",
  escalation: "Escalation",
  payment_failed: "Payment",
  no_show_spike: "No-shows",
  low_rating: "Rating",
  tech_late: "Tech",
};

export default async function FounderHome() {
  const exceptions = await getExceptions();
  const act = exceptions.filter((e) => e.severity === "act");
  const watch = exceptions.filter((e) => e.severity === "watch");

  return (
    <div className="stack">
      <FounderNav active="home" />
      <h1>Exceptions</h1>
      <p className="muted">
        Everything that needs you. A clear board means operations are running themselves.
      </p>

      {exceptions.length === 0 && (
        <p className="banner ok">All clear — nothing needs your attention right now.</p>
      )}

      {act.length > 0 && <h2>Act now ({act.length})</h2>}
      {act.map((e, i) => (
        <ExceptionCard key={`a${i}`} e={e} />
      ))}

      {watch.length > 0 && <h2>Keep an eye on ({watch.length})</h2>}
      {watch.map((e, i) => (
        <ExceptionCard key={`w${i}`} e={e} />
      ))}
    </div>
  );
}

function ExceptionCard({ e }: { e: Awaited<ReturnType<typeof getExceptions>>[number] }) {
  const card = (
    <div className={`card exc exc-${e.severity}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{e.title}</strong>
        <span className="pill">{KIND_LABEL[e.kind]}</span>
      </div>
      <p className="muted">{e.detail}</p>
      {e.at && <p className="fine">{e.at.includes("T") ? new Date(e.at).toLocaleString() : fmtDate(e.at)}</p>}
    </div>
  );
  return e.href ? (
    <Link href={e.href} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  ) : (
    card
  );
}
