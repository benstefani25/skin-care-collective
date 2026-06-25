"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveFounder } from "@/lib/auth";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=missing_email");

  // The cookie-backed client stores the PKCE verifier in the browser, which
  // the /auth/callback exchange depends on.
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${config.appBaseUrl}/auth/callback` },
  });

  redirect(error ? "/login?error=send_failed" : "/login?sent=1");
}

// R2-1: password login for staff (founder + techs). Members keep magic links.
// signInWithPassword sets the session cookie directly (no /auth/callback
// round-trip); the SSR cookie client then persists + auto-refreshes it, so the
// login survives browser restarts.
export async function staffLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?staff=1&error=missing_creds");

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/login?staff=1&error=bad_password");

  // Route by role. Staff login is for staff only.
  if (await resolveFounder(data.user)) redirect("/founder");
  const { data: tech } = await supabaseAdmin()
    .from("techs")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (tech) redirect("/tech");

  // Authenticated but not staff — sign back out and send to member login.
  await sb.auth.signOut();
  redirect("/login?error=not_staff");
}
