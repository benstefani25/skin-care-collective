import Link from "next/link";
import { config } from "@/config/app";

export function TechNav({ active }: { active: "today" | "earnings" }) {
  return (
    <header className="nav">
      <span className="brand">{config.brandName}</span>
      <nav>
        <Link href="/tech" className={active === "today" ? "on" : ""}>
          Today
        </Link>
        <Link href="/tech/earnings" className={active === "earnings" ? "on" : ""}>
          Earnings
        </Link>
      </nav>
    </header>
  );
}
