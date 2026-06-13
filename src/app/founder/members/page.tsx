import Link from "next/link";
import { FounderNav } from "@/components/FounderNav";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const db = supabaseAdmin();

  let query = db
    .from("members")
    .select("id, first_name, last_name, phone, status, house:houses(name)")
    .order("last_name")
    .limit(200);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data: members } = await query;

  return (
    <div className="stack">
      <FounderNav active="members" />
      <h1>Members</h1>
      <form method="get" className="row">
        <input name="q" defaultValue={q} placeholder="Search name or phone…" />
        <button className="btn small" type="submit">Search</button>
      </form>
      <table className="data">
        <thead>
          <tr><th>Name</th><th>House</th><th>Status</th></tr>
        </thead>
        <tbody>
          {(members ?? []).map((m: any) => (
            <tr key={m.id}>
              <td><Link href={`/founder/members/${m.id}`}>{m.first_name} {m.last_name}</Link></td>
              <td>{m.house?.name ?? "—"}</td>
              <td><span className="pill">{m.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {(members ?? []).length === 0 && <p className="muted">No members found.</p>}
    </div>
  );
}
