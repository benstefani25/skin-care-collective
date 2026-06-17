import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/time";
import { OpsChat } from "./OpsChat";
import { generateBriefAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const { data: brief } = await supabaseAdmin()
    .from("digests")
    .select("*")
    .eq("generated_by", "ops_morning_brief")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="stack">
      <FounderNav active="ops" />
      <h1>Ops</h1>
      <p className="muted">Your read-only analyst — it reads the business and answers questions, but can&apos;t change anything.</p>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Morning brief</h2>
          <form action={generateBriefAction}>
            <button className="btn small secondary" type="submit">Generate now</button>
          </form>
        </div>
        {brief ? (
          <>
            <p className="fine">{fmtDate(brief.period_start)} · {new Date(brief.created_at).toLocaleString()}</p>
            <div style={{ whiteSpace: "pre-wrap" }}>{brief.body}</div>
          </>
        ) : (
          <p className="muted">No brief yet — generate one, or it runs each morning via cron.</p>
        )}
      </section>

      <section className="card">
        <h2>Ask anytime</h2>
        <OpsChat />
      </section>
    </div>
  );
}
