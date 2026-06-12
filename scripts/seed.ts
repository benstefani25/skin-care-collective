// Seed (spec §16): one house, one tech, five members, one upcoming visit —
// every surface is demo-able immediately. Run: npm run seed
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabase/admin");
  const { generateVisitsAndSlots } = await import("../src/lib/slots");
  const db = supabaseAdmin();

  const houseName = "Alpha Theta House";
  const { data: existing } = await db
    .from("houses")
    .select("id")
    .eq("name", houseName)
    .maybeSingle();
  if (existing) {
    console.log("Seed house already exists — nothing to do.");
    return;
  }

  // Put the first visit ~3 days out so reminders and the run sheet are demo-able soon.
  const visitWeekday = (new Date().getDay() + 3) % 7;

  const { data: house, error: houseErr } = await db
    .from("houses")
    .insert({
      name: houseName,
      campus: "State University",
      address: "123 Greek Row",
      access_notes: "Park in the side lot. Side door code 4321#. Quiet hours after 10pm.",
      house_director_name: "Dana Director",
      house_director_contact: "director@example.com / +1 555 010 0000",
      visit_weekday: visitWeekday,
      visit_cadence: "biweekly",
      visit_window_start: "17:00",
      visit_window_end: "21:00",
      slot_duration_minutes: 20,
      monthly_price_cents: 6500,
      status: "active",
    })
    .select()
    .single();
  if (houseErr || !house) throw new Error(`house insert failed: ${houseErr?.message}`);

  const { data: tech, error: techErr } = await db
    .from("techs")
    .insert({
      first_name: "Jordan",
      last_name: "Reyes",
      phone: "+15550100001",
      email: "tech@example.com",
      base_rate_cents: 1000,
      deferred_rate_cents: 250,
      semester_number: 1,
      status: "active",
      hired_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (techErr || !tech) throw new Error(`tech insert failed: ${techErr?.message}`);

  await db.from("tech_house_assignments").insert({
    tech_id: tech.id,
    house_id: house.id,
    active: true,
  });

  const members: Array<[string, string, string | null]> = [
    ["Avery", "Anderson", "early"],
    ["Blake", "Brown", "mid"],
    ["Casey", "Clark", "late"],
    ["Drew", "Davis", null],
    ["Emery", "Evans", null],
  ];
  for (let i = 0; i < members.length; i++) {
    const [first, last, window] = members[i];
    const { error } = await db.from("members").insert({
      house_id: house.id,
      first_name: first,
      last_name: last,
      phone: `+1555010100${i}`,
      email: `member${i + 1}@example.com`,
      shade_preference: ["light", "medium", "dark"][i % 3],
      service_notes: i === 0 ? "Sensitive skin — patch test done 9/1" : null,
      standing_appointment: true,
      standing_window: window,
      status: "active",
      graduation_year: 2027 + (i % 3),
    });
    if (error) throw new Error(`member insert failed: ${error.message}`);
  }

  console.log("Generating visits, slots, and standing appointments…");
  const summary = await generateVisitsAndSlots();
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    "Seed complete: 1 house, 1 tech, 5 members, visits scheduled with standing placements.\n" +
      "(SMS confirmations were printed above if Twilio env is unset.)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
