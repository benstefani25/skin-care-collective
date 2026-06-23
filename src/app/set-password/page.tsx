import { redirect } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { supabaseServer } from "@/lib/supabase/server";
import { setPassword } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  too_short: "Use at least 8 characters.",
  failed: "Couldn't update your password — try again.",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Must be logged in (staff arrive here after a magic-link login).
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login?staff=1");

  return (
    <form action={setPassword} className="stack">
      <Wordmark size={20} />
      <h1>Set a password</h1>
      <p className="muted">Signed in as {user.email}. Set a password so you can log in without a link.</p>
      {sp.ok && <p className="banner ok">Password set — you can now use staff login.</p>}
      {sp.error && <p className="banner error">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <button className="btn full" type="submit">Save password</button>
    </form>
  );
}
