import { requireFounder } from "@/lib/auth";

// Every /founder route is gated here — one guard, whole console.
export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  await requireFounder();
  return <>{children}</>;
}
