import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";

// Resolve the logged-in auth user to a member row, linking by email on first
// login. Redirects to /login when there's no session or no matching member.
export async function requireMember() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("members")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (member) return member;

  if (user.email) {
    const { data: linked } = await db
      .from("members")
      .update({ auth_user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .is("auth_user_id", null)
      .select()
      .maybeSingle();
    if (linked) return linked;
  }

  redirect("/login?error=no_member");
}

// Same pattern for techs — separate role, separate surface. Returns the tech
// row; never use it to fetch member contact columns.
export async function requireTech() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const db = supabaseAdmin();
  const { data: tech } = await db
    .from("techs")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (tech) return tech;

  if (user.email) {
    const { data: linked } = await db
      .from("techs")
      .update({ auth_user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .eq("status", "active")
      .is("auth_user_id", null)
      .select()
      .maybeSingle();
    if (linked) return linked;
  }

  redirect("/login?error=no_member");
}
