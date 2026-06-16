import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <div className="hero">
      <Wordmark size={24} />
      <h1>
        A fresh glow, <em>without leaving the house.</em>
      </h1>
      <p className="lede">
        Join online in about two minutes. Then book, reschedule, or skip your visits right
        here — or just text us. One flat monthly membership, no salon, no checkout.
      </p>
      <div className="hero-actions">
        <Link className="btn full" href="/signup">
          Join your house
        </Link>
        <Link className="btn secondary full" href="/login">
          Member login
        </Link>
      </div>
      <p className="trust">Manage everything online · prefer texting? that works too</p>
      <p className="fine" style={{ marginTop: 6 }}>
        Card on file · cancel or pause anytime · never pay at your appointment
      </p>
    </div>
  );
}
