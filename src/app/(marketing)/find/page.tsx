import Link from "next/link";
import { copy } from "@/config/copy";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HouseFinder } from "./HouseFinder";

export const dynamic = "force-dynamic";

export const metadata = { title: `Find your house` };

export default async function FindPage() {
  // W-2 (DECIDED: browsable). Per the founder's decision this intentionally
  // exposes the active-house list publicly, reversing the T2-4 no-enumeration
  // posture. Only active houses with a signup token are listed.
  const { data: houses } = await supabaseAdmin()
    .from("houses")
    .select("campus, name, signup_token")
    .eq("status", "active")
    .order("campus");

  const list = (houses ?? [])
    .filter((h) => h.signup_token)
    .map((h) => ({ campus: h.campus, name: h.name, token: h.signup_token as string }));

  return (
    <div className="stack mk-narrow">
      <h1>{copy.marketing.findTitle}</h1>
      <p className="muted">{copy.marketing.findIntro}</p>
      {list.length === 0 ? (
        <div className="card">
          <p className="muted">{copy.marketing.findNoHouses}</p>
          <Link className="btn full" href="/request-house">{copy.marketing.ctaBringScc}</Link>
        </div>
      ) : (
        <HouseFinder houses={list} />
      )}
    </div>
  );
}
