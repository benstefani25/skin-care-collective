import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/time";
import { generateDigestAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DigestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { data: digests } = await supabaseAdmin()
    .from("digests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);

  const latest = (digests ?? [])[0];

  return (
    <div className="stack">
      <FounderNav active="digest" />
      <h1>Weekly digest</h1>
      <p className="muted">
        The QC analyst reviews each house over the trailing 14 days and flags what&apos;s healthy,
        worth watching, or needs action — with drafted check-ins you review before sending.
      </p>
      <form action={generateDigestAction}>
        <button className="btn" type="submit">Generate now</button>
      </form>
      {sp.error && <p className="banner error">Couldn&apos;t generate — check that the API key is set and there&apos;s house activity.</p>}

      {!latest && <p className="muted">No digests yet — generate one above (runs weekly via cron in production).</p>}

      {latest && (
        <div className="card">
          <p className="fine">{fmtDate(latest.period_start)} – {fmtDate(latest.period_end)} · generated {new Date(latest.created_at).toLocaleString()}</p>
          <DigestBody body={latest.body} />
        </div>
      )}

      {(digests ?? []).slice(1).length > 0 && (
        <details>
          <summary className="muted">Earlier digests</summary>
          {(digests ?? []).slice(1).map((d: any) => (
            <div className="card" key={d.id}>
              <p className="fine">{fmtDate(d.period_start)} – {fmtDate(d.period_end)}</p>
              <DigestBody body={d.body} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

// Minimal markdown render — headings, bold, blockquotes, list items.
function DigestBody({ body }: { body: string }) {
  return (
    <div className="digest">
      {body.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h2 key={i}>{line.slice(2)}</h2>;
        if (line.startsWith("## ")) return <h3 key={i}>{line.slice(3)}</h3>;
        if (line.startsWith("> ")) return <blockquote key={i}>{line.slice(2)}</blockquote>;
        if (line.startsWith("- ")) return <p key={i} className="li">• {render(line.slice(2))}</p>;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i}>{render(line)}</p>;
      })}
    </div>
  );
}

function render(s: string) {
  // bold **x**
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
}
