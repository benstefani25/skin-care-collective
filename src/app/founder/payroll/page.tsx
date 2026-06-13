import { FounderNav } from "@/components/FounderNav";
import { runPayroll, currentPayPeriod } from "@/lib/payroll";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const period = currentPayPeriod();
  const rows = await runPayroll();
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <div className="stack">
      <FounderNav active="payroll" />
      <h1>Payroll</h1>
      <p className="muted">
        Current period: {fmtDate(period.start)} – {fmtDate(period.end)} (biweekly)
      </p>
      <a className="btn" href="/founder/payroll/export">Download CSV</a>

      <table className="data">
        <thead>
          <tr>
            <th>Tech</th><th>Tans</th><th>Base</th><th>Hours</th><th>Floor top-up</th><th>Deferred bal.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tech}>
              <td>{r.tech}</td>
              <td>{r.completed_tans}</td>
              <td>{dollars(r.base_pay_cents)}</td>
              <td>{r.hours_worked}</td>
              <td>{dollars(r.wage_floor_topup_cents)}</td>
              <td>{dollars(r.deferred_balance_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">No active techs.</p>}
      <p className="fine">
        Base pay counts toward the wage floor; deferred accruals never do. Top-ups are written to
        the bonus ledger automatically and logged.
      </p>
    </div>
  );
}
