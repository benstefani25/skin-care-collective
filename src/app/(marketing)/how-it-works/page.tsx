import Link from "next/link";
import { copy } from "@/config/copy";

export const metadata = { title: `How it works` };

export default function HowItWorks() {
  const h = copy.howItWorks;
  return (
    <div className="stack mk-narrow">
      <h1>{h.title}</h1>
      <p className="muted">{h.intro}</p>
      <div className="mk-steps">
        {h.steps.map((s, i) => (
          <div className="mk-step" key={i}>
            <div className="mk-step-num" aria-hidden="true">{i + 1}</div>
            <h3>{s.title}</h3>
            <p className="muted">{s.body}</p>
          </div>
        ))}
      </div>
      <Link className="btn full" href="/find">{copy.marketing.ctaFindHouse}</Link>
    </div>
  );
}
