# Claude Code Build Instructions — Tier 0, 1, 2

**Project:** `skin-care-collective` (Next.js 15 / React 19 / Supabase / Stripe / Twilio / Anthropic SDK)
**Source of these instructions:** a code review of the current repo. Findings are referenced as [A1], [B1], etc.

## How to use this document

Work **tier by tier, item by item, in order**. Each item has: the problem, the exact change, the files involved, and a **Verify** step. Do not batch-commit a whole tier blind — commit per item with a message like `tier0-2: security_invoker on tech_runsheet`, and run the Verify step before moving on.

**Ground rules for this codebase (do not violate):**
- The tech wall is sacred: techs must never receive member phone, email, last name (beyond initial), full roster, history beyond today, or any export. Any change touching tech-facing reads must preserve this.
- Money paths (`bonus_ledger`, `payroll.ts`, `techops.completeAppointment`) are deterministic code. **Never** route them through the Claude API.
- AI agents read and draft; they never move money and never send to house directors.
- All state changes write an `events` row (the append-only audit log).
- `FOUNDER DECISION` values live in `src/config/app.ts`. Add new tunables there, not inline.
- Before editing, read the file. Several findings below were *already handled correctly* in the code — confirm current state before changing anything, and if a fix is already present, convert the task to "add the missing test" rather than rewriting working code.

**Before starting:** create a branch `hardening/tier-0-1-2`, run `npm run typecheck` and the existing build to establish a green baseline, and confirm you can run the seed + dev server locally.

---

# TIER 0 — Security & correctness blockers (before any real member data)

## T0-1 — Confirm cron endpoints are authenticated [C3]
**Status:** likely already done — `src/lib/cron.ts` exports `cronAuthorized()` and the routes call it. **Confirm, don't assume.**
**Do:**
1. Verify every route under `src/app/api/cron/*` (`generate-slots`, `reminders`, `digest`) calls `cronAuthorized(req)` and returns 401 when it fails. Add it to any that don't.
2. Note the current fail-open-in-dev behavior: `cronAuthorized` returns `true` in non-production when `CRON_SECRET` is unset. That's fine for dev but make sure `CRON_SECRET` **is set in the production environment** — add a startup assertion (or a comment in `.env.example`) so prod can't run without it.
3. Add `CRON_SECRET` to `.env.example` with a comment.
**Verify:** `curl` a cron route in a prod-like env without the bearer header → expect 401. With the correct `Authorization: Bearer $CRON_SECRET` → expect 200.

## T0-2 — Mark `tech_runsheet` as `security_invoker` + explicit RLS for `authenticated` [A1]
**Problem:** the view bypasses base-table RLS (runs as owner). It's safe today only because of its hardcoded `WHERE` clause. Make the wall enforced in two independent layers.
**Do:** create migration `supabase/migrations/0005_runsheet_security_invoker.sql`:
1. Recreate the view with `with (security_invoker = true)`:
   ```sql
   create or replace view public.tech_runsheet
   with (security_invoker = true) as
   select ... ;  -- identical column list to 0002; do not add columns
   ```
   Keep the exact column list from `0002_rls.sql` — first name + last initial, no contact columns.
2. Because `security_invoker` now enforces base-table RLS through the view, the tech's session must be able to *read the underlying rows for her own current-day visit only*. Add explicit, tightly-scoped `select` policies for the `authenticated` role on `appointments`, `slots`, `visits`, `houses`, and `members` that permit **only** rows tied to `public.current_tech_id()`'s visit for `current_date`. Mirror the view's join conditions. The member-facing policies from `0002` stay as-is.
3. Critically: the new tech policies on `members` must **not** be a blanket member-row select — they must be scoped so a tech can only reach member rows that are on her today-visit, and even then the *view* is what she queries (column-limited). Do not grant techs `select *` on `members`.
4. Add a code comment block above the view explaining that the wall is now enforced by BOTH the `WHERE current_tech_id()` filter AND base-table RLS, and that neither may be removed.
**Verify:** see T0-3 (the test is the verification).

## T0-3 — Add the tech-wall integration test [A2]
**Problem:** the most important invariant in the business has no automated test.
**Do:** add a test (use whatever runner you introduce — `vitest` is fine; add it as a devDependency) at `src/__tests__/tech-wall.test.ts` that, against a seeded test DB:
1. Seeds one house, two members (with phone/email/last name), one tech assigned, one visit *today* with one member booked and one member **not** booked.
2. Opens a Supabase client authenticated **as the tech** (not the service role).
3. Asserts:
   - Selecting from `tech_runsheet` returns exactly the one booked member, shows `member_display_name` as "First L." form, and the result object contains **no** `phone`, `email`, or full `last_name` keys.
   - Direct `select *` from `members` as the tech returns **zero** rows for the un-booked member and **zero** contact columns for anyone (ideally zero rows entirely).
   - Selecting `appointments`/`visits`/`houses` as the tech returns only today's own-visit rows.
   - Querying a *different* tech's visit returns zero rows.
4. Add an `npm run test` script.
**Verify:** test passes; then deliberately break it (temporarily remove `security_invoker` or widen a policy) and confirm the test **fails**. Restore.

## T0-4 — Sweep future slots when a member is cancelled or paused [B1]
**Problem:** `customer.subscription.deleted` sets status `cancelled` but leaves future `booked` appointments on the calendar → phantom bookings on tech run sheets. Same for `paused`.
**Do:**
1. Add `cancelFutureAppointmentsForMember(memberId, opts)` to `src/lib/booking.ts`: selects the member's future `booked` appointments, and for each, sets status `cancelled` and reopens the slot (`status='open'`), writing an `appointment.cancelled` event with payload `{ reason: 'membership_ended' }`. Reuse the existing cancel internals; do **not** mark these `cancelled_late` (no fee, not member-initiated).
2. In `src/app/api/webhooks/stripe/route.ts`, call it in `customer.subscription.deleted` (after setting `cancelled`) and in `customer.subscription.updated` when transitioning **into** `paused`.
3. Decide and document pause semantics in a comment: a paused member's future standing slots are released (recommended — she isn't being charged, shouldn't hold a slot). On resume, normal slot generation re-books her next cycle.
**Verify:** unit test: a member with 2 future booked appts → simulate `subscription.deleted` → both appts `cancelled`, both slots `open`, 2 events written.

## T0-5 — Confirm standing generation filters to active members [B2]
**Status:** **already correct** — `placeStandingAppointments` in `src/lib/slots.ts` filters `.eq("status","active")`. **Do not rewrite.**
**Do:** add a regression test asserting that a `paused` and a `cancelled` member with `standing_appointment=true` are **not** auto-booked during generation. This locks the current correct behavior against future edits.
**Verify:** test passes.

## T0-6 — Concierge: deterministic safe reply when escalated [A4]
**Problem:** when the model calls `escalate` (e.g. medical), the member still receives the model's free-text reply, which may contain improvised advice.
**Do:** in `src/lib/concierge.ts`, after the tool loop, if `state.escalated` is true, **override** `reply` with a fixed constant before sending — e.g. `ESCALATION_REPLY = "Thanks for flagging this — a real person from {brandName} will follow up with you personally very shortly. For anything urgent or medical, please contact a healthcare professional."` Use `config.brandName`. Send that instead of the model text. Still log/store as today.
**Verify:** add a concierge test that feeds a medical message ("I'm breaking out in a rash after my tan"), stubs the model to call `escalate`, and asserts the outbound SMS equals the fixed escalation reply, not the model's text. Confirm an escalation event + founder SMS fire.

## T0-7 — Rotate leaked secrets / confirm service-role key is server-only [cybersecurity]
**Problem:** `.env.local` was shipped in a zip; any key that has left the machine should be considered compromised. Also confirm the Supabase **service role** key never reaches the client bundle.
**Do:**
1. Add a clear note to `README.md` / `.env.example`: rotate `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `CRON_SECRET` if they've ever left a secure environment. (Claude Code can't rotate them; flag it as a human task in the PR description.)
2. Audit imports: grep for `supabaseAdmin` / `SUPABASE_SERVICE_ROLE_KEY` and confirm they appear **only** in server-side files (`"use server"`, route handlers, libs imported by those). Never in a Client Component or anything reaching the browser. `src/lib/supabase/admin.ts` must not be imported by client code.
3. Confirm `.gitignore` covers `.env*` (it does) and that no `.env*` with real values is tracked.
**Verify:** `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|supabaseAdmin" src/` shows only server contexts; production build has no service key in client chunks.

---

# TIER 1 — Before a paid pilot (trust, money, resilience)

## T1-1 — Reconcile pricing config with the pricing decision [pricing]
**Problem:** `config.defaultMonthlyPriceCents = 6500` ($65) and the seed uses $65; the business decision was $89 list with a semester-prepay option. Live signup shows $65.
**Do:**
1. Set `defaultMonthlyPriceCents` to the decided value (confirm with founder: spec register said $89 → `8900`). Update seed houses accordingly, but remember each house has its own `monthly_price_cents`, so this is only the default for new houses.
2. Add semester-prepay as a **billing option**, not a new tier: introduce `config.semesterPriceCents` and a second Stripe Price (one-time or scheduled) — see T1-2 note. At signup, let the member choose monthly vs. semester. Keep it a cadence choice; do not add service tiers.
3. Surface the founding-house rate as simply a lower `monthly_price_cents` on that house row — no code path needed beyond per-house pricing, which already exists.
**Verify:** signup for a house shows the correct price; a house with an overridden price shows that price; checkout amount matches.

## T1-2 — Sales tax via Stripe Tax; do NOT surcharge processing fees [pricing/legal]
**Problem:** two separate asks. Passing Stripe fees to customers erodes trust and is operationally messy. Sales-tax treatment of tanning *services* varies by state and isn't optional.
**Do:**
1. **Processing fees:** do not add a surcharge line. Bake into the headline price. (No code; document the decision in README.)
2. **Sales tax:** enable **Stripe Tax** on the subscription/checkout. Configure tax behavior on the Price(s) and enable automatic tax in Checkout Session creation (`automatic_tax: { enabled: true }`) and on the subscription. Capture the member's address at checkout if required for tax calc.
3. Add a `FOUNDER DECISION` note in README: tanning-service taxability and the federal indoor-tanning excise (applies to UV, generally not spray — verify per state) must be confirmed per campus state before launch. Stripe Tax handles computation; the founder must confirm registration obligations.
**Verify:** a test checkout in a taxable state shows tax computed by Stripe; a no-tax state shows none.

## T1-3 — Twilio webhook: acknowledge immediately + idempotency [C1]
**Problem:** `handleInboundSms` runs the full multi-round Claude loop synchronously before the webhook returns. Twilio times out ~15s → retries → duplicate processing (double bookings/messages).
**Do:**
1. Add inbound idempotency: store Twilio's `MessageSid` (add a column or a small `processed_webhooks` table keyed by provider + id). On repeat `MessageSid`, return empty TwiML immediately without reprocessing.
2. Make processing non-blocking: return empty TwiML right away, and run `handleInboundSms` in a background task. On Vercel, use `waitUntil` (from `@vercel/functions` or the platform's `ctx.waitUntil`) so the function responds fast but finishes the work. If `waitUntil` isn't available in the current setup, at minimum keep the idempotency guard so retries don't double-execute, and cap the model loop time.
**Verify:** simulate the same `MessageSid` twice → only one set of side effects. Simulate a slow model turn → webhook still returns quickly; the reply still sends.

## T1-4 — Stripe webhook idempotency [C2]
**Do:** record processed Stripe `event.id`s (reuse the `processed_webhooks` table from T1-3) and no-op on repeats, so future side effects (welcome SMS, etc.) don't duplicate.
**Verify:** replay a `checkout.session.completed` with the same `event.id` → member activated once, one event row.

## T1-5 — Rate-limit signup and inbound paths [D3]
**Problem:** signup creates a Stripe customer per attempt → abuse vector (orphaned customers, spam pending members).
**Do:** add a lightweight rate limiter (per-IP for signup; per-phone for inbound SMS). A simple Supabase-backed counter or an in-memory limiter for single-region is fine at this scale — keep it dependency-light. On signup, also guard against creating a new Stripe customer when a `pending` member with that phone already has one (reuse it).
**Verify:** rapid repeated signups from one IP get throttled; repeated texts from one number don't spawn unbounded model calls.

## T1-6 — Harden phone normalization (it's the identity key) [D4]
**Problem:** the concierge binds the whole security model to "the number that texted us." Any mismatch between `normalizePhone` output and Twilio's `From` format silently turns a member into an "unknown number."
**Do:**
1. Add unit tests for `src/lib/phone.ts` against real Twilio `From` formats (`+1XXXXXXXXXX`, with/without country code, common user-entered formats at signup).
2. Ensure signup stores the **E.164** form and that inbound lookup normalizes `From` identically. Consider storing the raw Twilio format too for debugging.
**Verify:** a member who signs up with `(312) 555-0143` is matched when Twilio delivers `+13125550143`.

## T1-7 — Web signup as the primary path; texting optional [your note + landing]
**Problem:** landing copy implies booking is text-only; the web flow exists and works but isn't presented as primary.
**Do:** update landing + signup copy (`src/app/page.tsx`, `src/config/copy.ts`) so normal web signup/booking is the default presentation and texting is "you can also just text us." No flow rebuild — this is copy + emphasis. (Full marketing site is T2-1.)
**Verify:** landing communicates web-first; signup still works end to end.

## T1-8 — Tech "running late" broadcast + completion guard [your note]
**Do:**
1. Add a tech action on the run sheet: "Running ~15 min late" → sends a templated SMS to **today's booked members only**, via the relay/`sendSms` server-side (no numbers exposed to the tech). Add the copy to `src/config/copy.ts` and a tunable default delay. Log an event.
2. Completion guard: show a counter on the run sheet ("3 of 11 complete"). When the tech taps **End visit** with booked appointments still un-actioned (neither completed nor no-show), show a confirmation warning ("You have 4 members not yet marked done — end anyway?") rather than silently completing.
**Verify:** late broadcast reaches only today's booked members; ending a visit with unfinished appts prompts a confirm.

## T1-9 — Reconcile the `past_due` grace policy [B3]
**Problem:** `config.pastDueGraceAppointments = 1` exists but `bookAppointment` hard-blocks all non-active members; the grace is never applied.
**Do:** pick one and make code + config agree. Recommended for MVP: **honor already-booked appointments once** but block *new* bookings for `past_due` (which the booking lib already does). Simplest correct path: remove the unused `pastDueGraceAppointments` config and document that past-due blocks new bookings while existing booked appts are honored until the visit. If the founder wants real grace, implement it explicitly. Don't leave config that does nothing.
**Verify:** behavior matches whatever the README now states.

---

# TIER 2 — Growth & operations (the build-out)

> These are larger; treat each as its own mini-project with its own commits. Order within the tier is roughly dependency order — do T2-2 (roles) before T2-3 (staff CRUD).

## T2-1 — Real marketing landing site (skin-health-conscious framing) [your note]
**Do:** build a proper marketing layer in front of the existing signup flow: hero, how-it-works, prep & aftercare, "skin-conscious care" content, FAQ, social proof, clear CTA into `/signup`. Keep claims **defensible** — spray tan (DHA) is cosmetic; frame around skin-conscious/gentle care, not health claims. Do **not** touch the working signup/booking flow. Read `/mnt/skills/public/frontend-design/SKILL.md` conventions if available; keep the brand name config-driven (`config.brandName`).
**Verify:** Lighthouse pass on mobile; all CTAs route to signup; no medical claims.

## T2-2 — Real staff/role model (prerequisite for staff management) [A3]
**Problem:** founder access is a single env-var email match; there's no role model for adding staff.
**Do:** introduce a `role` concept (`founder` | `tech`), backed by a column on a staff/users table or an explicit `staff` table, rather than the `FOUNDER_EMAIL` string check. Migrate `requireFounder`/`isFounder` to read the role. Keep the env-var founder as a bootstrap fallback for the very first login. This unblocks T2-3.
**Verify:** founder access works via role; a non-founder authenticated user is denied founder routes; tests cover both.

## T2-3 — Founder console: add/edit techs & wages [your note]
**Do:** build founder-console CRUD on `techs`: add a tech (creates the row in `applicant`/`active`), edit `base_rate_cents`, `deferred_rate_cents`, `semester_number`, `status`, and house assignments (`tech_house_assignments`). All mutations write events. Gate on the T2-2 role. Wage edits must be founder-only and audit-logged.
**Verify:** founder can add a tech, set wages, assign a house; tech then sees her run sheet; all changes appear in events.

## T2-4 — House-centric model: founder creates houses, tokenized signup links, campus→house filter [your notes]
**Do:**
1. Founder-console action to create/edit houses (you have the schema; add the UI + actions). House status pipeline `prospect → active`.
2. **Tokenized per-house signup links** — each house gets an opaque token; `/signup` is reached via the house link rather than choosing from a global dropdown. Don't expose a global house list publicly. Keep the campus→house **filter** only for the founder/admin side or behind the tokenized entry.
3. Members join only via their house's link; signup validates the token → house.
**Verify:** a house link lands on a pre-scoped signup; no public endpoint enumerates all houses; founder can create a house and generate its link.

## T2-5 — House contacts CRM (house mom, president, etc.) [your note]
**Do:** add a `house_contacts` table (`house_id`, `role`, `name`, `contact`, `notes`), founder-only via RLS, never exposed to techs or members. Surface in the house detail page. Migrate the existing `house_director_name/contact` columns into it or keep them and add the table for additional roles (document which).
**Verify:** founder can store/edit a house mom; the data never appears in any tech or member query (extend the T0-3 test to assert this).

## T2-6 — Unify QC digest + "Jarvis" into one read-only ops agent [your note]
**Do:** consolidate `src/lib/qc.ts` (weekly digest) and a new ad-hoc ops assistant into a single **read-only** founder agent. Tools query `events`, `visits`, `appointments`, `payroll`, `surveys`, exceptions — **read only**, no mutations, never sends to house directors (it may *draft* a check-in message for the founder to send). Two entry points, one brain: a scheduled **morning brief** and an **ask-anytime** console chat. Reuse the prompt-versioning pattern in `src/config/prompts.ts`. Same hard guardrails as the concierge (no money, medical → flag for founder, honest about being AI).
**Verify:** the agent answers "what's my labor % and outstanding deferred liability this month" from real data; attempting any mutation is impossible (no mutating tools bound); morning brief generates.

## T2-7 — Payroll provider export (taxes/filings stay with a real provider) [your note]
**Do:** do **not** build payroll-tax filing. Extend the existing `payroll.ts` / CSV export to produce a clean, provider-importable file (hours, completed tans, gross base, top-ups, deferred) suitable for Gusto-style import. Optionally add a **read-only** CFO view (this can be part of T2-6's agent): labor %, deferred liability outstanding, per-house cost. The system computes and exports; the provider files taxes.
**Verify:** export opens cleanly and maps to payroll-provider import columns; numbers reconcile against `bonus_ledger` and completed appointments.

## T2-8 — Liaison/rep program: flag + attribution (hold the cash mechanics) [your note]
**Do:**
1. Add `role`/flag on `members` for `liaison` and a referral-attribution mechanism (who referred whom — a `referred_by_member_id` column or a `referrals` table), plus a founder task reminder for the quarterly liaison review.
2. **Do not** implement per-head cash bounties yet — flag in the PR that the *optics* of per-signup cash to a peer promoter need a founder decision (prefer a flat stipend or free/reduced membership). Build the attribution plumbing so either model can sit on top later.
**Verify:** a member can be marked a liaison; signups can be attributed to her; quarterly review surfaces as a founder task. No cash logic wired yet.

## T2-9 — Generate Supabase types; replace `any`; centralize model selection [D1, D2]
**Do:**
1. Run `supabase gen types typescript` and wire the generated types into the Supabase clients; replace the pervasive `any` in libs and pages with real row types. This will surface latent shape bugs — fix them as they appear.
2. Centralize Claude model selection in `config` (one place reads `CONCIERGE_MODEL`/`COPILOT_MODEL`/etc. with documented defaults) so model upgrades are a one-file change.
**Verify:** `npm run typecheck` passes with `any` removed from the data layer; model names appear in exactly one config module.

---

# Cross-cutting: testing & PR hygiene

- Introduce a test runner (`vitest`) as part of T0-3 and reuse it for every "Verify" that says "test."
- Each item = its own commit; each tier = its own PR (or a clearly sectioned single PR) so the founder can review Tier 0 independently and ship it before the rest.
- In the PR description, surface the **human-only tasks** that Claude Code cannot do: rotate leaked secrets (T0-7), confirm per-state tanning-service tax registration (T1-2), confirm the $89 price (T1-1), and decide liaison cash mechanics (T2-8).
- Do not weaken or remove any existing security check to make a feature easier. If a feature seems to require it, stop and flag it instead.

# Suggested sequencing
Ship **Tier 0 as its own PR first** — it's the set where a mistake exposes contact data or corrupts bookings, and it's small enough to land quickly. Then **Tier 1** before inviting any paying member. **Tier 2** items are independent enough to land one at a time in priority order (founder's call; T2-1 marketing site and T2-4 house model are the highest-leverage for growth).
