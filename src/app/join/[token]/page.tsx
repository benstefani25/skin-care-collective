// Per-house signup (T2-4). Reached via the house's opaque link/QR. The house
// is resolved from the token server-side; there is no public list of houses.
import { config } from "@/config/app";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { fmtUsd, semesterAmountCents } from "@/lib/pricing";
import { startSignup } from "../../signup/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Please check your details and try again.",
  already_member: "Looks like you already have a membership — log in instead, or text us.",
  cancelled: "No worries — your card wasn't charged. Ready when you are.",
  stripe: "Something went wrong starting checkout. Try again in a minute.",
  rate_limited: "Too many attempts — give it a few minutes and try again.",
};

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const { data: house } = await supabaseAdmin()
    .from("houses")
    .select("name, campus, monthly_price_cents, status")
    .eq("signup_token", token)
    .maybeSingle();

  if (!house || house.status !== "active") {
    return (
      <div className="stack">
        <Wordmark size={20} />
        <h1>This link isn&apos;t active</h1>
        <p className="muted">
          Double-check the link from your house, or text us and we&apos;ll get you set up.
        </p>
      </div>
    );
  }

  const monthly = house.monthly_price_cents;
  const semester = semesterAmountCents(monthly);

  return (
    <form action={startSignup} className="stack">
      <input type="hidden" name="house_token" value={token} />
      {sp.ref ? <input type="hidden" name="ref" value={sp.ref} /> : null}
      <Wordmark size={20} />
      <div>
        <h1>Join {house.name}</h1>
        <p className="muted">A few quick details and you&apos;re set for the season.</p>
      </div>
      {sp.error && <p className="banner error">{ERRORS[sp.error] ?? ERRORS.invalid}</p>}

      <label>First name<input name="first_name" autoComplete="given-name" required /></label>
      <label>Last name<input name="last_name" autoComplete="family-name" required /></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>

      <fieldset className="cadence">
        <legend>How would you like to pay?</legend>
        <label className="cadence-opt">
          <input type="radio" name="cadence" value="monthly" defaultChecked />
          <span>
            <strong>Monthly — {fmtUsd(monthly)}/mo</strong>
            <span className="muted"> — billed monthly, cancel anytime</span>
          </span>
        </label>
        <label className="cadence-opt">
          <input type="radio" name="cadence" value="semester" />
          <span>
            <strong>Semester — {fmtUsd(semester)}</strong>
            <span className="muted">
              {" "}— prepay {config.semesterIntervalMonths} months
              {config.semesterPrepayDiscountPct > 0 ? `, save ${config.semesterPrepayDiscountPct}%` : ""}
            </span>
          </span>
        </label>
      </fieldset>

      <button className="btn full" type="submit">Continue to payment</button>
      <p className="fine">
        Card on file — never pay at an appointment. Your exact total is shown on the secure
        checkout page. Pause or cancel anytime from your account.
      </p>
    </form>
  );
}
