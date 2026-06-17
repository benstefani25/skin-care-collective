import { notFound } from "next/navigation";
import { config } from "@/config/app";
import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addContactAction, deleteContactAction, saveHouseAction } from "./actions";

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
  const db = supabaseAdmin();
  const { data: house } = await db.from("houses").select("*").eq("id", id).maybeSingle();
  if (!house) notFound();
  const { data: contacts } = await db
    .from("house_contacts")
    .select("*")
    .eq("house_id", id)
    .order("created_at");

  return (
    <div className="stack">
      <FounderNav active="houses" />
      <h1>{house.name}</h1>
      {sp.ok && <p className="banner ok">Saved.</p>}

      <div className="card">
        <h2>Sign-up link</h2>
        <p className="muted">Hand this out (or turn it into a QR code) for {house.name}. It only works while the house is active.</p>
        <input readOnly value={`${config.appBaseUrl}/join/${house.signup_token}`} />
        {house.status !== "active" && (
          <p className="fine">This house is <strong>{house.status}</strong> — set it to active below before sharing.</p>
        )}
      </div>

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
        <h2>House contacts</h2>
        <p className="fine">House mom, chapter president, social chair, etc. Founder-only — never shown to techs or members.</p>
        {(contacts ?? []).map((c: any) => (
          <div className="row" key={c.id} style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 8 }}>
            <span>
              <strong>{c.role}:</strong> {c.name}
              {c.contact ? <span className="muted"> · {c.contact}</span> : null}
              {c.notes ? <div className="fine">{c.notes}</div> : null}
            </span>
            <form action={deleteContactAction}>
              <input type="hidden" name="contact_id" value={c.id} />
              <input type="hidden" name="house_id" value={house.id} />
              <button className="btn small danger" type="submit">Remove</button>
            </form>
          </div>
        ))}
        {(contacts ?? []).length === 0 && <p className="muted">No contacts yet.</p>}
        <form action={addContactAction} className="stack" style={{ marginTop: 12 }}>
          <input type="hidden" name="house_id" value={house.id} />
          <div className="row">
            <label style={{ flex: 1 }}>Role<input name="role" placeholder="House mom" required /></label>
            <label style={{ flex: 1 }}>Name<input name="name" required /></label>
          </div>
          <label>Contact (phone/email)<input name="contact" /></label>
          <label>Notes<input name="notes" /></label>
          <button className="btn small secondary" type="submit">Add contact</button>
        </form>
      </div>

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
