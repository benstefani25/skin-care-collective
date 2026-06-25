import type { Metadata } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";
import { config } from "@/config/app";

// Display serif with warmth + character; clean humanist sans for body.
// next/font self-hosts and size-adjusts, which kills the font-swap layout
// shift that makes deployed sites feel janky.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const sans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Brand lives in config; page titles set just their own text and the
  // template appends the brand (no hardcoded brand strings in pages).
  title: { default: config.brandName, template: `%s — ${config.brandName}` },
  description: "Recurring spray tans, delivered to your house.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
