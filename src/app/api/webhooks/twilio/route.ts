// Inbound SMS webhook (spec §8): Twilio posts form-encoded params here.
// Signature-validated when Twilio credentials are configured; open in local
// dev so simulated texts work.
import twilio from "twilio";
import { waitUntil } from "@vercel/functions";
import { config } from "@/config/app";
import { handleInboundSms } from "@/lib/concierge";
import { claimWebhook } from "@/lib/idempotency";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = () => new Response(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });

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
  if (!from || !body) return twiml();

  // Idempotency: Twilio retries on slow/failed responses. Process each
  // MessageSid once; a retry returns immediately without re-running the agent.
  if (!(await claimWebhook("twilio", params.MessageSid ?? ""))) return twiml();

  // The full concierge loop can take several seconds — longer than Twilio's
  // webhook timeout. Acknowledge immediately and finish the work in the
  // background (waitUntil keeps the function alive). The reply is sent via the
  // REST API inside the handler, not via TwiML, so the empty TwiML is correct.
  waitUntil(handleInboundSms(from, body));
  return twiml();
}
