import { requireFounder } from "@/lib/auth";
import { payrollCsv, runPayroll, currentPayPeriod } from "@/lib/payroll";

export async function GET() {
  await requireFounder();
  const rows = await runPayroll();
  const csv = payrollCsv(rows);
  const period = currentPayPeriod();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="payroll-${period.start}.csv"`,
    },
  });
}
