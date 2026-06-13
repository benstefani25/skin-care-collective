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
