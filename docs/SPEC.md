# Mobile Spray Tan Platform — Build Specification

**Working name:** Skin Care Collective (brand name is undecided — treat all customer-facing copy and the brand name as config, not hardcoded strings.)

**Audience:** This document is a handoff spec for Claude Code. It contains business context, the data model, business rules, surface-by-surface requirements, AI agent specs, and a phased build plan. Build in milestone order (Section 13). Where a decision is marked `FOUNDER DECISION`, stub a sensible default in config and flag it — do not block on it.

---

## 1. Business context (read first — it explains the architecture)

The business delivers recurring spray tans to sorority house members. Technicians travel to the house on fixed visit days (~twice monthly per house); members hold a flat monthly membership and book slots within each visit. The founder operates **fully remotely** — he can never be on-site during service delivery — so the platform is his only window into operations.

**The single most important design constraint:** the technician must never possess the customer relationship. Techs are the most likely competitive threat (low equipment cost, low skill ceiling, they're physically with the customers). The platform's defensive job is to ensure that all identity, payment, communication, and history live in the platform, and the tech receives only ephemeral, day-of execution data.

Three non-negotiable invariants that follow from this. Every feature must preserve them:

1. **Techs never see member contact information.** No phone numbers, no emails, no full rosters, no historical lists, no exports. Run sheets show first name + last initial, time, room, and service notes only. Enforce at the database layer (RLS + restricted views), never with client-side filtering alone.
2. **No money ever changes hands at an appointment.** All payment is a Stripe subscription with card on file. There is no payment surface in the tech app at all.
3. **All member↔tech communication routes through the platform's masked brand number.** Neither party ever sees the other's real contact info. The relay must be fast and pleasant enough that nobody is tempted to swap numbers.

A second constraint: the founder cannot observe operations physically, so **everything writes to an append-only events log**. Telemetry is not nice-to-have; it is the founder's eyes.

---

## 2. System overview and stack

Hub-and-spoke: one data core, thin surfaces around it.

| Component | Choice | Notes |
|---|---|---|
| Data core | Supabase (Postgres + Auth + RLS + storage) | Single source of truth |
| Payments | Stripe Billing (subscriptions, customer portal) | Webhooks into the core |
| Messaging | Twilio (one branded SMS number per market) | Webhook → concierge agent |
| Member surface | Next.js web app (mobile-first; no native app) | Booking + account pages |
| Tech surface | Next.js web app (separate auth role) | Run sheet, check-in, copilot, relay inbox |
| Founder console | Next.js admin app (founder role only) | Exceptions, metrics, house CRM |
| AI agents | Claude API (Anthropic Messages API with tool use) | Concierge, tech copilot, QC analyst |
| Scheduled jobs | Supabase cron / edge functions | Slot generation, reminders, digests, payroll calc |

For Claude API integration details (current models, SDK usage, tool use schema), consult the live docs map at https://docs.claude.com/en/docs_site_map.md rather than assuming — model names and APIs change.

All three web surfaces can live in one Next.js repo with role-gated routes. Keep them deliberately thin; the value is in the schema and the rules.

---

## 3. Data model

All tables get `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`. Soft-delete via `status` columns; never hard-delete members or events.

### houses
- `name`, `campus`, `address`
- `access_notes` (text — parking, entrance, quiet hours; visible to techs)
- `house_director_name`, `house_director_contact` (**founder-only columns** — exclude from every non-founder view)
- `visit_weekday` (int), `visit_cadence` ('biweekly' default), `visit_window_start`, `visit_window_end` (time)
- `slot_duration_minutes` (default 20; `FOUNDER DECISION`)
- `monthly_price_cents` (per-house pricing allowed)
- `status` ('prospect' | 'active' | 'paused' | 'churned')

### members
- `house_id` fk
- `first_name`, `last_name`, `phone` (E.164, unique), `email`
- `stripe_customer_id`, `stripe_subscription_id`
- `shade_preference` (text), `service_notes` (text — allergies, preferences; visible to techs)
- `standing_appointment` (bool, **default true** — opt-out, not opt-in)
- `standing_window` ('early' | 'mid' | 'late' | null — coarse preference within the visit window)
- `status` ('active' | 'paused' | 'past_due' | 'cancelled')
- `graduation_year` (churn forecasting)

### techs
- `first_name`, `last_name`, `phone`, `email`
- `base_rate_cents` (per completed tan), `deferred_rate_cents` (per completed tan, accrues to semester-end bonus)
- `semester_number` (int — tenure; used by the retention escalator later, just record it now)
- `status` ('applicant' | 'active' | 'offboarded')
- `hired_at`, `offboarded_at`

### tech_house_assignments
- `tech_id` fk, `house_id` fk, `active` bool

### visits
One tech-day at one house.
- `house_id` fk, `tech_id` fk, `date`, `window_start`, `window_end`
- `status` ('scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'under_threshold')

### slots
- `visit_id` fk, `start_time`, `duration_minutes`
- `status` ('open' | 'held_standing' | 'booked' | 'blocked')

### appointments
- `slot_id` fk, `member_id` fk
- `status` ('booked' | 'completed' | 'no_show' | 'cancelled' | 'cancelled_late')
- `source` ('standing' | 'self_serve' | 'concierge')
- `checked_in_at`, `checked_out_at`

### messages
The relay log.
- `member_id` fk nullable, `tech_id` fk nullable, `direction` ('inbound' | 'outbound')
- `body`, `channel` ('sms')
- `handled_by` ('concierge_ai' | 'relay' | 'founder')
- `escalated` bool

### events  *(append-only — the founder's eyes)*
- `type` (e.g. 'appointment.booked', 'appointment.no_show', 'visit.checked_in', 'member.paused', 'message.escalated', 'payment.failed', 'bonus.accrued')
- `actor_type` ('member' | 'tech' | 'founder' | 'system' | 'ai'), `actor_id`
- `house_id`, `member_id`, `tech_id`, `appointment_id` (all nullable — fill what applies)
- `payload` jsonb
- No updates or deletes, ever. Add a Postgres rule or revoke UPDATE/DELETE.

### bonus_ledger
Deterministic money records — **never written by AI, only by payroll code**.
- `tech_id` fk, `appointment_id` fk nullable
- `type` ('deferred_accrual' | 'payout' | 'forfeiture' | 'adjustment')
- `amount_cents`, `semester` (e.g. 'F26'), `note`

### surveys
- `appointment_id` fk, `rating` (1–5), `comment` text nullable

### sop_documents
Markdown SOPs uploaded by the founder; the tech copilot's grounding corpus.
- `title`, `body` (markdown), `category`, `version`, `active` bool

---

## 4. Booking engine rules (MVP scope)

**Slot generation.** A scheduled job creates `visits` from each house's cadence N weeks ahead (default 3), then generates `slots` across the visit window at the house's slot duration.

**Standing appointments are placed first.** At slot generation, every member with `standing_appointment = true` gets an appointment auto-created (`source = 'standing'`) in her preferred window, slots marked accordingly. She receives an SMS: confirmation + one-tap reschedule/skip link. Skipping one visit does NOT disable the standing flag.

**General booking opens immediately after standing placement** (the staged/conditional release logic is explicitly deferred — see Section 14). Members book via the member app or by texting the concierge.

**Cancellation policy.** Free cancel/reschedule until `cancellation_window_hours` before the slot (default 24; `FOUNDER DECISION`). After the window → `cancelled_late`. MVP imposes no fee; just record it (the data informs future policy).

**No-shows.** Only the tech marks no-shows, via the run sheet. Writes an event; the concierge sends the member a friendly "we missed you" + rebook link.

**Under-threshold visits.** If booked appointments < `visit_minimum` (default 5; `FOUNDER DECISION`) at T-48h, set visit status `under_threshold` and surface it in the founder console. **No automatic cancellation in MVP** — founder decides, and if he cancels, the concierge notifies booked members with rebook links.

**Reminders.** T-48h: confirmation with reschedule link. T-3h: reminder with prep instructions (exfoliate, no lotion, loose dark clothing — copy in config).

---

## 5. Member surface

Mobile-first web app. Pages:

1. **Signup** — reached via QR code/link distributed at the house. Select house → name/phone/email → Stripe Checkout for the subscription → shade preference + standing-appointment choice (pre-checked ON, with plain-language explanation: "we'll auto-book you each visit; skip any time with one tap").
2. **Book/manage** — upcoming visits for her house, open slots, her appointments, one-tap reschedule/cancel (respecting the cancellation window).
3. **Account** — Stripe customer portal link (card, pause, cancel), shade preference, standing toggle.

Important: members will do most things by **texting the brand number**, not the app. The app is the fallback and the signup funnel; the concierge is the primary interface. Build accordingly — every member-app action must also be executable by the concierge's tools.

Membership pause: use Stripe's pause-collection for summer/semester breaks. Surface "pause" prominently in May — a paused member is not a churned member. (`FOUNDER DECISION`: pause policy details.)

---

## 6. Tech surface

The defensive perimeter. Auth role `tech`. Screens:

1. **Today** (home) — only renders on a day with an assigned visit, available from 6:00 AM local. Shows: house name, address, `access_notes`, slot list with first name + last initial, time, room number (from booking flow — add `room` text field to appointments), `shade_preference`, `service_notes`. Buttons per appointment: **Check in**, **Complete**, **No-show**. A **Check in to visit / End visit** pair at the top for the visit itself (these timestamps are payroll and reliability telemetry).
2. **Earnings** — current period completed-tan count and base pay; **deferred bonus balance, prominent**, with semester payout date. This screen is a retention feature: every open of the app shows the number she'd forfeit by leaving.
3. **Messages** — relay inbox: member messages forwarded to her (first name only), her replies routed back out through the brand number.
4. **Copilot** — chat with the SOP-grounded assistant (Section 11).

What the tech surface must NEVER contain, enforced by RLS and column-restricted views, not UI:
- Member phone/email/last name (anywhere, including API payloads — inspect network responses in testing)
- Any appointment data outside `visit.date = today` for her own assigned visits
- Any roster or member list view
- Any export, copy-all, or print function
- Any payment function

---

## 7. Founder console

Auth role `founder`. Don't over-build; this is one user.

- **Exceptions feed** (home): under-threshold visits, escalated messages, failed payments, no-show spikes, survey ratings ≤ 3, tech check-ins missing 15 min past visit start.
- **Houses**: CRM-lite — status pipeline (prospect → active), director contact, notes, insurance doc storage (Supabase storage), per-house health: active members, churn, avg rating, fill rate.
- **Members / Techs**: searchable tables, full detail, manual edit.
- **Visits calendar**: all houses, all techs; create/cancel visits; reassign techs.
- **Payroll**: per-period view (Section 10) with CSV export.
- **Weekly digest**: rendered output of the QC analyst (Section 11).

---

## 8. Messaging layer

One Twilio number per market = the brand identity. All traffic flows:

- **Inbound member SMS** → webhook → look up member by phone → route to **concierge agent**. Unknown numbers get a polite signup pointer.
- **Concierge escalation** → flags the message, notifies founder (push/email), founder replies from console through the same number.
- **Member↔tech relay**: messages the concierge classifies as day-of coordination for an active appointment ("running late", "I'm in room 12") are forwarded to the assigned tech's Messages screen; her reply returns via the brand number. Neither side ever sees a personal number.
- **Outbound system messages**: standing confirmations, reminders, no-show follow-ups, dunning nudges.

Log every message in `messages` and mirror significant ones to `events`.

---

## 9. Payments (Stripe)

- One subscription product; per-house price via `monthly_price_cents`.
- Stripe Checkout for signup; Stripe Customer Portal for card/pause/cancel (minimizes PCI surface and build time).
- Webhooks: `checkout.session.completed` (activate member), `invoice.payment_failed` (status → `past_due`, concierge sends a friendly nudge with portal link), `customer.subscription.paused/resumed/deleted` (status sync).
- A `past_due` member cannot book new appointments; existing booked appointments are honored once (grace), then blocked. (`FOUNDER DECISION`: grace policy.)
- There is no refund, charge, or payment-collection capability anywhere in the tech surface or in any AI agent's tools. Refunds are founder-only, manual, in the Stripe dashboard.

---

## 10. Payroll and bonus ledger

**Deterministic code only. The Claude API is never in this path.**

Per pay period (biweekly default):
- `completed` appointments per tech × `base_rate_cents` = base pay. Output a CSV from the founder console; actual payment happens outside the system for MVP.
- Each `completed` appointment also inserts a `bonus_ledger` row: `deferred_accrual` × `deferred_rate_cents`.
- At semester end (`FOUNDER DECISION`: dates per campus), an active tech's accruals sum to a `payout` row; an offboarded tech's open accruals convert to `forfeiture` per her agreement terms.
- The Earnings screen reads live from this ledger.

**Minimum-wage true-up (required).** Techs are paid piece-rate, so payroll must verify each tech clears the applicable wage floor every pay period. Add `minimum_wage_cents` as per-house (or per-campus) config — floors differ by jurisdiction (e.g., Illinois statewide vs. City of Chicago, which adjusts each July). Per period: hours worked = sum of (visit check-out − check-in) + a configurable travel/setup allowance per visit (default 60 min). If base pay ÷ hours < the floor, insert a deterministic top-up line item and log an event (`payroll.wage_floor_topup`). Count only base pay toward the floor — never deferred accruals. The visit minimum guarantee makes this nearly always a no-op, but it must exist and leave an audit trail.

**Deferred escalator.** `deferred_rate_cents` is a function of `semester_number`: $2.50 base, +$2.50 per completed semester retained ($2.50 → $5.00 → $7.50, capped at $7.50 unless founder overrides). Apply the tech's current-semester rate at accrual time; never retroactively restate prior accruals.

Compliance note for the founder (not a build task): deferred amounts must be structured as a true bonus on top of fair base pay, per employment counsel. The system just records; the contract defines. Classification (employee vs. contractor) determines whether the wage-floor logic is legally required — build it regardless.

---

## 11. AI agents (Claude API)

Shared guardrails for ALL agents:
- No agent can move money, alter rates, write to `bonus_ledger`, or change a member's subscription state directly (pause requests → escalate or hand the member the Stripe portal link).
- No agent ever reveals one member's information to another member, or any member contact info to a tech.
- Anything touching skin reactions, allergies, injuries, or medical territory → immediate escalation to founder + a safe canned response. Log with `escalated = true`.
- Every agent action that mutates data writes an `events` row with `actor_type = 'ai'`.
- System prompts live in versioned config, not code constants.

### 11a. Member concierge (the front desk)
- **Trigger:** inbound SMS webhook.
- **Context:** member record, her upcoming appointments, her house's upcoming visits and open slots, FAQ/policy document, last ~10 messages.
- **Tools:** `get_open_slots(visit_id)`, `book_appointment(member_id, slot_id)`, `reschedule_appointment(appointment_id, new_slot_id)`, `cancel_appointment(appointment_id)`, `toggle_standing(member_id, bool)`, `send_portal_link(member_id)`, `forward_to_tech(message)`, `escalate(reason)`.
- **Behavior:** warm, concise, texts like a competent human front desk — not chirpy, no emoji spam. Always confirms mutations ("Done — you're moved to 7:20pm Thursday."). Enforces the cancellation window in conversation rather than letting the tool error. Never argues; edge cases escalate.
- **Honesty rule:** if asked whether it's a bot, it says yes, cheerfully. This demographic screenshots everything; never configure an agent to claim to be human.

### 11b. Tech copilot
- **Trigger:** chat in the tech app.
- **Context:** active `sop_documents` (inject directly at this corpus size — no vector search needed for MVP), today's run sheet metadata (no contact info — same wall applies to context construction).
- **Tools:** `escalate(reason)`, `search_sops(query)` (optional).
- **Behavior:** practical troubleshooting grounded in SOPs; says "I don't have guidance on that — escalating to [founder]" rather than improvising on anything outside the corpus. Hard medical-escalation rule per shared guardrails. Log all Q&A — questions are the founder's map of where training is thin.

### 11c. QC analyst (weekly digest)
- **Trigger:** weekly cron.
- **Input:** per house, trailing 14 days — survey ratings and comments, no-show/late-cancel rates vs. prior period, fill rate, escalation count, message sentiment sample.
- **Output:** a founder digest — three sections: *Healthy*, *Watch*, *Act* — with one-line evidence per flag, plus a **drafted** check-in message to any house director where *Act* applies. Stored to the console and emailed. **Never auto-sent to anyone external.**

---

## 12. Security and privacy requirements

- Postgres RLS on every table; deny-by-default. Tech role policies: rows only where `visit.tech_id = auth tech` AND `visit.date = current_date`; member contact columns excluded via a `tech_runsheet` view — tech-facing endpoints query the view, never base tables.
- Member role: own rows only, plus open slots for her own house.
- Founder role: full access.
- Service-role keys only in server-side code; never shipped to clients.
- Twilio webhook signature validation; Stripe webhook signature validation.
- Phone numbers are PII: encrypt at rest where Supabase allows, never log raw numbers in application logs.
- No analytics scripts that exfiltrate member data to third parties.

---

## 13. Build phases

**M1 — Core + signup + booking (single pilot house).** Schema, RLS, slot generation job, member signup with Stripe Checkout, member book/cancel/reschedule pages, Twilio reminders (one-way). *Exit test: a member can sign up, pay, get auto-booked via standing appointment, reschedule herself, and receive reminders — with zero founder involvement.*

**M2 — Tech app + the wall.** Run sheet, check-in/complete/no-show, earnings screen, bonus accrual, payroll CSV. *Exit test: a tech can run a full visit day from her phone, and a security review of every tech-facing API response confirms no contact info leaks.*

**M3 — Concierge.** Inbound SMS agent with full tool set, relay routing, escalation to founder. *Exit test: 10 realistic member text scenarios (reschedule, cancel late, pause request, prep question, complaint, medical mention) handled correctly, with the medical one escalating.*

**M4 — Founder console + QC digest.** Exceptions feed, house CRM, visits calendar, weekly digest job. *Exit test: founder can run a week of two houses entirely from the console.*

**M5 — Copilot.** SOP storage + tech chat. (Lowest urgency; founder can be the copilot via escalations until tech count grows.)

---

## 14. Explicitly OUT of scope (do not build, do not pre-architect beyond the schema)

- Conditional/staged slot release and expanding-block scheduling
- Multi-house same-day routing and travel-time optimization
- Waitlists
- Automatic under-threshold visit cancellation
- Native mobile apps
- Add-on purchases / non-membership pricing tiers
- Brand partnership / device features of any kind
- Multi-founder roles and permissions

The schema as designed supports all of these later without migration pain; that is the only accommodation they get now.

## 15. `FOUNDER DECISION` register (stub defaults, surface in config)

| Decision | Default stub |
|---|---|
| Monthly membership price | $65/mo |
| Slot duration | 20 min |
| Cancellation window | 24 h |
| Visit minimum threshold | 5 booked |
| Base rate / deferred rate per tan | $10 / $2.50 (DECIDED) |
| Deferred escalator | +$2.50 per semester retained: $2.50 → $5.00 → $7.50 (DECIDED) |
| Past-due grace policy | honor 1 booked appt |
| Semester dates per campus | F26: Aug 24 – Dec 18 |
| Summer pause behavior | member-initiated via portal |
| Brand name + all customer-facing copy | "Skin Care Collective" |

## 16. Configuration

Environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_BRAND_NUMBER`, `ANTHROPIC_API_KEY`, `APP_BASE_URL`, `BRAND_NAME`.

Seed script: one house, one tech, five members, one upcoming visit — so every surface is demo-able immediately after M1.
