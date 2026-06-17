import { supabaseAdmin } from "./supabase/admin";
import type { Json } from "./supabase/database.types";

export type ActorType = "member" | "tech" | "founder" | "system" | "ai";

export type EventInput = {
  type: string;
  actor_type: ActorType;
  actor_id?: string | null;
  house_id?: string | null;
  member_id?: string | null;
  tech_id?: string | null;
  appointment_id?: string | null;
  payload?: Record<string, unknown>;
};

// Telemetry is the founder's eyes (spec §1) — every meaningful state change
// writes here. A failed event log must never break the user-facing action,
// but it must be loud in server logs.
export async function logEvent(e: EventInput): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("events")
    .insert({ ...e, payload: (e.payload ?? {}) as Json });
  if (error) {
    console.error(`[events] FAILED to log '${e.type}':`, error.message);
  }
}
