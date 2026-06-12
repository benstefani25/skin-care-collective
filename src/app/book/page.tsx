import { config } from "@/config/app";
import { Nav } from "@/components/Nav";
import { requireMember } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate, fmtTime, hoursUntil, slotStart, todayISO } from "@/lib/time";
import { bookAction, cancelAction, rescheduleAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  slot_taken: "Sorry — that time was just taken. Pick another?",
  past_due: "There's a payment issue on your membership. Fix it under Account → Manage billing, then book away.",
  membership_inactive: "Your membership isn't active yet — finish signup or text us.",
  slot_in_past: "That time has already passed.",
  visit_unavailable: "That visit isn't taking bookings.",
  not_yours: "That appointment isn't on your account.",
  not_booked: "That appointment was already changed.",
  already_started: "That appointment has already started.",
};

const OKS: Record<string, string> = {
  booked: "You're booked!",
  cancelled: "Cancelled — your spot is freed up.",
  cancelled_late: "Cancelled. Heads up: it was inside the change window, so it's recorded as a late cancel (no fee).",
  moved: "Done — you're moved.",
  moved_late: "Done — you're moved. It was inside the change window, so the old slot is recorded as a late change (no fee).",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const member = await requireMember();
  const db = supabaseAdmin();
  const now = new Date();

  const { data: apptsRaw } = await db
    .from("appointments")
    .select("*, slot:slots(*, visit:visits(*))")
    .eq("member_id", member.id)
    .eq("status", "booked");
  const appts = (apptsRaw ?? [])
    .filter((a: any) => a.slot?.visit && slotStart(a.slot.visit.date, a.slot.start_time) > now)
    .sort((a: any, b: any) =>
      `${a.slot.visit.date}T${a.slot.start_time}`.localeCompare(`${b.slot.visit.date}T${b.slot.start_time}`)
    );

  const { data: visitsRaw } = await db
    .from("visits")
    .select("*, slots(*)")
    .eq("house_id", member.house_id)
    .gte("date", todayISO())
    .in("status", ["scheduled", "under_threshold"])
    .order("date");
  const visits = (visitsRaw ?? []).map((v: any) => ({
    ...v,
    openSlots: (v.slots ?? [])
      .filter((s: any) => s.status === "open" && slotStart(v.date, s.start_time) > now)
      .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time)),
  }));
  const allOpen = visits.flatMap((v: any) =>
    v.openSlots.map((s: any) => ({ slot: s, date: v.date }))
  );

  return (
    <div className="stack">
      <Nav active="book" />
      {sp.error && <p className="banner error">{ERRORS[sp.error] ?? "Something went wrong — try again."}</p>}
      {sp.ok && <p className="banner ok">{OKS[sp.ok] ?? "Done!"}</p>}
      {member.status === "past_due" && (
        <p className="banner error">
          Your last payment didn&apos;t go through — update your card under Account → Manage
          billing.
        </p>
      )}

      <section>
        <h2>Your appointments</h2>
        {appts.length === 0 && <p className="muted">Nothing booked yet — grab a time below.</p>}
        {appts.map((a: any) => {
          const start = slotStart(a.slot.visit.date, a.slot.start_time);
          const late = hoursUntil(start) < config.cancellationWindowHours;
          return (
            <div className="card" key={a.id}>
              <strong>
                {fmtDate(a.slot.visit.date)} · {fmtTime(a.slot.start_time)}
              </strong>
              {a.room && <div className="muted">Room {a.room}</div>}
              {late && (
                <p className="fine">
                  Within the {config.cancellationWindowHours}-hour window — changes are recorded
                  as late (no fee).
                </p>
              )}
              <div className="row">
                {allOpen.length > 0 && (
                  <form action={rescheduleAction} className="row">
                    <input type="hidden" name="appointment_id" value={a.id} />
                    <select name="slot_id" required defaultValue="">
                      <option value="" disabled>
                        Move to…
                      </option>
                      {allOpen.map(({ slot, date }: any) => (
                        <option key={slot.id} value={slot.id}>
                          {fmtDate(date)} {fmtTime(slot.start_time)}
                        </option>
                      ))}
                    </select>
                    <button className="btn small" type="submit">
                      Move
                    </button>
                  </form>
                )}
                <form action={cancelAction}>
                  <input type="hidden" name="appointment_id" value={a.id} />
                  <button className="btn small danger" type="submit">
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2>Upcoming visits at your house</h2>
        {visits.length === 0 && (
          <p className="muted">No visits on the calendar yet — we&apos;ll text you when one is.</p>
        )}
        {visits.map((v: any) => (
          <div className="card" key={v.id}>
            <strong>{fmtDate(v.date)}</strong>
            {v.openSlots.length === 0 ? (
              <p className="muted">Fully booked.</p>
            ) : (
              <form action={bookAction} className="row">
                <select name="slot_id" required defaultValue="">
                  <option value="" disabled>
                    Pick a time…
                  </option>
                  {v.openSlots.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {fmtTime(s.start_time)}
                    </option>
                  ))}
                </select>
                <input name="room" className="short" placeholder="Room #" />
                <button className="btn small" type="submit">
                  Book
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
