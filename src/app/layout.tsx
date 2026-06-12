import type { Metadata } from "next";
import "./globals.css";
import { config } from "@/config/app";

export const metadata: Metadata = {
  title: config.brandName,
  description: "Recurring spray tans, delivered to your house.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
