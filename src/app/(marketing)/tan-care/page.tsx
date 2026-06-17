import Link from "next/link";
import { copy } from "@/config/copy";

export const metadata = { title: `Tan Care — preparation & aftercare` };

export default function TanCare() {
  const t = copy.tanCare;
  return (
    <div className="stack mk-narrow">
      <h1>{t.title}</h1>
      <p className="muted">{t.intro}</p>

      <section className="card">
        <h2>{t.prepTitle}</h2>
        <ul className="mk-list">{t.prep.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>

      <section className="card">
        <h2>{t.aftercareTitle}</h2>
        <ul className="mk-list">{t.aftercare.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </section>

      <section className="card">
        <h2>{t.rinseTitle}</h2>
        <p className="muted">{t.rinseIntro}</p>
        <table className="data">
          <thead><tr><th>Shade</th><th>First rinse</th></tr></thead>
          <tbody>
            {t.rinseGuide.map((r) => (
              <tr key={r.shade}><td>{r.shade}</td><td>{r.time}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="fine">{t.rinseNote}</p>
      </section>

      <p className="banner ok">{copy.marketing.noSunProtection}</p>
      <Link className="btn full" href="/find">{copy.marketing.ctaFindHouse}</Link>
    </div>
  );
}
