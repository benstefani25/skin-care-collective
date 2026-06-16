import { config } from "@/config/app";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { startSignup } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Please check your details and try again.",
  already_member: "Looks like you already have a membership — log in instead, or text us.",
  cancelled: "No worries — your card wasn't charged. Ready when you are.",
  stripe: "Something went wrong starting checkout. Try again in a minute.",
  rate_limited: "Too many attempts — give it a few minutes and try again.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { data: houses } = await supabaseAdmin()
    .from("houses")
    .select("id, name, campus, monthly_price_cents")
    .eq("status", "active")
    .order("name");

  return (
    <form action={startSignup} className="stack">
      <Wordmark size={20} />
      <div>
        <h1>Join your house</h1>
        <p className="muted">A few quick details and you&apos;re set for the season.</p>
      </div>
      {sp.error && <p className="banner error">{ERRORS[sp.error] ?? ERRORS.invalid}</p>}
      <label>
        Your house
        <select name="house_id" required defaultValue="">
          <option value="" disabled>
            Select your house…
          </option>
          {(houses ?? []).map((h: any) => (
            <option key={h.id} value={h.id}>
              {h.name} — ${Math.round(h.monthly_price_cents / 100)}/mo
            </option>
          ))}
        </select>
      </label>
      <label>
        First name
        <input name="first_name" autoComplete="given-name" required />
      </label>
      <label>
        Last name
        <input name="last_name" autoComplete="family-name" required />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" autoComplete="tel" placeholder="(555) 555-5555" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <fieldset className="cadence">
        <legend>How would you like to pay?</legend>
        <label className="cadence-opt">
          <input type="radio" name="cadence" value="monthly" defaultChecked />
          <span>
            <strong>Monthly</strong>
            <span className="muted"> — billed every month, cancel anytime</span>
          </span>
        </label>
        <label className="cadence-opt">
          <input type="radio" name="cadence" value="semester" />
          <span>
            <strong>Semester</strong>
            <span className="muted">
              {" "}— prepay {config.semesterIntervalMonths} months at once
              {config.semesterPrepayDiscountPct > 0 ? ` and save ${config.semesterPrepayDiscountPct}%` : ""}
            </span>
          </span>
        </label>
      </fieldset>

      <button className="btn full" type="submit">
        Continue to payment
      </button>
      <p className="fine">
        Card on file — never pay at an appointment. Your exact total is shown on the secure
        checkout page. Pause or cancel anytime from your account.
      </p>
    </form>
  );
}
