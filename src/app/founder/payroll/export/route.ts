import { requireFounder } from "@/lib/auth";
import { payrollCsv, payrollProviderCsv, runPayroll, currentPayPeriod } from "@/lib/payroll";

export async function GET(req: Request) {
  await requireFounder();
  const provider = new URL(req.url).searchParams.get("format") === "provider";
  const rows = await runPayroll();
  const period = currentPayPeriod();
  const csv = provider ? payrollProviderCsv(rows) : payrollCsv(rows);
  const name = provider ? `payroll-provider-${period.start}.csv` : `payroll-${period.start}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
