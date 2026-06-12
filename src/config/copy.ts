// Every customer-facing string lives here, keyed off the configurable brand
// name. Tone: warm, concise, competent front desk — no emoji spam.
import { config } from "./app";

export const copy = {
  smsStandingConfirm: (firstName: string, dateStr: string, timeStr: string, link: string) =>
    `Hi ${firstName}! You're booked for your ${config.brandName} tan on ${dateStr} at ${timeStr}. ` +
    `Need a different time, or want to skip this visit? One tap: ${link}`,

  smsReminder48: (dateStr: string, timeStr: string, link: string) =>
    `Reminder from ${config.brandName}: your tan is ${dateStr} at ${timeStr}. ` +
    `Reschedule or cancel here: ${link}`,

  smsReminder3: (timeStr: string) =>
    `See you at ${timeStr}! Quick prep: shower & exfoliate beforehand, skip lotion and deodorant, ` +
    `and wear loose, dark clothing after. — ${config.brandName}`,

  smsMissedYou: (link: string) =>
    `We missed you today! Want to grab a spot at the next visit? ${link} — ${config.brandName}`,

  smsPaymentFailed: (link: string) =>
    `Hi! Your ${config.brandName} membership payment didn't go through — usually just an expired card. ` +
    `Update it in a minute here: ${link}`,

  standingExplanation:
    "We'll auto-book you each visit; skip any time with one tap.",
};
