// Public-form lead capture (W-6 / W-9). Zero schema change: leads are written
// to the append-only events log (the founder reads them in the console / via
// the ops agent), and the founder is notified by SMS when FOUNDER_PHONE is set.
import { config } from "@/config/app";
import { logEvent } from "./events";
import { sendSms } from "./twilio";

export type LeadKind = "house_lead" | "contact";

export async function captureLead(kind: LeadKind, payload: Record<string, string>): Promise<void> {
  await logEvent({
    type: kind === "house_lead" ? "house_lead.submitted" : "contact.submitted",
    actor_type: "system",
    payload,
  });

  const founderPhone = process.env.FOUNDER_PHONE;
  if (founderPhone) {
    const who = payload.name ? `${payload.name}` : "Someone";
    const where = payload.campus || payload.house ? ` (${[payload.house, payload.campus].filter(Boolean).join(", ")})` : "";
    const label = kind === "house_lead" ? "New house interest" : "New contact message";
    await sendSms(
      founderPhone,
      `[${config.brandName}] ${label}: ${who}${where}. Contact: ${payload.contact ?? "n/a"}. Check the console.`
    );
  }
}
