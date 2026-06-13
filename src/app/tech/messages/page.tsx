// Relay inbox (spec §6): member notes forwarded by the concierge, first name
// only. Replies route back out through the brand number — neither side ever
// sees the other's real contact info.
import { TechNav } from "@/components/TechNav";
import { requireTech } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { relayReplyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TechMessages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tech = await requireTech();

  const { data: messages } = await supabaseAdmin()
    .from("messages")
    .select("id, created_at, direction, body, member:members(id, first_name)")
    .eq("tech_id", tech.id)
    .eq("handled_by", "relay")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="stack">
      <TechNav active="messages" />
      <h1>Messages</h1>
      {sp.ok && <p className="banner ok">Sent!</p>}
      {sp.error && <p className="banner error">Couldn&apos;t send — try again.</p>}
      {(messages ?? []).length === 0 && (
        <p className="muted">
          Nothing yet. When a member texts something for you (running late, room number),
          it shows up here.
        </p>
      )}
      {(messages ?? []).map((m: any) => (
        <div className="card" key={m.id}>
          <p className="fine">
            {new Date(m.created_at).toLocaleString("en-US", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p>
            <strong>{m.direction === "inbound" ? (m.member?.first_name ?? "Member") : "You"}:</strong>{" "}
            {m.body}
          </p>
          {m.direction === "inbound" && m.member?.id && (
            <form action={relayReplyAction} className="row">
              <input type="hidden" name="member_id" value={m.member.id} />
              <input name="reply" placeholder="Reply…" required />
              <button className="btn small" type="submit">
                Send
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
