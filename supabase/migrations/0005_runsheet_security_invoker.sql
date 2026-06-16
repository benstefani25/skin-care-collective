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
