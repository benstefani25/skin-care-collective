"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { supabaseServer } from "@/lib/supabase/server";

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
