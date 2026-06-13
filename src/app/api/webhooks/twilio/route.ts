// Inbound SMS webhook (spec §8): Twilio posts form-encoded params here.
// Signature-validated when Twilio credentials are configured; open in local
// dev so simulated texts work.
import twilio from "twilio";
import { config } from "@/config/app";
import { handleInboundSms } from "@/lib/concierge";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const url = `${config.appBaseUrl}/api/webhooks/twilio`;
    if (!twilio.validateRequest(authToken, signature, url, params)) {
      return new Response("Invalid signature", { status: 403 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new Response("Twilio not configured", { status: 503 });
  }

  const from = params.From ?? "";
  const body = (params.Body ?? "").trim();
  if (from && body) {
    // Reply goes out via the REST API inside the handler; respond to the
    // webhook with empty TwiML so Twilio doesn't also send something.
    await handleInboundSms(from, body);
  }

  return new Response(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });
}
