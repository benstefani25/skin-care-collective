import Link from "next/link";
import { copy } from "@/config/copy";
import { Wordmark } from "@/components/Wordmark";

// Shared marketing header (W-3): wordmark left, nav center, quiet member-login
// link + the primary "Find your house" button right. Mobile collapses the nav
// into a native <details> menu — no JS dependency.
export function MarketingHeader() {
  const { navItems } = copy.marketing;
  return (
    <header className="mk-header">
      <div className="mk-header-row">
        <Link href="/" className="mk-brand" aria-label="Home">
          <Wordmark size={20} />
        </Link>

        <nav className="mk-nav-desktop">
          {navItems.map((n) => (
            <Link key={n.href} href={n.href}>{n.label}</Link>
          ))}
        </nav>

        <div className="mk-header-actions">
          <Link href="/login" className="mk-login">{copy.marketing.memberLogin}</Link>
          <Link href="/signup" className="btn small">{copy.marketing.ctaFindHouse}</Link>
        </div>

        <details className="mk-menu">
          <summary aria-label="Menu"><i className="mk-burger" aria-hidden="true">≡</i></summary>
          <div className="mk-menu-panel">
            {navItems.map((n) => (
              <Link key={n.href} href={n.href}>{n.label}</Link>
            ))}
            <Link href="/signup">{copy.marketing.ctaFindHouse}</Link>
            <Link href="/login" className="muted">{copy.marketing.memberLogin}</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
