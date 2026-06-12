import twilio from "twilio";

// Phone numbers are PII — never log them raw (spec §12).
function mask(phone: string): string {
  return `***${phone.slice(-4)}`;
}

// All outbound SMS goes through the single brand number. When Twilio env is
// absent (local dev), messages print to the server console instead of failing,
// so the whole flow is testable without credentials.
export async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_BRAND_NUMBER;

  if (!sid || !token || !from) {
    console.log(`[sms:dev] to ${mask(to)}: ${body}`);
    return;
  }

  try {
    await twilio(sid, token).messages.create({ to, from, body });
  } catch (err) {
    console.error(`[sms] send failed to ${mask(to)}:`, err);
  }
}
