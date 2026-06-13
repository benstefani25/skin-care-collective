# Skin Care Collective platform

Mobile spray-tan membership platform for sorority houses. Full handoff spec: `docs/SPEC.md` — read it before building anything new.

## Non-negotiable invariants (spec §1)
1. **Techs never see member contact info** — no phone/email/last name in any tech-facing query or API payload. Enforced at the DB layer (`tech_runsheet` view + RLS), never client-side.
2. **No money at appointments** — Stripe subscription only; no payment surface in the tech app, no refunds/charges in any AI agent tool.
3. **All member↔tech communication goes through the masked brand number.**

Also: every meaningful state change writes to the append-only `events` table (the remote founder's only window into operations), and `bonus_ledger` is written only by deterministic payroll code — never AI.

## Status
- **M1 (done):** schema + RLS, slot generation + standing placement, Stripe Checkout signup, member book/cancel/reschedule, one-tap SMS links, reminders, Stripe webhooks, seed.
- **M2 (done):** tech run sheet (reads `tech_runsheet` view via the tech's own session — never base tables), visit + appointment check-in/complete/no-show, missed-you SMS, deferred bonus accrual with semester escalator, earnings screen, biweekly payroll CSV with minimum-wage true-up (`npm run payroll`). Wall verified: tech JWT gets today's view rows only, `[]` from every base table.
- **M3 (done):** member concierge (spec §11a) — inbound SMS → Claude (`claude-opus-4-8`) with tool use → SMS reply. Tools bound server-side to the texting member (book/reschedule/cancel/toggle-standing/portal-link/forward-to-tech/escalate); no money tools exist. Medical/complaint/refund → escalate; pause/card/cancel → portal link. Tech relay inbox at `/tech/messages`. Inbound webhook at `/api/webhooks/twilio` (signature-validated in prod). Test harness: `npm run sms -- "+1..." "text"`. 10-scenario exit test passed incl. medical escalation.
- **M4 (done):** founder console at `/founder` (gated by `FOUNDER_EMAIL`, single owner per §7/§14). Exceptions feed (escalations, past-due, under-threshold, low ratings, no-show spike, tech-not-checked-in), house CRM with health (active/churn/avg rating/fill rate) + status/director/insurance edit, searchable members & techs with manual edit, visits calendar (create+generate slots / reassign / cancel-with-member-notify), payroll view + CSV export at `/founder/payroll/export`, and the QC analyst weekly digest (`src/lib/qc.ts`, `claude-opus-4-8`) — Healthy/Watch/Act with evidence + drafted director check-ins, stored to `digests`, never auto-sent. Cron `/api/cron/digest` (weekly).
- **M5 (not built):** tech copilot. See spec §13 (lowest priority).

## AI agents
- System prompts are versioned config in `src/config/prompts.ts` (never inline). Bump `CONCIERGE_PROMPT_VERSION` on changes — it's stamped into events.
- Every agent tool call writes a `concierge.tool_used` event; escalations write `message.escalated` with `escalated=true` on the message. AI never writes `bonus_ledger` or moves money.
- `ANTHROPIC_API_KEY` required for the concierge; `FOUNDER_PHONE` (optional) gets escalation texts.
- Spec §14 lists explicit non-goals — do not build them.

## Layout
- `supabase/migrations/` — schema (0001) and RLS + tech_runsheet view (0002)
- `src/config/` — founder decisions (`app.ts`) and ALL customer-facing copy (`copy.ts`; brand name is config, never hardcode)
- `src/lib/` — business rules (booking.ts, slots.ts), integrations (stripe, twilio), signed one-tap links (links.ts)
- `src/app/` — member pages + API routes (webhooks, cron)
- Mutations run server-side via the service role; RLS covers direct client reads.

## Commands
- `npm run dev` / `npm run build` / `npm run typecheck`
- `npm run seed` — demo house/tech/members + first visits (idempotent)
- `npm run generate-slots` — manual visit/slot generation
