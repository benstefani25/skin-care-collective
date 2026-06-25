import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { sendMagicLink, staffLogin } from "./actions";

const ERRORS: Record<string, string> = {
  missing_email: "Enter the email you signed up with.",
  send_failed: "Couldn't send the link — double-check the address and try again.",
  invalid_link: "That login link expired. Request a fresh one below.",
  no_member: "We couldn't find a membership under that email. Text us and we'll sort it out.",
  missing_creds: "Enter your email and password.",
  bad_password: "That email and password didn't match. Try again or reset your password.",
  not_staff: "That account isn't a staff account — members log in with a link above.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const staff = sp.staff === "1";

  if (staff) {
    // Staff (founder + techs): email + password (R2-1).
    return (
      <form action={staffLogin} className="stack">
        <Wordmark size={20} />
        <div>
          <h1>Staff login</h1>
          <p className="muted">Founder and technicians — log in with your password.</p>
        </div>
        {sp.error && <p className="banner error">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn full" type="submit">Log in</button>
        <p className="fine">
          First time, or no password yet? Use the <Link href="/login">member link</Link> to sign in
          once, then set a password under Set password.
        </p>
      </form>
    );
  }

  return (
    <form action={sendMagicLink} className="stack">
      <Wordmark size={20} />
      <div>
        <h1>Welcome back</h1>
        <p className="muted">We&apos;ll email you a one-tap login link — no password to remember.</p>
      </div>
      {sp.error && <p className="banner error">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
      {sp.sent ? (
        <p className="banner ok">Check your email — we sent you a login link.</p>
      ) : (
        <>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="btn full" type="submit">
            Send login link
          </button>
          <p className="fine">
            Staff? <Link href="/login?staff=1">Log in with a password</Link>.
          </p>
        </>
      )}
    </form>
  );
}
