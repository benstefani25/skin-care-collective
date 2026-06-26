import Link from "next/link";
import { copy } from "@/config/copy";

export const metadata = { title: `Tan Care — preparation & aftercare` };

export default function TanCare() {
  const t = copy.tanCare;
  return (
    <div className="stack mk-narrow">
      {/* Preparation */}
      <h1>{t.prepTitle}</h1>
      <p className="muted">{t.prepIntro}</p>
      <section className="card">
        <h2>{t.prepBeforeTitle}</h2>
        <ul className="mk-list">{t.prepBefore.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
      <section className="card">
        <h2>{t.prepDayOfTitle}</h2>
        <ul className="mk-list">{t.prepDayOf.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
      <p className="fine">{t.prepExpressNote}</p>

      <hr className="divider" />

      {/* Aftercare */}
      <h2 style={{ fontSize: "1.5rem" }}>{t.aftercareTitle}</h2>
      <p className="muted">{t.aftercareIntro}</p>
      <section className="card">
        <h3>{t.aftercareRightAfterTitle}</h3>
        <ul className="mk-list">{t.aftercareRightAfter.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
      <section className="card">
        <h3>{t.rinseTitle}</h3>
        <p className="muted">{t.rinseIntro}</p>
        <ul className="mk-list">{t.rinseLines.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <p className="fine">{t.rinseHow}</p>
      </section>
      <section className="card">
        <h3>{t.aftercareDaysTitle}</h3>
        <ul className="mk-list">{t.aftercareDays.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>
      <section className="card">
        <h3>{t.betweenTitle}</h3>
        <p className="muted">{t.betweenBody}</p>
      </section>

      <p className="banner ok">{copy.marketing.noSunProtection}</p>
      <Link className="btn full" href="/find">{copy.marketing.ctaFindHouse}</Link>
    </div>
  );
}
