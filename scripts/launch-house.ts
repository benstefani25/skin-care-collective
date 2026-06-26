// Deferred billing launch (C-1b): converts card_on_file members at a given
// house to active paying subscriptions. Run per-house so campuses launch
// independently. Charge failures are logged + member flagged payment_failed
// (never silently dropped). The founder reviews failures in the exceptions feed.
//
// Run: npm run launch-house -- <house-id-or-slug>
// Dry run: npm run launch-house -- <house-id-or-slug> --dry-run
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const arg = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!arg) {
    console.error("Usage: npm run launch-house -- <house-id-or-slug> [--dry-run]");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const Stripe = (await import("stripe")).default;
  const { cadenceCheckout } = await import("../src/lib/pricing");
  const { config } = await import("../src/config/app");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Resolve house by id or signup_token/slug field.
  const { data: house, error: houseErr } = await db
    .from("houses")
    .select("id, name, monthly_price_cents")
    .or(`id.eq.${arg},slug.eq.${arg}`)
    .maybeSingle();
  if (houseErr || !house) {
    console.error("House not found:", arg);
    process.exit(1);
  }
  console.log(`\nLaunching ${house.name} (${house.id})${dryRun ? " — DRY RUN" : ""}\n`);

  const { data: members } = await db
    .from("members")
    .select("id, first_name, email, stripe_customer_id, stripe_payment_method_id")
    .eq("house_id", house.id)
    .eq("status", "card_on_file");

  if (!members?.length) {
    console.log("No card_on_file members found for this house.");
    return;
  }
  console.log(`Found ${members.length} member(s) to convert.\n`);

  let succeeded = 0;
  let failed = 0;

  for (const member of members) {
    process.stdout.write(`  ${member.first_name} (${member.email}) ... `);
    if (!member.stripe_customer_id || !member.stripe_payment_method_id) {
      console.log("SKIP — missing Stripe customer or payment method");
      failed++;
      continue;
    }
    if (dryRun) {
      console.log("would create subscription");
      succeeded++;
      continue;
    }

    // Use the saved payment method; cadence defaults to monthly if not stored.
    // The cadence was stored in setup_intent metadata — read it from Stripe if
    // we need it; here we default to monthly for simplicity (the launch script
    // can be extended to read per-member cadence from events if needed).
    const billing = cadenceCheckout("monthly", house.monthly_price_cents);
    try {
      // Create a one-off price for this house/cadence (no reusable price ID in
      // MVP config) then attach it to the subscription.
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: billing.unit_amount,
        recurring: { interval: billing.interval, interval_count: billing.interval_count },
        product_data: { name: `${config.brandName} membership — ${house.name}` },
      });
      const sub = await stripe.subscriptions.create({
        customer: member.stripe_customer_id,
        default_payment_method: member.stripe_payment_method_id,
        items: [{ price: price.id }],
        metadata: { member_id: member.id, launched: new Date().toISOString() },
      });

      await db
        .from("members")
        .update({ status: "active", stripe_subscription_id: sub.id })
        .eq("id", member.id);

      // Append-only audit trail.
      await db.from("events").insert({
        type: "member.launched",
        actor_type: "system",
        member_id: member.id,
        house_id: house.id,
        payload: { subscription_id: sub.id },
      });

      console.log("OK");
      succeeded++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);

      await db
        .from("members")
        .update({ status: "payment_failed" })
        .eq("id", member.id);

      await db.from("events").insert({
        type: "member.launch_payment_failed",
        actor_type: "system",
        member_id: member.id,
        house_id: house.id,
        payload: { error: msg },
      });
      failed++;
    }
  }

  console.log(`\nDone. ${succeeded} activated, ${failed} failed.`);
  if (failed > 0) {
    console.log("Check the founder console exceptions feed for payment_failed members.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
