import { config } from "@/config/app";

// Sun mark + wordmark — a small bit of brand identity reused across surfaces.
export function SunMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="12" y1="2" x2="12" y2="4.3" />
        <line x1="12" y1="19.7" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4.3" y2="12" />
        <line x1="19.7" y1="12" x2="22" y2="12" />
        <line x1="4.9" y1="4.9" x2="6.5" y2="6.5" />
        <line x1="17.5" y1="17.5" x2="19.1" y2="19.1" />
        <line x1="19.1" y1="4.9" x2="17.5" y2="6.5" />
        <line x1="6.5" y1="17.5" x2="4.9" y2="19.1" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="wordmark">
      <span className="wordmark-sun"><SunMark size={size} /></span>
      <span>{config.brandName}</span>
    </span>
  );
}
