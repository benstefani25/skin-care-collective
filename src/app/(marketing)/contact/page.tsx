import { copy } from "@/config/copy";
import { config } from "@/config/app";
import { submitContact } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: `Contact` };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const m = copy.marketing;
  const brandNumber = process.env.TWILIO_BRAND_NUMBER;

  if (sp.ok) {
    return (
      <div className="stack mk-narrow">
        <h1>{m.contactTitle}</h1>
        <p className="banner ok">{m.contactConfirm}</p>
      </div>
    );
  }

  return (
    <form action={submitContact} className="stack mk-narrow">
      <h1>{m.contactTitle}</h1>
      <p className="muted">{m.contactIntro}</p>
      {sp.error === "rate_limited" && <p className="banner error">{m.formRateLimited}</p>}
      {sp.error === "invalid" && <p className="banner error">{m.formError}</p>}

      <label>Your name<input name="name" autoComplete="name" required /></label>
      <label>Your phone or email<input name="contact" required /></label>
      <label>Message<textarea name="message" rows={4} required /></label>
      <button className="btn full" type="submit">Send</button>
      <p className="fine">
        Prefer to text? You can also just text us{brandNumber ? ` at ${brandNumber}` : ""} — that&apos;s
        our front desk too. — {config.brandName}
      </p>
    </form>
  );
}
