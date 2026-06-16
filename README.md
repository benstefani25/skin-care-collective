# Skin Care Collective — Milestones 1–5 (complete)

Recurring spray-tan membership platform for sorority houses. This repo implements all five milestones from `docs/SPEC.md`: **M1 (core + signup + booking)**, **M2 (tech app + the wall)**, **M3 (concierge)**, **M4 (founder console + QC digest)**, and **M5 (tech copilot)**.

**M5 exit test:** a tech opens the Copilot tab and asks job questions; the assistant answers only from the uploaded SOPs (e.g. the exact gun PSI), refuses to improvise on anything outside them, and escalates anything medical — every question logged so the founder can see where the SOPs need filling in.

**M4 exit test:** the founder runs the business from `/founder` — an exceptions feed (escalations, failed payments, under-booked visits, low ratings, late techs), house CRM with health metrics, searchable members/techs with edit, a visits calendar (create / reassign / cancel-with-notify), payroll with CSV export, and a weekly AI digest (Healthy / Watch / Act + drafted director check-ins, never auto-sent). Login is the `FOUNDER_EMAIL` magic link; generate a digest on demand from the Digest tab.

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

## Security & secrets

- **Service-role key is server-only.** `src/lib/supabase/admin.ts` (which reads `SUPABASE_SERVICE_ROLE_KEY`) is imported exclusively by Server Components, server actions, route handlers, and server libs — never a `"use client"` component. It bypasses RLS; it must never reach the browser. The tech wall is additionally enforced at the DB layer (see `0005_runsheet_security_invoker.sql`).
- **🔴 HUMAN TASK — rotate any secret that has left a secure environment.** `.env.local` was shipped in a zip during development, so the following must be rotated at their providers before real member data is handled, then updated in Vercel env + local `.env.local`:
  - `STRIPE_SECRET_KEY` (Stripe dashboard → Developers → API keys → roll)
  - `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → reset)
  - `ANTHROPIC_API_KEY` (console.anthropic.com → API keys → rotate)
  - `CRON_SECRET`, `LINK_SECRET` (regenerate: `openssl rand -hex 24`)
  - `TWILIO_AUTH_TOKEN` (when Twilio is connected)
  - After rotating the Stripe key, also recreate the webhook signing secret if needed. Claude Code cannot rotate these for you.
- `.gitignore` covers `.env*`; only `.env.example` (no real values) is tracked.

## Pricing & tax (founder decisions)

- **Price:** $89/mo default (`config.defaultMonthlyPriceCents`), or prepay a 4-month semester. Each house can override `monthly_price_cents` (e.g. a lower founding-house rate). Semester amount derives from the house's monthly price × `semesterIntervalMonths`, minus `semesterPrepayDiscountPct` (default 0).
- **🔴 Processing fees — do NOT surcharge.** Passing Stripe fees to members erodes trust and is operationally messy. Bake them into the headline price. (No code path; this is a standing decision.)
- **🔴 HUMAN TASK — sales tax.** Tanning-*service* taxability varies by state, and there's a federal **10% excise on indoor tanning** (applies to UV tanning; spray/DHA is generally exempt — **confirm per campus state**). To enable: (1) in the Stripe dashboard, activate **Stripe Tax**, set a default product tax category, and add a **registration for each campus state**; (2) set `config.enableStripeTax = true`. Until both are done the flag stays `false` and checkout runs untaxed. Stripe computes the tax; the founder must confirm registration obligations with an accountant.
