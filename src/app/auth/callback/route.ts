import { NextResponse } from "next/server";
import { config } from "@/config/app";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${config.appBaseUrl}/login?error=invalid_link`);
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${config.appBaseUrl}/login?error=invalid_link`);
  }

  // First login: attach the auth user to her member row by email.
  if (data.user.email) {
    await supabaseAdmin()
      .from("members")
      .update({ auth_user_id: data.user.id })
      .eq("email", data.user.email.toLowerCase())
      .is("auth_user_id", null);
  }

  return NextResponse.redirect(`${config.appBaseUrl}/book`);
}
