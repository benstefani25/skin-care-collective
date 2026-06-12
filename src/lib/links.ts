import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/config/app";

// HMAC-signed, expiring, single-purpose links — these power one-tap
// reschedule/skip from SMS without requiring a login. Scope is narrow by
// design: an appointment token can only act on that one appointment.

export type LinkScope = "appointment" | "member";
export type LinkPayload = { scope: LinkScope; id: string; exp: number };

function secret(): string {
  return process.env.LINK_SECRET || "dev-link-secret-change-me";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signToken(payload: LinkPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyToken(token: string): LinkPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as LinkPayload;
    if (!payload.scope || !payload.id || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// Valid until the appointment's start time — dead links after the fact.
export function appointmentLink(appointmentId: string, expiresAt: Date): string {
  const token = signToken({
    scope: "appointment",
    id: appointmentId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  return `${config.appBaseUrl}/a/${token}`;
}

export function memberToken(memberId: string, ttlDays = 7): string {
  return signToken({
    scope: "member",
    id: memberId,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  });
}

// Used in dunning SMS — lands on a redirect into the Stripe customer portal.
export function billingLink(memberId: string): string {
  return `${config.appBaseUrl}/billing/${memberToken(memberId)}`;
}
