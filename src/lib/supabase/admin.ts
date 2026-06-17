import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

// Service-role client — server-side only, bypasses RLS. Never import from
// client components; the key must never reach the browser (spec §12).
// Typed with the generated Database schema (T2-9) so table/column access is
// checked.
export function supabaseAdmin(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
