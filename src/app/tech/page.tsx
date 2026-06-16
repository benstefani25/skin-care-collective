// The run sheet (spec §6). The appointment list is read through the
// tech_runsheet view USING THE TECH'S OWN SESSION — RLS and the view are the
// wall; this page never queries member base tables. First name + last
// initial, time, room, and service notes only.
import { config } from "@/config/app";
import { TechNav } from "@/components/TechNav";
import { requireTech } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { todayVisitForTech } from "@/lib/techops";
import { fmtDate, fmtTime, todayISO } from "@/lib/time";
import {
  apptCheckInAction,
  apptCompleteAction,
  apptNoShowAction,
  runningLateAction,
  visitCheckInAction,
  visitCheckOutAction,
} from "./actions";
import { EndVisitButton } from "./EndVisitButton";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_booked: "That appointment was already updated.",
  not_your_visit: "That visit isn't yours.",
  not_your_appointment: "That appointment isn't on your run sheet.",
  already_checked_in: "Already checked in.",
  not_checked_in: "Check in to the visit first.",
  already_checked_out: "Visit already ended.",
};

export default async function TechToday({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tech = await requireTech();

  if (new Date().getHours() < config.techDayStartHour) {
    return (
      <div className="stack">
        <TechNav active="today" />
        <p className="muted">
          Your run sheet unlocks at {config.techDayStartHour}:00 AM on visit days.
        </p>
      </div>
    );
  }

  const visit = await todayVisitForTech(tech.id);
  if (!visit) {
    return (
      <div className="stack">
        <TechNav active="today" />
        <h1>No visit today</h1>
        <p className="muted">
          Enjoy the day off, {tech.first_name}! Your next run sheet appears here from{" "}
          {config.techDayStartHour}:00 AM on your visit day.
        </p>
      </div>
    );
  }

  // The wall in action: this query runs as the logged-in tech against the
  // RLS-protected view — it can only ever return today's own appointments,
  // and the view has no contact columns to leak.
  const sb = await supabaseServer();
  const { data: runsheet } = await sb
    .from("tech_runsheet")
    .select("*")
    .order("start_time");

  const house = visit.house as unknown as { name: string; address: string; access_notes: string } | null;

  // Completion counter + guard (T1-8): un-actioned = still 'booked'.
  const rows = (runsheet ?? []) as Array<{ status: string }>;
  const totalCount = rows.length;
  const doneCount = rows.filter((r) => r.status === "completed" || r.status === "no_show").length;
  const unfinishedCount = rows.filter((r) => r.status === "booked").length;

  return (
    <div className="stack">
      <TechNav active="today" />
      {sp.error && <p className="banner error">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
      {sp.ok && (
        <p className="banner ok">
          {sp.ok === "late_sent" ? "Sent — today's members know you're running a bit behind." : "Done!"}
        </p>
      )}

      <section className="card">
        <h1>
          {house?.name} · {fmtDate(visit.date)}
        </h1>
        <p className="muted">{house?.address}</p>
        {house?.access_notes && <p className="fine">{house.access_notes}</p>}
        <p className="muted">
          Window: {fmtTime(visit.window_start)} – {fmtTime(visit.window_end)}
        </p>
        <div className="row">
          {!visit.checked_in_at ? (
            <form action={visitCheckInAction}>
              <input type="hidden" name="visit_id" value={visit.id} />
              <button className="btn" type="submit">
                Check in to visit
              </button>
            </form>
          ) : !visit.checked_out_at ? (
            <>
              <EndVisitButton action={visitCheckOutAction} visitId={visit.id} unfinished={unfinishedCount} />
              <form action={runningLateAction}>
                <button className="btn small danger" type="submit">
                  Running ~{config.techLateDefaultMinutes} min late
                </button>
              </form>
            </>
          ) : (
            <p className="banner ok">Visit complete — nice work!</p>
          )}
        </div>
      </section>

      <section>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Run sheet</h2>
          {totalCount > 0 && (
            <span className="pill">{doneCount} of {totalCount} done</span>
          )}
        </div>
        {(runsheet ?? []).length === 0 && <p className="muted">No appointments booked yet.</p>}
        {(runsheet ?? []).map((a: any) => (
          <div className="card" key={a.appointment_id}>
            <strong>
              {fmtTime(a.start_time)} — {a.member_display_name}
            </strong>
            <div className="muted">
              {a.room ? `Room ${a.room}` : "No room given"}
              {a.shade_preference ? ` · shade: ${a.shade_preference}` : ""}
            </div>
            {a.service_notes && <p className="fine">{a.service_notes}</p>}
            {a.status === "completed" && <p className="banner ok">Completed</p>}
            {a.status === "no_show" && <p className="banner error">No-show</p>}
            {a.status === "booked" && (
              <div className="row">
                {!a.checked_in_at && (
                  <form action={apptCheckInAction}>
                    <input type="hidden" name="appointment_id" value={a.appointment_id} />
                    <button className="btn small" type="submit">
                      Check in
                    </button>
                  </form>
                )}
                <form action={apptCompleteAction}>
                  <input type="hidden" name="appointment_id" value={a.appointment_id} />
                  <button className="btn small" type="submit">
                    Complete
                  </button>
                </form>
                <form action={apptNoShowAction}>
                  <input type="hidden" name="appointment_id" value={a.appointment_id} />
                  <button className="btn small danger" type="submit">
                    No-show
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </section>
      <p className="fine">{todayISO()}</p>
    </div>
  );
}
