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
