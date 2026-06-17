import { copy } from "@/config/copy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/links";
import { TablesUpdate } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";
import { savePreferences } from "./actions";

export const dynamic = "force-dynamic";

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const payload = sp.t ? verifyToken(sp.t) : null;
  if (!payload || payload.scope !== "member") {
    return (
      <div className="stack">
        <h1>Link expired</h1>
        <p className="muted">No problem — text us and we&apos;ll get you set up.</p>
      </div>
    );
  }

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("members")
    .select("id, status, first_name, shade_preference, standing_appointment, standing_window")
    .eq("id", payload.id)
    .maybeSingle();
  if (!member) {
    return <p className="muted">Something went wrong — text us and we&apos;ll sort it out.</p>;
  }

  // Activation fallback: confirm payment directly with Stripe on the success
  // redirect. Idempotent with the checkout.session.completed webhook, and
  // covers local dev where webhooks can't reach the server.
  if (member.status === "pending" && sp.session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sp.session_id);
      if (session.payment_status === "paid" && session.metadata?.member_id === member.id) {
        const update: TablesUpdate<"members"> = { status: "active" };
        if (typeof session.customer === "string") update.stripe_customer_id = session.customer;
        if (typeof session.subscription === "string") {
          update.stripe_subscription_id = session.subscription;
        }
        await db.from("members").update(update).eq("id", member.id);
        await logEvent({
          type: "member.activated",
          actor_type: "system",
          member_id: member.id,
          payload: { checkout_session: session.id, via: "success_redirect" },
        });
      }
    } catch (err) {
      console.error("[signup] checkout session verification failed:", err);
    }
  }

  return (
    <form action={savePreferences} className="stack">
      <input type="hidden" name="token" value={sp.t} />
      <h1>Almost done, {member.first_name}!</h1>
      <p className="muted">Payment&apos;s in. Two quick preferences:</p>
      <label>
        Shade preference
        <input
          name="shade_preference"
          defaultValue={member.shade_preference ?? ""}
          placeholder="e.g. medium — not sure? we'll help you pick"
        />
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
      <button className="btn full" type="submit">
        Finish
      </button>
    </form>
  );
}
