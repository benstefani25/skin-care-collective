import Link from "next/link";
import { config } from "@/config/app";

const TABS: Array<{ key: string; href: string; label: string }> = [
  { key: "home", href: "/founder", label: "Exceptions" },
  { key: "houses", href: "/founder/houses", label: "Houses" },
  { key: "members", href: "/founder/members", label: "Members" },
  { key: "techs", href: "/founder/techs", label: "Techs" },
  { key: "visits", href: "/founder/visits", label: "Visits" },
  { key: "payroll", href: "/founder/payroll", label: "Payroll" },
  { key: "ops", href: "/founder/ops", label: "Ops" },
  { key: "digest", href: "/founder/digest", label: "Digest" },
];

export function FounderNav({ active }: { active: string }) {
  return (
    <header className="nav founder-nav">
      <span className="brand">{config.brandName} · Console</span>
      <nav>
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={active === t.key ? "on" : ""}>
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
