-- Full data model (spec §3). All milestones' tables are created now; M1 uses a subset.
-- Soft-delete via status columns; members and events are never hard-deleted.

create extension if not exists pgcrypto;

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  campus text not null,
  address text not null default '',
  access_notes text not null default '',
  -- founder-only columns: excluded from every non-founder view
  house_director_name text,
  house_director_contact text,
  visit_weekday int not null check (visit_weekday between 0 and 6),
  visit_cadence text not null default 'biweekly' check (visit_cadence in ('weekly', 'biweekly')),
  visit_window_start time not null,
  visit_window_end time not null,
  slot_duration_minutes int not null default 20,
  monthly_price_cents int not null default 6500,
  -- wage-floor config (spec §10): floors differ by jurisdiction
  minimum_wage_cents int,
  status text not null default 'prospect' check (status in ('prospect', 'active', 'paused', 'churned'))
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  house_id uuid not null references public.houses(id),
  -- links the Supabase auth user; set on first login (matched by email)
  auth_user_id uuid unique,
  first_name text not null,
  last_name text not null,
  phone text not null unique, -- E.164
  email text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  shade_preference text,
  service_notes text, -- allergies, preferences; visible to techs via tech_runsheet
  standing_appointment boolean not null default true, -- opt-out, not opt-in
  standing_window text check (standing_window in ('early', 'mid', 'late')),
  -- 'pending' = signup started, Stripe checkout not yet completed
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'past_due', 'cancelled')),
  graduation_year int
);
create index members_house_idx on public.members (house_id);
create index members_stripe_customer_idx on public.members (stripe_customer_id);

create table public.techs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  auth_user_id uuid unique,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  base_rate_cents int not null default 1000,
  deferred_rate_cents int not null default 250,
  semester_number int not null default 1, -- tenure; drives the deferred escalator later
  status text not null default 'applicant' check (status in ('applicant', 'active', 'offboarded')),
  hired_at timestamptz,
  offboarded_at timestamptz
);

create table public.tech_house_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tech_id uuid not null references public.techs(id),
  house_id uuid not null references public.houses(id),
  active boolean not null default true
);

-- One tech-day at one house.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  house_id uuid not null references public.houses(id),
  tech_id uuid references public.techs(id),
  date date not null,
  window_start time not null,
  window_end time not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'under_threshold')),
  -- visit-level check-in/out (spec §6): payroll hours and reliability telemetry
  checked_in_at timestamptz,
  checked_out_at timestamptz
);
create index visits_house_date_idx on public.visits (house_id, date);
create index visits_tech_date_idx on public.visits (tech_id, date);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visit_id uuid not null references public.visits(id),
  start_time time not null,
  duration_minutes int not null default 20,
  status text not null default 'open' check (status in ('open', 'held_standing', 'booked', 'blocked'))
);
create index slots_visit_idx on public.slots (visit_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slot_id uuid not null references public.slots(id),
  member_id uuid not null references public.members(id),
  status text not null default 'booked' check (status in ('booked', 'completed', 'no_show', 'cancelled', 'cancelled_late')),
  source text not null check (source in ('standing', 'self_serve', 'concierge')),
  room text, -- captured at booking (spec §6)
  checked_in_at timestamptz,
  checked_out_at timestamptz
);
-- a slot can hold many cancelled appointments but only one live one
create unique index appointments_active_slot_idx on public.appointments (slot_id)
  where status in ('booked', 'completed', 'no_show');
create index appointments_member_idx on public.appointments (member_id);

-- The relay log.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  member_id uuid references public.members(id),
  tech_id uuid references public.techs(id),
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  channel text not null default 'sms' check (channel in ('sms')),
  handled_by text check (handled_by in ('concierge_ai', 'relay', 'founder')),
  escalated boolean not null default false
);

-- Append-only: the founder's eyes. No updates or deletes, ever.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  actor_type text not null check (actor_type in ('member', 'tech', 'founder', 'system', 'ai')),
  actor_id uuid,
  house_id uuid references public.houses(id),
  member_id uuid references public.members(id),
  tech_id uuid references public.techs(id),
  appointment_id uuid references public.appointments(id),
  payload jsonb not null default '{}'::jsonb
);
create index events_type_idx on public.events (type);
create index events_created_idx on public.events (created_at);
create index events_appointment_idx on public.events (appointment_id);

create or replace function public.forbid_event_change() returns trigger
language plpgsql as $$
begin
  raise exception 'events is append-only';
end $$;

create trigger events_append_only
  before update or delete on public.events
  for each statement execute function public.forbid_event_change();

revoke update, delete on public.events from anon, authenticated, service_role;

-- Deterministic money records — written only by payroll code, never by AI.
create table public.bonus_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tech_id uuid not null references public.techs(id),
  appointment_id uuid references public.appointments(id),
  type text not null check (type in ('deferred_accrual', 'payout', 'forfeiture', 'adjustment')),
  amount_cents int not null,
  semester text not null, -- e.g. 'F26'
  note text
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  appointment_id uuid not null references public.appointments(id),
  rating int not null check (rating between 1 and 5),
  comment text
);

-- Markdown SOPs uploaded by the founder; the tech copilot's grounding corpus.
create table public.sop_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  body text not null,
  category text,
  version int not null default 1,
  active boolean not null default true
);
-- Deny-by-default RLS on every table. The anon/authenticated roles can read
-- nothing except via the explicit member policies and the tech_runsheet view
-- below. All mutations go through server-side code using the service role,
-- which is where business rules (cancellation window, past_due block) live.

alter table public.houses enable row level security;
alter table public.members enable row level security;
alter table public.techs enable row level security;
alter table public.tech_house_assignments enable row level security;
alter table public.visits enable row level security;
alter table public.slots enable row level security;
alter table public.appointments enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.bonus_ledger enable row level security;
alter table public.surveys enable row level security;
alter table public.sop_documents enable row level security;

-- ── Member read policies ────────────────────────────────────────────────────
-- A logged-in member sees her own row.
create policy member_select_self on public.members
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- Visits for her own house.
create policy member_select_house_visits on public.visits
  for select to authenticated
  using (house_id in (
    select house_id from public.members where auth_user_id = (select auth.uid())
  ));

-- Slots for her own house's visits.
create policy member_select_house_slots on public.slots
  for select to authenticated
  using (visit_id in (
    select v.id
    from public.visits v
    join public.members m on m.house_id = v.house_id
    where m.auth_user_id = (select auth.uid())
  ));

-- Her own appointments only.
create policy member_select_own_appointments on public.appointments
  for select to authenticated
  using (member_id in (
    select id from public.members where auth_user_id = (select auth.uid())
  ));

-- NOTE: no member policy on houses — house_director_* are founder-only
-- columns, so houses are only ever read server-side and rendered selectively.

-- ── The tech wall ───────────────────────────────────────────────────────────
-- Techs never query base tables. The run sheet is a security-definer view that
-- exposes today's assigned visit only, with first name + last initial and no
-- contact columns. This is the database-layer enforcement of invariant #1.

create or replace function public.current_tech_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from techs where auth_user_id = auth.uid() and status = 'active'
$$;

create view public.tech_runsheet as
select
  a.id as appointment_id,
  v.id as visit_id,
  v.date,
  h.name as house_name,
  h.address,
  h.access_notes,
  s.start_time,
  s.duration_minutes,
  a.room,
  (m.first_name || ' ' || left(m.last_name, 1) || '.') as member_display_name,
  m.shade_preference,
  m.service_notes,
  a.status,
  a.checked_in_at,
  a.checked_out_at
from public.appointments a
join public.slots s on s.id = a.slot_id
join public.visits v on v.id = s.visit_id
join public.houses h on h.id = v.house_id
join public.members m on m.id = a.member_id
where v.tech_id = public.current_tech_id()
  and v.date = current_date
  and a.status in ('booked', 'completed', 'no_show');

revoke all on public.tech_runsheet from anon;
grant select on public.tech_runsheet to authenticated;
-- Fix: tech_runsheet compared visit dates against current_date in the
-- database's clock (UTC), so evening appointments disappeared from the run
-- sheet once UTC rolled past midnight. "Today" must be the house's local day.
-- Houses get an explicit timezone (markets can differ); the view computes
-- today per house.

alter table public.houses
  add column if not exists timezone text not null default 'America/Chicago';

create or replace view public.tech_runsheet as
select
  a.id as appointment_id,
  v.id as visit_id,
  v.date,
  h.name as house_name,
  h.address,
  h.access_notes,
  s.start_time,
  s.duration_minutes,
  a.room,
  (m.first_name || ' ' || left(m.last_name, 1) || '.') as member_display_name,
  m.shade_preference,
  m.service_notes,
  a.status,
  a.checked_in_at,
  a.checked_out_at
from public.appointments a
join public.slots s on s.id = a.slot_id
join public.visits v on v.id = s.visit_id
join public.houses h on h.id = v.house_id
join public.members m on m.id = a.member_id
where v.tech_id = public.current_tech_id()
  and v.date = (now() at time zone h.timezone)::date
  and a.status in ('booked', 'completed', 'no_show');
-- Founder CRM: a lightweight place to record the COI / insurance doc on file
-- per house (spec §7). A full Supabase Storage upload can replace this later;
-- the column holds a link or note for now.
alter table public.houses
  add column if not exists insurance_note text;

-- QC analyst output (spec §11c). Stored to the console and emailed; never
-- auto-sent to anyone external. One row per generated weekly digest.
create table public.digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_start date not null,
  period_end date not null,
  -- structured result: { healthy: [...], watch: [...], act: [...], drafts: [...] }
  data jsonb not null default '{}'::jsonb,
  -- rendered markdown for display/email
  body text not null default '',
  generated_by text not null default 'qc_ai'
);
create index digests_created_idx on public.digests (created_at desc);

alter table public.digests enable row level security;
-- No member/tech policies: digests are founder-only, read server-side via the
-- service role behind requireFounder(). Deny-by-default RLS keeps everyone else out.
-- T0-2 [A1] — Enforce the tech wall in TWO independent layers.
--
-- Before this migration the run sheet was a SECURITY DEFINER view (runs as the
-- owner, bypassing base-table RLS). Its only protection was the hardcoded
-- `WHERE v.tech_id = current_tech_id()` clause — a single point of failure: a
-- careless edit removing that line would expose every member's data to any tech.
--
-- This migration makes the wall enforced by BOTH:
--   LAYER 1 — the view's `WHERE current_tech_id()` + house-local-date filter
--             (kept; still the primary scoping).
--   LAYER 2 — base-table RLS, now ACTUALLY applied to the view because the view
--             is recreated with `security_invoker = true`. Tech sessions get
--             tightly-scoped SELECT policies that permit ONLY rows tied to the
--             tech's own visit for the house-local "today".
--
-- Neither layer may be removed. The column projection (first name + last
-- initial, no contact columns) is preserved by:
--   (a) a generated `display_name` column, so the view never reads `last_name`,
--       and (b) column-level privileges that withhold last_name/phone/email
--       from the `authenticated` role entirely. So even a direct base-table
--       query by a tech (who now has row access to today's members) cannot read
--       contact columns — the wall holds on BOTH the view path and the direct path.
--
-- Member/founder app code reads member & house rows through the SERVICE ROLE
-- (requireMember / supabaseAdmin), which bypasses these column grants, so this
-- change does not affect member self-service or the founder console.

-- ── Safe display name, computed once, never exposes the full last name ──────
alter table public.members
  add column if not exists display_name text
  generated always as (first_name || ' ' || left(last_name, 1) || '.') stored;

-- ── Helper functions: the set of ids a tech may see TODAY (house-local) ──────
-- security definer so they can compute the scope without the tech needing base
-- access; this also avoids RLS recursion inside policy USING clauses.
create or replace function public.tech_today_visit_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select v.id
  from visits v
  join houses h on h.id = v.house_id
  where v.tech_id = public.current_tech_id()
    and v.date = (now() at time zone h.timezone)::date
$$;

create or replace function public.tech_today_slot_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from slots where visit_id in (select public.tech_today_visit_ids())
$$;

create or replace function public.tech_today_member_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select a.member_id
  from appointments a
  join slots s on s.id = a.slot_id
  where s.visit_id in (select public.tech_today_visit_ids())
    and a.status in ('booked', 'completed', 'no_show')
$$;

create or replace function public.tech_today_house_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select house_id from visits where id in (select public.tech_today_visit_ids())
$$;

-- ── Layer 2: tech-scoped SELECT policies (today's own visit only) ───────────
-- current_tech_id() is null for non-techs, so every tech_today_* set is empty
-- for members/founders — these policies grant them nothing. Member-facing
-- policies from 0002 are untouched and continue to apply (OR-combined).
drop policy if exists tech_select_today_visits on public.visits;
create policy tech_select_today_visits on public.visits
  for select to authenticated
  using (id in (select public.tech_today_visit_ids()));

drop policy if exists tech_select_today_slots on public.slots;
create policy tech_select_today_slots on public.slots
  for select to authenticated
  using (visit_id in (select public.tech_today_slot_ids()) or visit_id in (select public.tech_today_visit_ids()));

drop policy if exists tech_select_today_appointments on public.appointments;
create policy tech_select_today_appointments on public.appointments
  for select to authenticated
  using (slot_id in (select public.tech_today_slot_ids()));

drop policy if exists tech_select_today_houses on public.houses;
create policy tech_select_today_houses on public.houses
  for select to authenticated
  using (id in (select public.tech_today_house_ids()));

drop policy if exists tech_select_today_members on public.members;
create policy tech_select_today_members on public.members
  for select to authenticated
  using (id in (select public.tech_today_member_ids()));

-- ── Column-level lockdown: contact/founder columns never reach a tech ───────
-- Even with row access to today's members, the authenticated role cannot read
-- last_name, phone, email, or Stripe ids. The generated display_name carries
-- the safe "First L." form. Member self-reads use the service role, so they
-- are unaffected by withholding these columns from `authenticated`.
revoke select on public.members from authenticated;
grant select (
  id, created_at, house_id, auth_user_id, first_name, display_name,
  shade_preference, service_notes, standing_appointment, standing_window,
  status, graduation_year
) on public.members to authenticated;

-- house_director_name / house_director_contact are founder-only — withhold them.
revoke select on public.houses from authenticated;
grant select (
  id, created_at, name, campus, address, access_notes, visit_weekday,
  visit_cadence, visit_window_start, visit_window_end, slot_duration_minutes,
  monthly_price_cents, minimum_wage_cents, status, timezone, insurance_note
) on public.houses to authenticated;

-- ── Recreate the run sheet as a security_invoker view ───────────────────────
-- Same column list as 0003 EXCEPT it now reads m.display_name instead of
-- computing left(last_name,1) — so the view never touches the withheld column.
-- DO NOT add columns here, DO NOT remove the WHERE clause, DO NOT drop
-- security_invoker: each is load-bearing for the wall.
drop view if exists public.tech_runsheet;
create view public.tech_runsheet
with (security_invoker = true) as
select
  a.id as appointment_id,
  v.id as visit_id,
  v.date,
  h.name as house_name,
  h.address,
  h.access_notes,
  s.start_time,
  s.duration_minutes,
  a.room,
  m.display_name as member_display_name,
  m.shade_preference,
  m.service_notes,
  a.status,
  a.checked_in_at,
  a.checked_out_at
from public.appointments a
join public.slots s on s.id = a.slot_id
join public.visits v on v.id = s.visit_id
join public.houses h on h.id = v.house_id
join public.members m on m.id = a.member_id
where v.tech_id = public.current_tech_id()
  and v.date = (now() at time zone h.timezone)::date
  and a.status in ('booked', 'completed', 'no_show');

revoke all on public.tech_runsheet from anon;
grant select on public.tech_runsheet to authenticated;
-- events is append-only (rows are never updated or deleted), but its FK columns
-- referencing members/appointments/houses/techs blocked deletion of those
-- entities while any event pointed at them. In PRODUCTION this never matters —
-- members and events are soft-deleted (status columns), never hard-deleted, so
-- these constraints never fire. They only blocked integration-test teardown,
-- leaving orphan test rows visible in the founder console.
--
-- Switch the event FKs to ON DELETE SET NULL: the append-only event ROW and its
-- payload are preserved; only the entity reference is nulled if (and only if)
-- the referenced row is ever hard-deleted (tests). Audit integrity in prod is
-- unchanged because prod never hard-deletes.
alter table public.events
  drop constraint if exists events_house_id_fkey,
  add constraint events_house_id_fkey foreign key (house_id) references public.houses(id) on delete set null;
alter table public.events
  drop constraint if exists events_member_id_fkey,
  add constraint events_member_id_fkey foreign key (member_id) references public.members(id) on delete set null;
alter table public.events
  drop constraint if exists events_tech_id_fkey,
  add constraint events_tech_id_fkey foreign key (tech_id) references public.techs(id) on delete set null;
alter table public.events
  drop constraint if exists events_appointment_id_fkey,
  add constraint events_appointment_id_fkey foreign key (appointment_id) references public.appointments(id) on delete set null;
-- Correction to 0006: ON DELETE SET NULL requires UPDATEing events when a
-- referenced row is deleted, but the append-only trigger (forbid_event_change)
-- forbids every UPDATE/DELETE on events — so the cascade is blocked and the
-- referenced entity can't be deleted either.
--
-- The right design for an append-only audit log is to NOT couple it to entity
-- lifecycle with FKs at all. Drop the FK constraints: the event row keeps the
-- raw id value (better for audit than nulling it), and entities can be hard-
-- deleted (tests; never in prod) without touching the immutable log. The
-- columns remain plain uuids; application code still fills them the same way.
alter table public.events drop constraint if exists events_house_id_fkey;
alter table public.events drop constraint if exists events_member_id_fkey;
alter table public.events drop constraint if exists events_tech_id_fkey;
alter table public.events drop constraint if exists events_appointment_id_fkey;
-- Idempotency ledger for inbound webhooks (T1-3, T1-4). Twilio and Stripe both
-- retry deliveries; without a dedup guard a retry re-runs side effects (double
-- bookings, duplicate messages, repeat activation). One row per (provider,
-- external_id); the unique constraint makes the first writer win.
create table public.processed_webhooks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,          -- 'twilio' | 'stripe'
  external_id text not null,       -- Twilio MessageSid / Stripe event.id
  unique (provider, external_id)
);
create index processed_webhooks_lookup on public.processed_webhooks (provider, external_id);

alter table public.processed_webhooks enable row level security;
-- No policies: written/read only by server-side service-role code.
-- T2-2 [A3] — Real staff/role model. Replaces the bare FOUNDER_EMAIL string
-- check with a role-backed staff table, so additional founders/admins can be
-- added later without code changes. Techs keep their own rich table (rates,
-- semester, assignments); "tech" identity is membership in techs. The env
-- FOUNDER_EMAIL remains a BOOTSTRAP fallback for the very first login, which
-- auto-creates the staff row (see requireFounder).
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  auth_user_id uuid unique,
  email text not null unique,
  role text not null default 'founder' check (role in ('founder')),
  first_name text,
  last_name text,
  active boolean not null default true
);

alter table public.staff enable row level security;
-- No policies: read/written only by server-side service-role code behind
-- requireFounder(). Deny-by-default keeps members and techs out.
-- T2-4 — Tokenized per-house signup. Each house gets an opaque token; members
-- reach signup via /join/<token> (QR/link distributed at the house) instead of
-- a public dropdown that enumerates every house. The campus→house view stays
-- founder-only.
create extension if not exists pgcrypto;

alter table public.houses add column if not exists signup_token text unique;
update public.houses set signup_token = encode(gen_random_bytes(12), 'hex') where signup_token is null;
alter table public.houses alter column signup_token set default encode(gen_random_bytes(12), 'hex');
alter table public.houses alter column signup_token set not null;
-- T2-5 — House contacts CRM. Arbitrary roles per house (house mom, chapter
-- president, social chair, …) beyond the single legacy house_director_*
-- columns on houses (which are KEPT for the primary director; this table adds
-- the rest). Founder-only: deny-by-default RLS, read/written only by the
-- service role behind requireFounder(). Never exposed to techs or members.
create table public.house_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  house_id uuid not null references public.houses(id),
  role text not null,
  name text not null,
  contact text,
  notes text
);
create index house_contacts_house_idx on public.house_contacts (house_id);

alter table public.house_contacts enable row level security;
-- No policies: founder/service-role only.
