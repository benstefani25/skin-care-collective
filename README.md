# Skin Care Collective — Milestones 1–3

Recurring spray-tan membership platform for sorority houses. This repo implements **M1 (core + signup + booking)**, **M2 (tech app + the wall)**, and **M3 (concierge)** from `docs/SPEC.md`.

**M3 exit test:** members text the brand number and an AI front desk (Claude with tool use) books, reschedules, cancels, toggles auto-booking, sends the billing portal link, forwards day-of notes to the tech, and escalates anything medical/complaint/refund to the owner — never touching money or another member's data. Test locally without Twilio: `npm run sms -- "+15550101000" "what times are open this week?"`.

**M1 exit test:** a member can sign up, pay, get auto-booked via standing appointment, reschedule herself, and receive reminders — with zero founder involvement.

**M2 exit test:** a tech can run a full visit day from her phone (`/tech`: visit check-in/out, per-appointment check-in/complete/no-show, earnings at `/tech/earnings`), and tech-facing reads go through the `tech_runsheet` view under her own RLS session — no member contact info anywhere in the responses. Completing a tan accrues the deferred bonus (escalator $2.50 → $5.00 → $7.50 by semester); `npm run payroll` emits the biweekly CSV with the minimum-wage true-up.

## What's here

- **Schema + RLS** (`supabase/migrations/`) — the *full* data model from spec §3 (all milestones), deny-by-default RLS, append-only `events` table (trigger + revoked UPDATE/DELETE), and the `tech_runsheet` security-definer view that is the database-layer wall keeping member contact info away from techs (ready for M2).
- **Slot generation** — daily cron creates visits 3 weeks ahead from each house's cadence, fills the window with slots, places **standing appointments first** (early/mid/late preference), and texts each member a confirmation with a one-tap reschedule/skip link.
- **Member signup** — house → details → Stripe Checkout (subscription, per-house price) → shade + standing preferences (pre-checked ON).
- **Book/manage** (`/book`) — upcoming visits, open slots, one-tap cancel/reschedule respecting the 24h window (late changes allowed but recorded as `cancelled_late`, no fee).
- **Account** (`/account`) — preferences, standing toggle, Stripe customer portal (card/pause/cancel).
- **One-tap SMS links** (`/a/<token>`) — HMAC-signed, single-appointment scope, expire at slot start. No login needed.
- **Reminders cron** — T-48h confirmation with reschedule link, T-3h prep instructions; under-threshold flagging at T-48h (no auto-cancel; founder decides in M4). Deduped via the events log.
- **Stripe webhooks** — activation, dunning (`past_due` + SMS nudge with portal link), pause/resume/cancel sync.
- **Seed** — one house, one tech, five members, upcoming visits with standing placements.

All founder decisions are stubbed in `src/config/app.ts`; all customer-facing copy (and the brand name) in `src/config/copy.ts` / `BRAND_NAME` env.

## Setup

1. **Supabase**: create a project, then run the migrations in order (SQL editor, or `supabase db push` with the CLI):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`

   In Auth settings, add `<APP_BASE_URL>/auth/callback` to the redirect allowlist (email magic links power member login).
2. **Stripe**: grab the secret key; add a webhook endpoint pointing at `<APP_BASE_URL>/api/webhooks/stripe` for events: `checkout.session.completed`, `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`. Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
3. **Twilio** (optional in dev): SMS bodies print to the server console when env is unset.
4. **Env**: `cp .env.example .env.local` and fill it in. `CRON_SECRET` and `LINK_SECRET` are any long random strings.
5. ```bash
   npm install
   npm run seed   # demo house, tech, 5 members + first visits
   npm run dev
   ```

### Cron

Two endpoints, secured with `Authorization: Bearer $CRON_SECRET`:

- `/api/cron/generate-slots` — daily (creates visits + slots, places standing appointments)
- `/api/cron/reminders` — hourly (T-48h / T-3h reminders, under-threshold flag)

`vercel.json` configures both on Vercel (it sends the header automatically when the `CRON_SECRET` env var is set). On Supabase cron, schedule HTTP calls with the same header.

## Walking the exit test

1. Open `/signup`, pick the seeded house, use a Stripe test card (`4242 4242 4242 4242`) → member becomes `active` via webhook.
2. `npm run generate-slots` (or wait for cron) → new visits auto-book standing members; confirmation SMS (console in dev) carries the one-tap link.
3. Open the one-tap link → move or skip without logging in. Skipping never disables standing.
4. `/login` → email magic link → `/book` to self-serve book/cancel/reschedule.
5. `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders` inside 48h of a slot → reminder SMS; re-running never double-sends (events-log dedupe).
6. Everything that happened is in the `events` table — the founder's eyes.

## Deviations from the spec (intentional, minimal)

- `members.status` gains a `'pending'` value for the gap between signup form and Stripe Checkout completion.
- `members.auth_user_id` / `techs.auth_user_id` columns link Supabase Auth users to rows (required for RLS "own rows" policies). Member login is via email magic link.
- `visits.checked_in_at/checked_out_at` added now (spec §6/§10 needs them in M2 payroll).
- Wall-clock math assumes the server/deployment runs in the market timezone (`APP_TIMEZONE`, single-market MVP).

## Next milestones

M2 (tech app + the wall), M3 (concierge), M4 (founder console + QC digest), M5 (copilot) — see `docs/SPEC.md` §13. The schema for all of them is already in place.
