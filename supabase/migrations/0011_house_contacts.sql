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
