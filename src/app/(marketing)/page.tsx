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
      {/* Editorial "Treatment B" hero: full-bleed, warm gradient standing in
          for future photography, dark scrim for legibility. Content + links
          unchanged. To drop in a real photo later, swap --hero-bg in globals. */}
      <section className="editorial-hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">{m.heroEyebrow}</p>
            <h1>{m.heroHeadline}</h1>
            <p className="hero-sub">{m.heroLede}</p>
            <div className="hero-actions">
              <Link className="btn btn-cream" href="/signup">{m.ctaFindHouse}</Link>
              <Link className="btn btn-outline" href="/request-house">{m.ctaBringScc}</Link>
            </div>
            <p className="hero-trust">{m.heroTrust}</p>
          </div>
        </div>
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
          <Link className="btn full" href="/signup">{m.ctaFindHouse}</Link>
          <Link className="btn secondary full" href="/request-house">{m.ctaBringScc}</Link>
        </div>
      </section>
    </div>
  );
}
