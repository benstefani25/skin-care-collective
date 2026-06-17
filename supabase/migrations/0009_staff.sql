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
