// Dev/demo helper: creates a visit for TODAY at the seed house (if none) and
// books a few members in, so the tech run sheet has something to show without
// waiting for the next scheduled visit day. Idempotent.
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase/admin");
  const { bookAppointment } = await import("../src/lib/booking");
  const { todayISO, minutesToTime, timeToMinutes } = await import("../src/lib/time");
  const db = supabaseAdmin();
  const today = todayISO();

  const { data: house } = await db
    .from("houses")
    .select("*")
    .eq("status", "active")
    .limit(1)
    .single();
  if (!house) throw new Error("No active house — run npm run seed first.");

  const { data: existing } = await db
    .from("visits")
    .select("id")
    .eq("house_id", house.id)
    .eq("date", today)
    .maybeSingle();
  if (existing) {
    console.log(`Visit for today already exists (${existing.id}).`);
    return;
  }

  const { data: assignment } = await db
    .from("tech_house_assignments")
    .select("tech_id")
    .eq("house_id", house.id)
    .eq("active", true)
    .limit(1)
    .single();

  // Window: from the top of the next hour, long enough for 6 slots.
  const now = new Date();
  const startMin = (now.getHours() + 1) * 60;
  const duration = house.slot_duration_minutes ?? 20;
  const windowStart = minutesToTime(Math.min(startMin, timeToMinutes("21:00")));
  const windowEnd = minutesToTime(Math.min(startMin + 6 * duration, 23 * 60 + 40));

  const { data: visit, error: visitErr } = await db
    .from("visits")
    .insert({
      house_id: house.id,
      tech_id: assignment?.tech_id ?? null,
      date: today,
      window_start: windowStart,
      window_end: windowEnd,
      status: "scheduled",
    })
    .select()
    .single();
  if (visitErr || !visit) throw new Error(`visit insert failed: ${visitErr?.message}`);

  const slotRows = [];
  for (let t = timeToMinutes(windowStart); t + duration <= timeToMinutes(windowEnd); t += duration) {
    slotRows.push({ visit_id: visit.id, start_time: minutesToTime(t), duration_minutes: duration, status: "open" });
  }
  const { data: slots, error: slotErr } = await db.from("slots").insert(slotRows).select();
  if (slotErr || !slots) throw new Error(`slot insert failed: ${slotErr?.message}`);

  const { data: members } = await db
    .from("members")
    .select("id, first_name")
    .eq("house_id", house.id)
    .eq("status", "active")
    .limit(3);
  let booked = 0;
  for (let i = 0; i < (members ?? []).length && i < slots.length; i++) {
    const result = await bookAppointment({
      memberId: members![i].id,
      slotId: slots[i].id,
      source: "self_serve",
      actor: { type: "system" },
      room: `${201 + i}`,
    });
    if (result.ok) booked++;
  }

  console.log(
    `Created today's visit at ${house.name}: ${slots.length} slots (${windowStart}–${windowEnd}), ${booked} members booked.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
