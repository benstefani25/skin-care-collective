import Link from "next/link";
import { copy } from "@/config/copy";

export const metadata = { title: `How it works` };

export default function HowItWorks() {
  const h = copy.howItWorks;
  return (
    <div className="stack mk-narrow">
      <h1>{h.title}</h1>
      <p className="muted">{h.intro}</p>

      {/* Stacked, click-to-expand steps (was a long-skinny row). First one
          open by default so the page doesn't read as all-collapsed. */}
      <div className="mk-accordion">
        {h.steps.map((s, i) => (
          <details className="mk-acc-item" key={i} open={i === 0}>
            <summary>
              <span className="mk-acc-num" aria-hidden="true">{i + 1}</span>
              <span className="mk-acc-title">{s.title}</span>
            </summary>
            <p className="muted">{s.body}</p>
          </details>
        ))}
      </div>

      <section className="card mk-band" style={{ textAlign: "center" }}>
        <h2>{h.sameGlowTitle}</h2>
        <p className="muted">{h.sameGlowBody}</p>
      </section>

      <section>
        <h2>{h.expectTitle}</h2>
        <p className="muted">{h.expectIntro}</p>
        <div className="mk-steps">
          {h.expectSteps.map((s, i) => (
            <div className="mk-step" key={i}>
              <div className="mk-step-num" aria-hidden="true">{i + 1}</div>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Link className="btn full" href="/find">{copy.marketing.ctaFindHouse}</Link>
    </div>
  );
}
