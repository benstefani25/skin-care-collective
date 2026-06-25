import Link from "next/link";
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { fmtUsd, semesterAmountCents } from "@/lib/pricing";

export const metadata = { title: `Membership & pricing` };

export default function Pricing() {
  const p = copy.pricingPage;
  // Config-driven (T1-1) — never hardcode. Shows the standard rate; individual
  // houses can have their own price, confirmed at checkout.
  const monthly = config.defaultMonthlyPriceCents;
  const semester = semesterAmountCents(monthly);

  return (
    <div className="stack mk-narrow">
      <h1>{p.title}</h1>
      <p className="muted">{p.intro}</p>

      <section className="card mk-band" style={{ textAlign: "center" }}>
        <h2>{p.expressTitle}</h2>
        <p className="muted">{p.expressBody}</p>
      </section>

      <div className="mk-cols">
        <div className="card">
          <h3>Monthly</h3>
          <p className="appt-time">{fmtUsd(monthly)}<span className="muted" style={{ fontSize: "1rem" }}>/mo</span></p>
          <p className="fine">Billed monthly · cancel anytime</p>
        </div>
        <div className="card">
          <h3>Semester</h3>
          <p className="appt-time">{fmtUsd(semester)}</p>
          <p className="fine">
            Prepay {config.semesterIntervalMonths} months
            {config.semesterPrepayDiscountPct > 0 ? ` · save ${config.semesterPrepayDiscountPct}%` : ""}
          </p>
        </div>
      </div>
      <p className="fine">Standard rate shown; your house&apos;s exact price is confirmed on the secure checkout page.</p>

      <section className="card">
        <h2>{p.includesTitle}</h2>
        <ul className="mk-list">{p.includes.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>

      <p className="trust">{copy.marketing.neverPayTech}</p>
      <Link className="btn full" href="/find">{copy.marketing.ctaFindHouse}</Link>
    </div>
  );
}
