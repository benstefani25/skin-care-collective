import { copy } from "@/config/copy";
import { config } from "@/config/app";
import { submitHouseLead } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: `Request your house — ${config.brandName}` };

export default async function RequestHousePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const m = copy.marketing;

  if (sp.ok) {
    return (
      <div className="stack mk-narrow">
        <h1>{m.bringTitle}</h1>
        <p className="banner ok">{m.bringConfirm}</p>
      </div>
    );
  }

  return (
    <form action={submitHouseLead} className="stack mk-narrow">
      <h1>{m.bringTitle}</h1>
      <p className="muted">{m.bringIntro}</p>
      {sp.error === "rate_limited" && <p className="banner error">{m.formRateLimited}</p>}
      {sp.error === "invalid" && <p className="banner error">{m.formError}</p>}

      <label>Campus<input name="campus" required /></label>
      <label>Sorority / house name<input name="house" required /></label>
      <label>Your name<input name="name" autoComplete="name" required /></label>
      <label>Your phone or email<input name="contact" required /></label>
      <label>Anything else? (optional)<input name="note" /></label>
      <button className="btn full" type="submit">Send</button>
    </form>
  );
}
