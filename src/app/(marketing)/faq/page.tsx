import Link from "next/link";
import { copy } from "@/config/copy";

export const metadata = { title: `FAQ` };

export default function Faq() {
  return (
    <div className="stack mk-narrow">
      <h1>Questions</h1>
      {copy.faqItems.map((f, i) => (
        <details className="mk-faq" key={i}>
          <summary>{f.q}</summary>
          <p className="muted">{f.a}</p>
        </details>
      ))}
      <p className="fine">{copy.marketing.noSunProtection}</p>
      <Link className="btn full" href="/find">{copy.marketing.ctaFindHouse}</Link>
    </div>
  );
}
