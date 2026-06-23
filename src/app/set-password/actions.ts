"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// R2-1: a logged-in user sets/updates their own password (Supabase Auth hashes
// it; the app never stores it). Used by staff after their first magic-link
// login so they can use password login thereafter.
export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/set-password?error=too_short");

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await sb.auth.updateUser({ password });
  redirect(error ? "/set-password?error=failed" : "/set-password?ok=1");
}
