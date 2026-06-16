// Webhook idempotency (T1-3, T1-4). claimWebhook returns true the FIRST time a
// (provider, external_id) is seen and false on every retry, so callers can skip
// reprocessing. The unique constraint on processed_webhooks is the source of
// truth — concurrent retries race on the insert and exactly one wins.
import { supabaseAdmin } from "./supabase/admin";

export async function claimWebhook(provider: string, externalId: string): Promise<boolean> {
  if (!externalId) return true; // nothing to dedup on — process it
  const { error } = await supabaseAdmin()
    .from("processed_webhooks")
    .insert({ provider, external_id: externalId });
  if (!error) return true; // newly claimed → process
  if (error.code === "23505") return false; // already processed → skip
  // Unexpected error: fail OPEN (process). The payload is signature-verified by
  // the caller, so processing once more is safer than silently dropping it.
  console.error(`[idempotency] claim failed for ${provider}:${externalId}:`, error.message);
  return true;
}
