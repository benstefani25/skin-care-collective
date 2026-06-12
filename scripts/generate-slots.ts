// Manual slot generation for local dev (production uses the cron route).
// Run: npm run generate-slots
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const { generateVisitsAndSlots } = await import("../src/lib/slots");
  const summary = await generateVisitsAndSlots();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
