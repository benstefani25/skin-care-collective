// Shared test helpers: service-role admin client + a tech-authenticated client.
// Tests seed namespaced rows against the configured Supabase project and clean
// up after themselves.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Create a confirmed auth user and return its id.
export async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createAuthUser failed: ${error?.message}`);
  return data.user.id;
}

export async function deleteAuthUser(id: string): Promise<void> {
  await admin().auth.admin.deleteUser(id);
}

// Sign in with password and return a client that carries that user's JWT — so
// queries run under RLS as that user (NOT the service role).
export async function clientForUser(email: string, password: string): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn failed: ${error?.message}`);
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

export function rand(): string {
  return Math.random().toString(36).slice(2, 9);
}
