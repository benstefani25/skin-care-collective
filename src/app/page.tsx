import Link from "next/link";
import { config } from "@/config/app";
import { Wordmark, SunMark } from "@/components/Wordmark";

export const metadata = {
  title: `${config.brandName} — a fresh glow, delivered to your house`,
  description:
    "Recurring, skin-conscious spray tans delivered to your sorority house on a set schedule. One flat monthly membership, booked in seconds.",
};

const STEPS = [
  { icon: "🔗", title: "Join through your house", body: "Tap your house's link, pick monthly or semester, add a card. About two minutes." },
  { icon: "🏠", title: "We come to you", body: "Your tech arrives on your house's set visit days. You're auto-booked each time — skip or move any visit with one tap." },
  { icon: "✨", title: "Glow, on repeat", body: "Show up, get your tan, go. No salon, no checkout, no thinking about it." },
];

const FAQ = [
  { q: "What kind of tan is this?", a: "A classic sunless spray tan using DHA, the same cosmetic ingredient salons use. It's a temporary bronze that develops over a few hours and fades gradually — no UV, no booth." },
  { q: "How is this gentler on my routine?", a: "Because prep and timing matter, we send you simple before-and-after steps so you get an even, longer-lasting result without the guesswork. You control your shade and can pause anytime." },
  { q: "What does membership include?", a: "A set number of visits to your house each month at one flat price, your shade kept on file, and one-tap rescheduling. Card on file — you never pay at an appointment." },
  { q: "Can I pause or cancel?", a: "Anytime, right from your account — great for summer or finals. A paused membership isn't a cancelled one; you keep your spot for when you're back." },
];

export default function Home() {
  return (
    <div className="marketing">
      <section className="hero">
        <Wordmark size={24} />
        <h1>
          A fresh glow, <em>without leaving the house.</em>
        </h1>
        <p className="lede">
          Skin-conscious spray tans, delivered to your house on a set schedule. One flat monthly
          membership — join online in about two minutes, then book, skip, or reschedule right here.
        </p>
        <div className="hero-actions">
          <Link className="btn full" href="/signup">
            Join your house
          </Link>
          <Link className="btn secondary full" href="/login">
            Member login
          </Link>
        </div>
        <p className="trust">Card on file · pause or cancel anytime · never pay at your appointment</p>
      </section>

      <section className="mk-section">
        <h2>How it works</h2>
        <div className="mk-steps">
          {STEPS.map((s, i) => (
            <div className="mk-step" key={i}>
              <div className="mk-step-num" aria-hidden="true">{i + 1}</div>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section mk-band">
        <span className="mk-sun"><SunMark size={28} /></span>
        <h2>Skin-conscious by design</h2>
        <p className="muted">
          A spray tan is a cosmetic glow, not a tanning bed — no UV exposure. We lean into doing it
          well: the right prep, an even application from a trained tech, and clear aftercare so your
          color looks natural and lasts. You pick your shade, and we keep it on file so every visit
          matches the last.
        </p>
        <p className="fine">
          Cosmetic sunless tanning (DHA). Results vary by skin and prep. Not a sunscreen and not a
          substitute for sun protection.
        </p>
      </section>

      <section className="mk-section">
        <h2>Prep &amp; aftercare, made simple</h2>
        <div className="mk-cols">
          <div className="card">
            <h3>Before</h3>
            <ul className="mk-list">
              <li>Shower &amp; exfoliate</li>
              <li>Skip lotion, deodorant &amp; makeup</li>
              <li>Wear loose, dark clothing</li>
            </ul>
          </div>
          <div className="card">
            <h3>After</h3>
            <ul className="mk-list">
              <li>Avoid water &amp; sweat ~8 hours</li>
              <li>First rinse: lukewarm, no soap</li>
              <li>Moisturize daily to extend it</li>
            </ul>
          </div>
        </div>
        <p className="fine">We text these to you before every visit — no need to memorize.</p>
      </section>

      <section className="mk-section">
        <h2>Why members love it</h2>
        <div className="mk-benefits">
          <div className="mk-benefit"><strong>It comes to you.</strong> No driving to a salon between classes.</div>
          <div className="mk-benefit"><strong>One flat price.</strong> Membership, not per-visit sticker shock.</div>
          <div className="mk-benefit"><strong>Auto-booked.</strong> You&apos;re on the schedule without lifting a finger.</div>
          <div className="mk-benefit"><strong>Yours to control.</strong> Shade on file, skip or pause anytime.</div>
        </div>
      </section>

      <section className="mk-section">
        <h2>Questions</h2>
        {FAQ.map((f, i) => (
          <details className="mk-faq" key={i}>
            <summary>{f.q}</summary>
            <p className="muted">{f.a}</p>
          </details>
        ))}
      </section>

      <section className="mk-section mk-cta">
        <h2>Ready to glow?</h2>
        <p className="muted">Join through your house&apos;s link and you&apos;re set for the season.</p>
        <Link className="btn full" href="/signup">
          Join your house
        </Link>
        <p className="fine">
          Want {config.brandName} at your house? Text us — we&apos;re adding houses each semester.
        </p>
      </section>

      <footer className="mk-footer">
        <Wordmark size={16} />
        <p className="fine">Cosmetic sunless tanning · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
