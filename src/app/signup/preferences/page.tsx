import { copy } from "@/config/copy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/links";
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

  const { data: member } = await supabaseAdmin()
    .from("members")
    .select("first_name, shade_preference, standing_appointment, standing_window")
    .eq("id", payload.id)
    .maybeSingle();
  if (!member) {
    return <p className="muted">Something went wrong — text us and we&apos;ll sort it out.</p>;
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
      <button className="btn" type="submit">
        Finish
      </button>
    </form>
  );
}
