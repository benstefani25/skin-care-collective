// Token-hash login (Supabase OTP verify). Unlike the PKCE /auth/callback,
// this needs no prior browser state, so an admin-generated magic link works
// directly — handy for founder/tech logins that don't go through email.
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { config } from "@/config/app";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") as EmailOtpType | null) ?? "magiclink";
  if (!tokenHash) {
    return NextResponse.redirect(`${config.appBaseUrl}/login?error=invalid_link`);
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) {
    return NextResponse.redirect(`${config.appBaseUrl}/login?error=invalid_link`);
  }

  const email = data.user.email?.toLowerCase();

  // Founder first — a configured email, no row to link.
  if (email && config.founderEmail && email === config.founderEmail) {
    return NextResponse.redirect(`${config.appBaseUrl}/founder`);
  }

  // Link the auth user to her member or tech row, then route accordingly.
  const db = supabaseAdmin();
  if (email) {
    await db.from("members").update({ auth_user_id: data.user.id }).eq("email", email).is("auth_user_id", null);
  }
  const { data: member } = await db.from("members").select("id").eq("auth_user_id", data.user.id).maybeSingle();
  if (member) return NextResponse.redirect(`${config.appBaseUrl}/book`);

  if (email) {
    await db.from("techs").update({ auth_user_id: data.user.id }).eq("email", email).eq("status", "active").is("auth_user_id", null);
  }
  const { data: tech } = await db.from("techs").select("id").eq("auth_user_id", data.user.id).maybeSingle();
  if (tech) return NextResponse.redirect(`${config.appBaseUrl}/tech`);

  return NextResponse.redirect(`${config.appBaseUrl}/login?error=no_member`);
}
