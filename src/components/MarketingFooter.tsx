import Link from "next/link";
import { copy } from "@/config/copy";
import { config } from "@/config/app";
import { Wordmark } from "@/components/Wordmark";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <Wordmark size={16} />
      <nav className="mk-footer-nav">
        {copy.marketing.navItems.map((n) => (
          <Link key={n.href} href={n.href}>{n.label}</Link>
        ))}
        <Link href="/bring-scc">{copy.marketing.ctaBringScc}</Link>
      </nav>
      <p className="fine">{copy.marketing.footerTagline} · {config.brandName} · {new Date().getFullYear()}</p>
      <p className="fine">{copy.marketing.noSunProtection}</p>
    </footer>
  );
}
