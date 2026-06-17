import Link from "next/link";
import { FounderNav } from "@/components/FounderNav";
import { getHouseHealth } from "@/lib/founder";
import { createHouseAction } from "./actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function HousesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const houses = await getHouseHealth();
  return (
    <div className="stack">
      <FounderNav active="houses" />
      <h1>Houses</h1>
      {sp.error && <p className="banner error">Check the details and try again.</p>}

      <details className="card">
        <summary><strong>Add a house</strong></summary>
        <form action={createHouseAction} className="stack" style={{ marginTop: 12 }}>
          <label>House name<input name="name" required /></label>
          <label>Campus<input name="campus" required /></label>
          <label>Address<input name="address" /></label>
          <div className="row">
            <label style={{ flex: 1 }}>Visit day
              <select name="visit_weekday" defaultValue="">
                <option value="" disabled>Day…</option>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </label>
            <label style={{ width: 120 }}>Monthly $
              <input name="monthly_price" type="number" step="0.01" placeholder="89" />
            </label>
          </div>
          <div className="row">
            <label style={{ flex: 1 }}>Window start<input name="visit_window_start" type="time" defaultValue="17:00" required /></label>
            <label style={{ flex: 1 }}>Window end<input name="visit_window_end" type="time" defaultValue="21:00" required /></label>
          </div>
          <button className="btn small" type="submit">Create house (as prospect)</button>
          <p className="fine">Generates a private join link you can hand out. Flip to &quot;active&quot; when ready to take signups.</p>
        </form>
      </details>

      {houses.length === 0 && <p className="muted">No houses yet — add one above.</p>}
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
