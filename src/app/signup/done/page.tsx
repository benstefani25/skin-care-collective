import Link from "next/link";
import { config } from "@/config/app";
import { SunMark } from "@/components/Wordmark";

export default function DonePage() {
  return (
    <div className="celebrate stack">
      <div>
        <span className="badge"><SunMark size={34} /></span>
        <h1>You&apos;re in!</h1>
        <p className="muted">
          Welcome to {config.brandName}. Book, reschedule, or skip visits anytime right here on
          the site. Prefer texting? Watch for a text from us — that number is your front desk too.
        </p>
      </div>
      <div className="card" style={{ textAlign: "left" }}>
        <h2>What happens next</h2>
        <p className="muted">
          We&apos;ll automatically book you into each visit at your house and text you a
          confirmation with a one-tap link to move or skip it — no app to open.
        </p>
      </div>
      <Link className="btn secondary full" href="/book">
        See upcoming visits
      </Link>
    </div>
  );
}
