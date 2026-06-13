import { notFound } from "next/navigation";
import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saveHouseAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["prospect", "active", "paused", "churned"];

export default async function HouseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { data: house } = await supabaseAdmin().from("houses").select("*").eq("id", id).maybeSingle();
  if (!house) notFound();

  return (
    <div className="stack">
      <FounderNav active="houses" />
      <h1>{house.name}</h1>
      {sp.ok && <p className="banner ok">Saved.</p>}

      <form action={saveHouseAction} className="stack card">
        <input type="hidden" name="id" value={house.id} />
        <h2>Pipeline & contact</h2>
        <label>
          Status
          <select name="status" defaultValue={house.status}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          House director name
          <input name="house_director_name" defaultValue={house.house_director_name ?? ""} />
        </label>
        <label>
          Director contact (founder-only — never shown to techs)
          <input name="house_director_contact" defaultValue={house.house_director_contact ?? ""} />
        </label>
        <label>
          Access notes (visible to techs)
          <input name="access_notes" defaultValue={house.access_notes ?? ""} />
        </label>
        <label>
          Insurance / documents note
          <input name="insurance_note" defaultValue={house.insurance_note ?? ""} placeholder="link or note for the COI on file" />
        </label>
        <button className="btn" type="submit">Save</button>
      </form>

      <div className="card">
        <h2>Visit cadence</h2>
        <p className="muted">
          Weekday {house.visit_weekday} · {house.visit_cadence} · {house.visit_window_start}–{house.visit_window_end} ·
          {" "}{house.slot_duration_minutes}-min slots · ${Math.round(house.monthly_price_cents / 100)}/mo
        </p>
        <p className="fine">Edit cadence in the visits calendar or directly in the database for now.</p>
      </div>
    </div>
  );
}
