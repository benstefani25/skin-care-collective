import Link from "next/link";
import { config } from "@/config/app";
import { copy } from "@/config/copy";
import { SunMark } from "@/components/Wordmark";

export const metadata = {
  title: `${config.brandName} — a fresh glow, delivered to your house`,
  description:
    "Recurring, skin-conscious spray tans delivered to your sorority house on a set schedule. One flat monthly membership, booked in seconds.",
};

const TEASERS = [
  { href: "/how-it-works", title: "How it works", body: "We come to you on a set schedule. One flat membership. Book in seconds." },
  { href: "/pricing", title: "Express, as standard", body: "Every tan rinses in 2–4 hours — time it to your shade. No overnight wait." },
  { href: "/tan-care", title: "Tan Care", body: "Simple prep & aftercare for an even, longer-lasting glow." },
];

export default function Home() {
  const m = copy.marketing;
  return (
    <div className="marketing">
      <section className="hero">
        <h1>{m.heroHeadline}</h1>
        <p className="lede">{m.heroLede}</p>
        {/* W-2: two-intent CTAs, both visible on the hero (DECIDED). */}
        <div className="hero-actions">
          <Link className="btn full" href="/find">{m.ctaFindHouse}</Link>
          <Link className="btn secondary full" href="/bring-scc">{m.ctaBringScc}</Link>
        </div>
        <p className="trust">{m.neverPayTech}</p>
      </section>

      <section className="mk-section">
        <div className="mk-teasers">
          {TEASERS.map((t) => (
            <Link key={t.href} href={t.href} className="mk-teaser">
              <span className="mk-teaser-sun"><SunMark size={22} /></span>
              <h3>{t.title}</h3>
              <p className="muted">{t.body}</p>
              <span className="mk-teaser-more">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mk-section mk-cta">
        <h2>Ready to glow?</h2>
        <p className="muted">{m.heroSub}</p>
        <div className="hero-actions">
          <Link className="btn full" href="/find">{m.ctaFindHouse}</Link>
          <Link className="btn secondary full" href="/bring-scc">{m.ctaBringScc}</Link>
        </div>
      </section>
    </div>
  );
}
