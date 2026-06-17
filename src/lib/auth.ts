import { redirect } from "next/navigation";
import { config } from "@/config/app";
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

// Role resolution (T2-2): a user is a founder if they have an active
// staff(role='founder') row. The FOUNDER_EMAIL env is a BOOTSTRAP fallback for
// the first login — on match it links/creates the staff row so every later
// check is role-based, not string-based.
export async function resolveFounder(user: { id: string; email?: string | null }): Promise<boolean> {
  const db = supabaseAdmin();
  const email = user.email?.toLowerCase() ?? null;

  const { data: byAuth } = await db
    .from("staff")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "founder")
    .eq("active", true)
    .maybeSingle();
  if (byAuth) return true;

  // Link an existing staff row created by email (first login).
  if (email) {
    const { data: linked } = await db
      .from("staff")
      .update({ auth_user_id: user.id })
      .eq("email", email)
      .eq("role", "founder")
      .eq("active", true)
      .is("auth_user_id", null)
      .select("id")
      .maybeSingle();
    if (linked) return true;
  }

  // Bootstrap: the configured founder email self-heals into a staff row.
  if (email && config.founderEmail && email === config.founderEmail) {
    await db
      .from("staff")
      .upsert({ email, auth_user_id: user.id, role: "founder", active: true }, { onConflict: "email" });
    return true;
  }
  return false;
}

// Founder gate (spec §7 / T2-2). Returns the auth user.
export async function requireFounder() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (!(await resolveFounder(user))) redirect("/login?error=no_member");
  return user;
}

export async function isFounder(): Promise<boolean> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? resolveFounder(user) : false;
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
