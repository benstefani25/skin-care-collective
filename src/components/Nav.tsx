import Link from "next/link";
import { config } from "@/config/app";

export function Nav({ active }: { active: "book" | "account" }) {
  return (
    <header className="nav">
      <span className="brand">{config.brandName}</span>
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
