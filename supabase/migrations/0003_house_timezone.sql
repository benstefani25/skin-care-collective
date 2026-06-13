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
