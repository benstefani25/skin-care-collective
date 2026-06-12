// One-tap manage page reached from SMS links — no login required; the signed
// token scopes access to exactly one appointment and dies at its start time.
import { config } from "@/config/app";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/links";
import { fmtDate, fmtTime, hoursUntil, slotStart } from "@/lib/time";
import { oneTapMove, oneTapSkip } from "../actions";

export const dynamic = "force-dynamic";

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="stack">
      <h1>{title}</h1>
      <p className="muted">{body}</p>
    </div>
  );
}

export default async function OneTapPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const payload = verifyToken(token);
  if (!payload || payload.scope !== "appointment") {
    return <Note title="Link expired" body="This link is no longer active. Text us and we'll help you out." />;
  }

  const db = supabaseAdmin();
  const { data: appt } = await db
    .from("appointments")
    .select("*, member:members(first_name), slot:slots(*, visit:visits(*, house:houses(name)))")
    .eq("id", payload.id)
    .maybeSingle();
  if (!appt || !appt.slot?.visit) {
    return <Note title="Link expired" body="This link is no longer active. Text us and we'll help you out." />;
  }

  if (sp.done === "moved") {
    return (
      <Note
        title="You're moved!"
        body="All set — we'll text you a reminder before your new time."
      />
    );
  }
  if (sp.done === "skipped" || appt.status !== "booked") {
    return (
      <Note
        title={sp.done === "skipped" ? "You're skipped for this visit" : "Already updated"}
        body="No problem — you'll still be auto-booked for the next visit as usual."
      />
    );
  }

  const start = slotStart(appt.slot.visit.date, appt.slot.start_time);
  const late = hoursUntil(start) < config.cancellationWindowHours;

  const { data: openSlots } = await db
    .from("slots")
    .select("*")
    .eq("visit_id", appt.slot.visit_id)
    .eq("status", "open")
    .order("start_time");
  const stillOpen = (openSlots ?? []).filter(
    (s: any) => slotStart(appt.slot.visit.date, s.start_time) > new Date()
  );

  return (
    <div className="stack">
      <h1>Hi {appt.member?.first_name ?? "there"}!</h1>
      <div className="card">
        <strong>
          {fmtDate(appt.slot.visit.date)} · {fmtTime(appt.slot.start_time)}
        </strong>
        <p className="muted">Your spray tan appointment</p>
        {late && (
          <p className="fine">
            Heads up — this is within the {config.cancellationWindowHours}-hour window, so changes
            are recorded as late (no fee).
          </p>
        )}
      </div>

      {sp.error && <p className="banner error">That didn&apos;t work — the time may have just been taken.</p>}

      {stillOpen.length > 0 && (
        <form action={oneTapMove} className="row">
          <input type="hidden" name="token" value={token} />
          <select name="slot_id" required defaultValue="">
            <option value="" disabled>
              Move to another time…
            </option>
            {stillOpen.map((s: any) => (
              <option key={s.id} value={s.id}>
                {fmtTime(s.start_time)}
              </option>
            ))}
          </select>
          <button className="btn small" type="submit">
            Move
          </button>
        </form>
      )}

      <form action={oneTapSkip}>
        <input type="hidden" name="token" value={token} />
        <button className="btn danger" type="submit">
          Skip this visit
        </button>
      </form>
      <p className="fine">
        Skipping only affects this visit — you&apos;ll still be auto-booked next time.
      </p>
    </div>
  );
}
