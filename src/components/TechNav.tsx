import Link from "next/link";
import { config } from "@/config/app";

export function TechNav({ active }: { active: "today" | "earnings" | "messages" | "copilot" }) {
  return (
    <header className="nav">
      <span className="brand">{config.brandName}</span>
      <nav>
        <Link href="/tech" className={active === "today" ? "on" : ""}>
          Today
        </Link>
        <Link href="/tech/messages" className={active === "messages" ? "on" : ""}>
          Messages
        </Link>
        <Link href="/tech/copilot" className={active === "copilot" ? "on" : ""}>
          Copilot
        </Link>
        <Link href="/tech/earnings" className={active === "earnings" ? "on" : ""}>
          Earnings
        </Link>
        <Link href="/set-password">Password</Link>
      </nav>
    </header>
  );
}
