import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saveTechAction } from "./actions";

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
    .select("*, assignments:tech_house_assignments(house:houses(name), active)")
    .order("last_name");

  return (
    <div className="stack">
      <FounderNav active="techs" />
      <h1>Techs</h1>
      {sp.ok && <p className="banner ok">Saved.</p>}
      {(techs ?? []).map((t: any) => (
        <form action={saveTechAction} className="card stack" key={t.id}>
          <input type="hidden" name="id" value={t.id} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{t.first_name} {t.last_name}</strong>
            <span className="pill">semester {t.semester_number}</span>
          </div>
          <p className="fine">
            Houses: {(t.assignments ?? []).filter((a: any) => a.active).map((a: any) => a.house?.name).join(", ") || "none"}
          </p>
          <div className="row">
            <label style={{ flex: 1 }}>Status
              <select name="status" defaultValue={t.status}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>Semester #
              <input name="semester_number" type="number" min="1" defaultValue={t.semester_number} className="short" />
            </label>
          </div>
          <button className="btn small" type="submit">Save</button>
        </form>
      ))}
      {(techs ?? []).length === 0 && <p className="muted">No techs yet.</p>}
    </div>
  );
}
