// Payroll CSV (spec §10/§13 M2): per-period base pay + wage-floor true-up +
// deferred ledger summary. Actual payment happens outside the system in MVP.
// Run: npm run payroll [-- YYYY-MM-DD]   (optional period start)
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const { runPayroll, payrollCsv } = await import("../src/lib/payroll");
  const periodStart = process.argv[2];
  const rows = await runPayroll(periodStart);
  console.log(payrollCsv(rows));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
