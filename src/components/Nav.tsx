import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export function Nav({ active }: { active: "book" | "account" }) {
  return (
    <header className="nav">
      <Link href="/book" style={{ textDecoration: "none" }}>
        <Wordmark size={18} />
      </Link>
      <nav>
        <Link href="/book" className={active === "book" ? "on" : ""}>
          Book
        </Link>
        <Link href="/account" className={active === "account" ? "on" : ""}>
          Account
        </Link>
      </nav>
    </header>
  );
}
