import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

// Shared layout for every public marketing page (W-3). Booking, auth, tech,
// and founder surfaces live outside this group and keep their own chrome.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk-page">
      <MarketingHeader />
      <div className="mk-content">{children}</div>
      <MarketingFooter />
    </div>
  );
}
