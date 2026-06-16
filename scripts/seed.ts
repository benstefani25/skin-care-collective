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
      monthly_price_cents: 8900,
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

  // SOP corpus for the tech copilot (spec §11b / M5).
  const sops: Array<[string, string, string]> = [
    [
      "Streaky or uneven results",
      "Streaking almost always traces to prep or application distance. Confirm the client exfoliated and skipped lotion/deodorant. Hold the gun 6–8 inches from the skin, keep it moving in smooth horizontal passes, and overlap each pass by ~50%. Do two light coats rather than one heavy one. Feather the edges at wrists, ankles, knees, and elbows where solution pools. If the solution looks watery, check the dilution before the next client.",
      "technique",
    ],
    [
      "Equipment: gun won't spray evenly",
      "A spitting or sputtering gun is usually a clogged nozzle or low air pressure. Power down, remove and rinse the nozzle in warm water, and clear it with the cleaning pin. Confirm the air pressure is set to 8–10 PSI for our solution. Wipe the needle after every few clients. If it still sputters after cleaning, swap to the backup gun and flag it so the owner can service the unit.",
      "equipment",
    ],
    [
      "Client prep and aftercare",
      "Before: client should shower and exfoliate, no lotion, deodorant, makeup, or perfume. Have her wear loose, dark clothing and remove jewelry. After: no water, sweat, or tight clothing for 8 hours, then rinse in lukewarm water (no soap on the first rinse). Moisturize daily to extend the tan. Results develop over 4–8 hours.",
      "process",
    ],
  ];
  for (const [title, body, category] of sops) {
    await db.from("sop_documents").insert({ title, body, category, version: 1, active: true });
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
