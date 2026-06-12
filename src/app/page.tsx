import Link from "next/link";
import { config } from "@/config/app";

export default function Home() {
  return (
    <div className="stack">
      <h1>{config.brandName}</h1>
      <p className="muted">
        Recurring spray tans, delivered to your house. Flat monthly membership,
        booked in seconds by text.
      </p>
      <Link className="btn" href="/signup">
        Join your house
      </Link>
      <Link className="btn secondary" href="/login">
        Member login
      </Link>
    </div>
  );
}
