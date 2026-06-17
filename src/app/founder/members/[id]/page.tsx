import { notFound } from "next/navigation";
import { config } from "@/config/app";
import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate, fmtTime, slotStart } from "@/lib/time";
import { saveMemberAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "paused", "past_due", "cancelled", "pending"];

export default async function MemberDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const db = supabaseAdmin();
  const { data: m } = await db.from("members").select("*, house:houses(name)").eq("id", id).maybeSingle();
  if (!m) notFound();

  const { data: appts } = await db
    .from("appointments")
    .select("id, status, slot:slots(start_time, visit:visits(date))")
    .eq("member_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Referral attribution (T2-8): how many signups name this member as referrer.
  const { count: referredCount } = await db
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_member_id", id);
  const { data: house } = await db.from("houses").select("signup_token").eq("id", m.house_id).maybeSingle();
  const referralLink =
    m.is_liaison && m.referral_code && house?.signup_token
      ? `${config.appBaseUrl}/join/${house.signup_token}?ref=${m.referral_code}`
      : null;

  return (
    <div className="stack">
      <FounderNav active="members" />
      <h1>{m.first_name} {m.last_name}</h1>
      {sp.ok && <p className="banner ok">Saved.</p>}

      <div className="card">
        <p><strong>Phone:</strong> {m.phone}</p>
        <p><strong>Email:</strong> {m.email}</p>
        <p><strong>House:</strong> {m.house?.name ?? "—"}</p>
        <p className="fine">Stripe customer: {m.stripe_customer_id ?? "none"}</p>
      </div>

      <form action={saveMemberAction} className="stack card">
        <input type="hidden" name="id" value={m.id} />
        <h2>Edit</h2>
        <label>Status
          <select name="status" defaultValue={m.status}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Shade preference
          <input name="shade_preference" defaultValue={m.shade_preference ?? ""} />
        </label>
        <label>Service notes (visible to techs)
          <input name="service_notes" defaultValue={m.service_notes ?? ""} />
        </label>
        <label className="check">
          <input type="checkbox" name="standing_appointment" defaultChecked={m.standing_appointment} />
          <span>Auto-book each visit (standing)</span>
        </label>
        <label className="check">
          <input type="checkbox" name="is_liaison" defaultChecked={m.is_liaison} />
          <span>House liaison (rep) — gets a referral link</span>
        </label>
        <button className="btn" type="submit">Save</button>
      </form>

      {m.is_liaison && (
        <div className="card">
          <h2>Liaison</h2>
          <p><strong>{referredCount ?? 0}</strong> signups attributed to her.</p>
          {referralLink ? (
            <>
              <p className="fine">Her referral link (signups through it are credited to her):</p>
              <input readOnly value={referralLink} />
            </>
          ) : (
            <p className="muted">Save to generate her referral link.</p>
          )}
          <p className="fine">
            Reward model (flat stipend vs. reduced/free membership vs. per-signup) is a founder
            decision — not wired yet. This only tracks attribution.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Appointment history</h2>
        {(appts ?? []).length === 0 && <p className="muted">None yet.</p>}
        {(appts ?? []).map((a: any) => (
          <p key={a.id} className="row" style={{ justifyContent: "space-between" }}>
            <span>{a.slot?.visit ? `${fmtDate(a.slot.visit.date)} ${fmtTime(a.slot.start_time)}` : "—"}</span>
            <span className="pill">{a.status}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
