# Skin Care Collective platform

Mobile spray-tan membership platform for sorority houses, operated fully remotely by the founder. Full original handoff spec: `docs/SPEC.md`. Active work specs: `docs/scc-website-build-CONSOLIDATED.md` (website) and `docs/scc-claude-code-instructions.md` (security/correctness hardening). Read the relevant doc before building.

## Non-negotiable invariants
1. **Techs never see member contact info** — no phone/email/last name in any tech-facing query or API payload. Enforced at the DB layer (`tech_runsheet` view + RLS), never client-side.
2. **No money at appointments** — Stripe only; no payment surface in the tech app, no refunds/charges in any AI agent tool.
3. **All member↔tech communication goes through the masked brand number.**
4. Every meaningful state change writes to the append-only `events` table (the remote founder's only window into operations). `bonus_ledger` is written only by deterministic payroll code — never AI.

## Build status
- **M1–M5 (done & verified):** schema+RLS, slot generation + standing placement, member signup/book/cancel/reschedule, reminders, Stripe webhooks; tech run sheet (reads `tech_runsheet` view via tech's own session) + check-in/complete/no-show + deferred bonus accrual w/ semester escalator + payroll CSV w/ minimum-wage true-up; member concierge (inbound SMS → Claude tool-use, server-bound to texting member, no money tools, medical→escalate); founder console at `/founder` (exceptions, house CRM, members/techs, visits calendar, payroll, QC weekly digest); tech copilot (SOP-grounded, wall applies to context).

## ACTIVE WORK (post-M5 — see docs/)
Two streams, shippable as separate PRs:

### Website stream — `docs/scc-website-build-CONSOLIDATED.md`
- **Dark espresso editorial theme ("Treatment B") applied site-wide** — REPLACES the old light-cream `:root` palette. Hero gradient `#b58e6e→#8f6a47→#4a3624` + dark scrim, espresso page bgs `#161310`, lifted form inputs `#221d18` w/ visible borders (critical for dark-form legibility), near-white `#fbf8f2` headings in Fraunces, soft `#cfc7ba` body, squared off-white buttons. (Part A-0 is authoritative on tokens.)
- Hero CTAs: primary **"Sign Up"** (→ signup, house picked inside) + secondary **"Request your house"** (→ new-chapter interest form). House selection folded INTO signup (supersedes an earlier two-button "Find your house" design).
- New pages: How it works, Tan Care (Prep + Aftercare), Pricing, FAQ, Contact, request-house. Ready copy is in the doc. Express-only positioning (NEVER mention traditional/overnight tans); cosmetic framing only (no health/sun-protection claims; rinse-timing numbers are provisional config).
- **Deferred billing (C-1b, HIGH PRIORITY):** signup must SAVE the card (Stripe `mode:"setup"` / SetupIntent) and NOT charge. New member status `card_on_file` (excluded from billing + auto-booking). Per-house founder "launch" action creates the real subscription + first charge in August, moves member to `active`. Handle launch-time charge failures gracefully (notify + flag, never drop). Clear deferred-billing disclosure at signup. The CURRENT signup wrongly creates a charging subscription — this must change before collecting founding members.
- Staff auth: persistent sessions for all roles + real passwords for staff (members keep magic links).
- E-signature waiver + SMS consent at signup (typed signature + immutable timestamped record; content needs legal review).
- Read-only founder "ops agent" (the chat UI currently shown is a dead stub — hide it now; build the real read-only agent as its own PR).

### Hardening stream — `docs/scc-claude-code-instructions.md`
Tier 0 (before real member data): mark `tech_runsheet` `security_invoker` + add the tech-wall integration test; fix cancelled/paused members keeping future slots; deterministic safe-reply on concierge escalate; confirm cron auth; rotate leaked secrets. Tier 1: pricing reconciliation ($89 vs the $65 still in config), Stripe Tax, webhook idempotency + async Twilio, rate limiting, phone-normalization tests. Tier 2: marketing site, staff roles, CRM, ops agent, payroll-provider export, liaison program, Supabase types.

## Known environment state (discovered, verify before launch)
- **Stripe + Supabase**: keys present in Vercel (Supabase connected; Stripe connected — CONFIRM test vs live mode before charging real members).
- **Anthropic**: key present (rotated recently).
- **Twilio**: NOT set up (no account/keys). ALL SMS features (concierge replies, reminders, relay) are dormant until Twilio + A2P 10DLC registration is done. This is a human task with carrier-approval lead time.
- Local `.env.local` lacks the Stripe/Supabase keys that Vercel has — local dev needs them copied in.

## AI agents
- System prompts are versioned config in `src/config/prompts.ts` (never inline). Models centralized via config. Every agent tool call writes an event; escalations set `escalated=true`. AI never writes `bonus_ledger` or moves money. No agent sends to house directors (drafts only).

## Layout
- `supabase/migrations/` — schema (0001), RLS + tech_runsheet view (0002), plus new hardening migrations
- `src/config/` — founder decisions (`app.ts`) and ALL customer-facing copy (`copy.ts`; brand name is config, never hardcode)
- `src/lib/` — business rules (booking, slots), integrations (stripe, twilio), agents (concierge, copilot, qc), signed links
- `src/app/` — member/tech/founder pages + API routes (webhooks, cron)
- Mutations run server-side via the service role; RLS covers direct client reads.

## Commands
- `npm run dev` / `npm run build` / `npm run typecheck`
- `npm run seed` — demo data (idempotent)
- `npm run generate-slots`, `npm run payroll`, `npm run sms -- "+1..." "text"`

## Working rules for this codebase
- Read the relevant doc before building; one item = one commit; run each Verify step.
- Don't weaken any security check to make a feature easier — stop and flag instead.
- Don't build the spec's non-goals.
- All copy in `copy.ts`; brand name + price via config, never hardcoded.
