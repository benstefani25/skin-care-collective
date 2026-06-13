// Dev harness: feed a text into the concierge exactly as the Twilio webhook
// would, without needing Twilio or a public URL. Replies print to the console.
// Run: npm run sms -- "+15550101000" "can I move my appointment?"
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const [phone, ...words] = process.argv.slice(2);
  const body = words.join(" ");
  if (!phone || !body) {
    console.error('Usage: npm run sms -- "+15551234567" "message text"');
    process.exit(1);
  }
  const { handleInboundSms } = await import("../src/lib/concierge");
  console.log(`>> ${body}`);
  const reply = await handleInboundSms(phone, body);
  console.log(`<< ${reply}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
