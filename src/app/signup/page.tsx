// Public /signup no longer lists houses (T2-4 — no enumerating all houses).
// Members join through their house's own link/QR (/join/<token>). This page is
// just a friendly pointer for anyone who lands here directly.
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function SignupPointer() {
  return (
    <div className="stack">
      <Wordmark size={22} />
      <h1>Join through your house</h1>
      <p className="muted">
        Each house has its own sign-up link. Scan the QR code posted at your house, or ask your
        house rep for the link — it takes about two minutes.
      </p>
      <div className="card">
        <h2>Already a member?</h2>
        <p className="muted">Log in to book, reschedule, or manage your membership.</p>
        <Link className="btn secondary full" href="/login">
          Member login
        </Link>
      </div>
      <p className="fine">
        Can&apos;t find your link? Text us and we&apos;ll send it over.
      </p>
    </div>
  );
}
