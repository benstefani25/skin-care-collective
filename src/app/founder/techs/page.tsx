import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtUsd } from "@/lib/pricing";
import { addTechAction, assignHouseAction, saveTechAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["applicant", "active", "offboarded"];

export default async function TechsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const db = supabaseAdmin();
  const { data: techs } = await db
    .from("techs")
    .select("*, assignments:tech_house_assignments(house_id, house:houses(name), active)")
    .order("last_name");
  const { data: houses } = await db.from("houses").select("id, name").order("name");

  return (
    <div className="stack">
      <FounderNav active="techs" />
      <h1>Techs</h1>
      {sp.ok && <p className="banner ok">Saved.</p>}
      {sp.error && <p className="banner error">Check the details and try again.</p>}

      <details className="card">
        <summary><strong>Add a tech</strong></summary>
        <form action={addTechAction} className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <label style={{ flex: 1 }}>First name<input name="first_name" required /></label>
            <label style={{ flex: 1 }}>Last name<input name="last_name" required /></label>
          </div>
          <label>Email<input name="email" type="email" required /></label>
          <label>Phone<input name="phone" type="tel" placeholder="(555) 555-5555" required /></label>
          <button className="btn small" type="submit">Add tech (as applicant)</button>
          <p className="fine">Starts as an applicant at the default rates; set wages and assign a house below.</p>
        </form>
      </details>

      {(techs ?? []).map((t: any) => {
        const activeHouseIds = new Set(
          (t.assignments ?? []).filter((a: any) => a.active).map((a: any) => a.house_id)
        );
        return (
          <div className="card stack" key={t.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t.first_name} {t.last_name}</strong>
              <span className="pill">{t.status}</span>
            </div>
            <p className="fine">{t.email} · semester {t.semester_number}</p>

            <form action={saveTechAction} className="stack">
              <input type="hidden" name="id" value={t.id} />
              <div className="row">
                <label style={{ flex: 1 }}>Status
                  <select name="status" defaultValue={t.status}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label style={{ width: 90 }}>Semester #
                  <input name="semester_number" type="number" min="1" defaultValue={t.semester_number} />
                </label>
              </div>
              <div className="row">
                <label style={{ flex: 1 }}>Base / tan ($)
                  <input name="base_rate" type="number" step="0.01" min="0" defaultValue={(t.base_rate_cents / 100).toFixed(2)} />
                </label>
                <label style={{ flex: 1 }}>Deferred / tan ($)
                  <input name="deferred_rate" type="number" step="0.01" min="0" defaultValue={(t.deferred_rate_cents / 100).toFixed(2)} />
                </label>
              </div>
              <p className="fine">Currently {fmtUsd(t.base_rate_cents)} base + {fmtUsd(t.deferred_rate_cents)} deferred per completed tan. Wage changes are logged.</p>
              <button className="btn small" type="submit">Save</button>
            </form>

            <div>
              <p className="fine" style={{ marginBottom: 6 }}>House assignments (tap to toggle):</p>
              <div className="row">
                {(houses ?? []).map((h: any) => (
                  <form action={assignHouseAction} key={h.id}>
                    <input type="hidden" name="tech_id" value={t.id} />
                    <input type="hidden" name="house_id" value={h.id} />
                    <button
                      className={`btn small ${activeHouseIds.has(h.id) ? "" : "secondary"}`}
                      type="submit"
                    >
                      {activeHouseIds.has(h.id) ? "✓ " : ""}{h.name}
                    </button>
                  </form>
                ))}
                {(houses ?? []).length === 0 && <span className="muted">No houses yet.</span>}
              </div>
            </div>
          </div>
        );
      })}
      {(techs ?? []).length === 0 && <p className="muted">No techs yet — add one above.</p>}
    </div>
  );
}
