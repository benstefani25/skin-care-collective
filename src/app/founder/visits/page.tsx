import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate, todayISO } from "@/lib/time";
import { cancelVisitAction, createVisitAction, reassignVisitAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const db = supabaseAdmin();

  const { data: visits } = await db
    .from("visits")
    .select("id, date, window_start, window_end, status, house:houses(name), tech:techs(id, first_name, last_name), slots(status)")
    .gte("date", todayISO())
    .order("date")
    .limit(60);
  const { data: houses } = await db.from("houses").select("id, name").eq("status", "active").order("name");
  const { data: techs } = await db.from("techs").select("id, first_name, last_name").eq("status", "active").order("last_name");

  return (
    <div className="stack">
      <FounderNav active="visits" />
      <h1>Visits</h1>
      {sp.ok && <p className="banner ok">Done.</p>}
      {sp.error && <p className="banner error">That didn&apos;t work — check the inputs.</p>}

      <form action={createVisitAction} className="card stack">
        <h2>Schedule a visit</h2>
        <div className="row">
          <select name="house_id" required defaultValue="">
            <option value="" disabled>House…</option>
            {(houses ?? []).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <input name="date" type="date" required />
        </div>
        <div className="row">
          <select name="tech_id" defaultValue="">
            <option value="">Unassigned</option>
            {(techs ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
          <button className="btn small" type="submit">Create + generate slots</button>
        </div>
        <p className="fine">Window and slot length come from the house&apos;s settings.</p>
      </form>

      <h2>Upcoming</h2>
      {(visits ?? []).map((v: any) => {
        const booked = (v.slots ?? []).filter((s: any) => s.status === "booked").length;
        const total = (v.slots ?? []).length;
        return (
          <div className="card" key={v.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{(v.house as any)?.name} · {fmtDate(v.date)}</strong>
              <span className={`pill ${v.status === "under_threshold" ? "warn" : ""}`}>{v.status}</span>
            </div>
            <p className="muted">{v.window_start}–{v.window_end} · {booked}/{total} booked</p>
            <div className="row">
              <form action={reassignVisitAction} className="row">
                <input type="hidden" name="visit_id" value={v.id} />
                <select name="tech_id" defaultValue={v.tech?.id ?? ""}>
                  <option value="">Unassigned</option>
                  {(techs ?? []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
                <button className="btn small secondary" type="submit">Reassign</button>
              </form>
              {v.status !== "cancelled" && (
                <form action={cancelVisitAction}>
                  <input type="hidden" name="visit_id" value={v.id} />
                  <button className="btn small danger" type="submit">Cancel visit</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
      {(visits ?? []).length === 0 && <p className="muted">No upcoming visits.</p>}
    </div>
  );
}
