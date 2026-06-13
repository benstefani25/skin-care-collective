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
        Your tan tech comes to you on a set schedule. One flat monthly membership, booked in
        seconds by text — no salon, no checkout, no hassle.
      </p>
      <div className="hero-actions">
        <Link className="btn full" href="/signup">
          Join your house
        </Link>
        <Link className="btn secondary full" href="/login">
          Member login
        </Link>
      </div>
      <p className="trust">Card on file · cancel or pause anytime · never pay at your appointment</p>
    </div>
  );
}
