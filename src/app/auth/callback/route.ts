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

  // First login: attach the auth user to her member or tech row by email,
  // then route to the right surface.
  const db = supabaseAdmin();
  const email = data.user.email?.toLowerCase();
  if (email) {
    await db
      .from("members")
      .update({ auth_user_id: data.user.id })
      .eq("email", email)
      .is("auth_user_id", null);
  }
  const { data: member } = await db
    .from("members")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (member) return NextResponse.redirect(`${config.appBaseUrl}/book`);

  if (email) {
    await db
      .from("techs")
      .update({ auth_user_id: data.user.id })
      .eq("email", email)
      .eq("status", "active")
      .is("auth_user_id", null);
  }
  const { data: tech } = await db
    .from("techs")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (tech) return NextResponse.redirect(`${config.appBaseUrl}/tech`);

  return NextResponse.redirect(`${config.appBaseUrl}/login?error=no_member`);
}
