import { Nav } from "@/components/Nav";
import { copy } from "@/config/copy";
import { requireMember } from "@/lib/auth";
import { logoutAction, portalAction, savePreferencesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const member = await requireMember();

  return (
    <div className="stack">
      <Nav active="account" />
      {sp.ok && <p className="banner ok">Saved!</p>}
      {sp.error && <p className="banner error">Something went wrong — try again.</p>}

      <section className="card">
        <h2>Preferences</h2>
        <form action={savePreferencesAction} className="stack">
          <label>
            Shade preference
            <input name="shade_preference" defaultValue={member.shade_preference ?? ""} />
          </label>
          <label className="check">
            <input type="checkbox" name="standing" defaultChecked={member.standing_appointment} />
            <span>
              <strong>Auto-book me each visit.</strong> {copy.standingExplanation}
            </span>
          </label>
          <label>
            Preferred time of evening
            <select name="standing_window" defaultValue={member.standing_window ?? ""}>
              <option value="">No preference</option>
              <option value="early">Early</option>
              <option value="mid">Middle</option>
              <option value="late">Late</option>
            </select>
          </label>
          <button className="btn" type="submit">
            Save
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Billing</h2>
        {member.status === "card_on_file" ? (
          <p className="banner ok" style={{ marginBottom: 0 }}>{copy.marketing.deferredBillingDashboard}</p>
        ) : (
          <>
            <p className="muted">
              Card, summer pause, or cancel — all handled in the secure billing portal.
            </p>
            <form action={portalAction}>
              <button className="btn secondary" type="submit">
                Manage billing
              </button>
            </form>
          </>
        )}
      </section>

      <form action={logoutAction}>
        <button className="btn link" type="submit">
          Log out
        </button>
      </form>
    </div>
  );
}
