import Link from "next/link";
import { config } from "@/config/app";

export default function DonePage() {
  return (
    <div className="stack">
      <h1>You&apos;re in! 🎉</h1>
      <p>
        Welcome to {config.brandName}. Watch for a text from us — that number is your front desk
        for booking, rescheduling, and questions.
      </p>
      <p className="muted">
        We&apos;ll automatically book you into each visit at your house and text you a
        confirmation with a one-tap link to move or skip it.
      </p>
      <Link className="btn secondary" href="/book">
        See upcoming visits
      </Link>
    </div>
  );
}
