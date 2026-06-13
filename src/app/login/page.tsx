import { Wordmark } from "@/components/Wordmark";
import { sendMagicLink } from "./actions";

const ERRORS: Record<string, string> = {
  missing_email: "Enter the email you signed up with.",
  send_failed: "Couldn't send the link — double-check the address and try again.",
  invalid_link: "That login link expired. Request a fresh one below.",
  no_member: "We couldn't find a membership under that email. Text us and we'll sort it out.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
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
        </>
      )}
    </form>
  );
}
