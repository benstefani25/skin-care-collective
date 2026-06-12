import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service-role client — server-side only, bypasses RLS. Never import from
// client components; the key must never reach the browser (spec §12).
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
