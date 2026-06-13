import Link from "next/link";
import { FounderNav } from "@/components/FounderNav";
import { getHouseHealth } from "@/lib/founder";

export const dynamic = "force-dynamic";

export default async function HousesPage() {
  const houses = await getHouseHealth();
  return (
    <div className="stack">
      <FounderNav active="houses" />
      <h1>Houses</h1>
      {houses.length === 0 && <p className="muted">No houses yet.</p>}
      {houses.map((h) => (
        <Link key={h.id} href={`/founder/houses/${h.id}`} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{h.name}</strong>
            <span className="pill">{h.status}</span>
          </div>
          <p className="muted">{h.campus}</p>
          <div className="row metrics">
            <span><strong>{h.activeMembers}</strong> active</span>
            <span><strong>{h.cancelledMembers}</strong> churned</span>
            <span><strong>{h.avgRating != null ? h.avgRating.toFixed(1) : "—"}</strong> avg ★</span>
            <span><strong>{h.fillRate != null ? `${Math.round(h.fillRate * 100)}%` : "—"}</strong> fill</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
