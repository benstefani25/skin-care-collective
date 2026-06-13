// Earnings (spec §6): current-period tan count and base pay, with the
// deferred bonus balance PROMINENT — every open of this screen shows the
// number she'd forfeit by leaving. That's the retention feature.
import { config } from "@/config/app";
import { TechNav } from "@/components/TechNav";
import { requireTech } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentPayPeriod, deferredRateForSemester } from "@/lib/payroll";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const tech = await requireTech();
  const db = supabaseAdmin();
  const period = currentPayPeriod();

  const { count: tans } = await db
    .from("appointments")
    .select("id, slot:slots!inner(visit:visits!inner(tech_id, date))", {
      count: "exact",
      head: true,
    })
    .eq("status", "completed")
    .eq("slot.visit.tech_id", tech.id)
    .gte("slot.visit.date", period.start)
    .lt("slot.visit.date", period.end);

  const { data: ledger } = await db.from("bonus_ledger").select("*").eq("tech_id", tech.id);
  let balance = 0;
  for (const row of ledger ?? []) {
    if (row.type === "deferred_accrual" || row.type === "adjustment") balance += row.amount_cents;
    else if (row.type === "payout" || row.type === "forfeiture") balance -= row.amount_cents;
  }

  const basePay = (tans ?? 0) * tech.base_rate_cents;
  const perTan = deferredRateForSemester(tech.semester_number);
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <div className="stack">
      <TechNav active="earnings" />
      <h1>Hi {tech.first_name}!</h1>

      <section className="card" style={{ borderWidth: 2 }}>
        <h2>Your semester bonus</h2>
        <p style={{ fontSize: "2rem", fontWeight: 700, margin: "4px 0" }}>{dollars(balance)}</p>
        <p className="muted">
          Pays out {fmtDate(config.semesterEndDate)} — it grows {dollars(perTan)} with every tan
          you complete.
        </p>
        <p className="fine">
          Your rate goes up each semester you stay: $2.50 → $5.00 → $7.50 per tan.
        </p>
      </section>

      <section className="card">
        <h2>This pay period</h2>
        <p className="muted">
          {fmtDate(period.start)} – {fmtDate(period.end)}
        </p>
        <p>
          <strong>{tans ?? 0}</strong> tans completed · <strong>{dollars(basePay)}</strong> base
          pay
        </p>
        <p className="fine">
          Base rate: {dollars(tech.base_rate_cents)} per completed tan. Paid biweekly.
        </p>
      </section>
    </div>
  );
}
