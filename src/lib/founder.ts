// Founder console data (spec §7). All reads use the service role behind
// requireFounder(); this is the one role with full visibility.
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase/admin";
import { addDaysISO, slotStart, todayISO } from "./time";

export type Exception = {
  kind: "under_threshold" | "escalation" | "payment_failed" | "no_show_spike" | "low_rating" | "tech_late";
  severity: "act" | "watch";
  title: string;
  detail: string;
  href?: string;
  at?: string;
};

// The exceptions feed (spec §7): everything that needs the founder's eyes,
// newest/most-urgent first.
export async function getExceptions(): Promise<Exception[]> {
  const db = supabaseAdmin();
  const out: Exception[] = [];
  const today = todayISO();
  const since = addDaysISO(today, -14);

  // Under-threshold visits (future)
  const { data: under } = await db
    .from("visits")
    .select("id, date, house:houses(name)")
    .eq("status", "under_threshold")
    .gte("date", today)
    .order("date");
  for (const v of under ?? []) {
    out.push({
      kind: "under_threshold",
      severity: "act",
      title: `Under-booked visit — ${(v.house as any)?.name ?? "house"}`,
      detail: `${v.date} has fewer than the minimum booked. Cancel & notify, or let it ride.`,
      href: "/founder/visits",
      at: v.date,
    });
  }

  // Escalated messages (recent, awaiting founder)
  const { data: esc } = await db
    .from("messages")
    .select("id, created_at, body, member:members(first_name, last_name, id)")
    .eq("escalated", true)
    .eq("direction", "outbound")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const m of esc ?? []) {
    const who = (m.member as any);
    out.push({
      kind: "escalation",
      severity: "act",
      title: `Escalation — ${who?.first_name ?? "member"} ${who?.last_name?.[0] ?? ""}.`,
      detail: m.body,
      href: who?.id ? `/founder/members/${who.id}` : "/founder/members",
      at: m.created_at,
    });
  }

  // Failed payments / past due
  const { data: pastDue } = await db
    .from("members")
    .select("id, first_name, last_name")
    .eq("status", "past_due");
  for (const m of pastDue ?? []) {
    out.push({
      kind: "payment_failed",
      severity: "act",
      title: `Payment failed — ${m.first_name} ${m.last_name[0]}.`,
      detail: "Membership is past due; she can't book until billing is fixed.",
      href: `/founder/members/${m.id}`,
    });
  }

  // Low survey ratings (≤ 3)
  const { data: lowRatings } = await db
    .from("surveys")
    .select("id, rating, comment, created_at")
    .lte("rating", 3)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  for (const s of lowRatings ?? []) {
    out.push({
      kind: "low_rating",
      severity: "watch",
      title: `Low rating — ${s.rating}/5`,
      detail: s.comment ?? "No comment left.",
      at: s.created_at,
    });
  }

  // No-show spike (trailing 14d count)
  const { count: noShows } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "no_show")
    .gte("created_at", since);
  if ((noShows ?? 0) >= 5) {
    out.push({
      kind: "no_show_spike",
      severity: "watch",
      title: `No-show spike — ${noShows} in 14 days`,
      detail: "Elevated no-shows across houses. Check reminder delivery and individual members.",
      href: "/founder/members",
    });
  }

  // Tech check-ins missing 15+ min past visit start (today)
  const { data: visitsToday } = await db
    .from("visits")
    .select("id, window_start, checked_in_at, tech:techs(first_name), house:houses(name)")
    .eq("date", today)
    .in("status", ["scheduled", "under_threshold"]);
  for (const v of visitsToday ?? []) {
    if (v.checked_in_at) continue;
    const start = slotStart(today, v.window_start);
    if (Date.now() - start.getTime() > 15 * 60 * 1000) {
      out.push({
        kind: "tech_late",
        severity: "act",
        title: `Tech not checked in — ${(v.house as any)?.name ?? "house"}`,
        detail: `${(v.tech as any)?.first_name ?? "Tech"} hasn't checked in 15+ min after the ${v.window_start} start.`,
        href: "/founder/visits",
      });
    }
  }

  // Act items first, then watch; within each, keep insertion order.
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "act" ? -1 : 1));
}

export type HouseHealth = {
  id: string;
  name: string;
  campus: string;
  status: string;
  activeMembers: number;
  cancelledMembers: number;
  avgRating: number | null;
  fillRate: number | null; // 0..1 over trailing visits
};

export async function getHouseHealth(db: SupabaseClient = supabaseAdmin()): Promise<HouseHealth[]> {
  const { data: houses } = await db.from("houses").select("*").order("name");
  const since = addDaysISO(todayISO(), -30);
  const result: HouseHealth[] = [];

  for (const h of houses ?? []) {
    const { count: active } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("house_id", h.id)
      .eq("status", "active");
    const { count: cancelled } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("house_id", h.id)
      .eq("status", "cancelled");

    // Avg rating + fill rate over trailing 30d visits at this house.
    const { data: visits } = await db
      .from("visits")
      .select("id, slots(status)")
      .eq("house_id", h.id)
      .gte("date", since);
    let slots = 0;
    let booked = 0;
    for (const v of visits ?? []) {
      for (const s of (v.slots ?? []) as any[]) {
        slots++;
        if (s.status === "booked") booked++;
      }
    }

    const visitIds = (visits ?? []).map((v: any) => v.id);
    let avgRating: number | null = null;
    if (visitIds.length > 0) {
      const { data: surveys } = await db
        .from("surveys")
        .select("rating, appointment:appointments!inner(slot:slots!inner(visit_id))")
        .gte("created_at", since);
      const relevant = (surveys ?? []).filter((s: any) =>
        visitIds.includes(s.appointment?.slot?.visit_id)
      );
      if (relevant.length > 0) {
        avgRating = relevant.reduce((sum: number, s: any) => sum + s.rating, 0) / relevant.length;
      }
    }

    result.push({
      id: h.id,
      name: h.name,
      campus: h.campus,
      status: h.status,
      activeMembers: active ?? 0,
      cancelledMembers: cancelled ?? 0,
      avgRating,
      fillRate: slots > 0 ? booked / slots : null,
    });
  }
  return result;
}
