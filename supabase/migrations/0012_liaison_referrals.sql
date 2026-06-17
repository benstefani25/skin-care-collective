-- T2-8 — Liaison/rep program: flag + referral attribution ONLY. Deliberately
-- no cash/bounty logic — per-signup cash to a peer promoter has optics issues
-- (prefer a flat stipend or reduced/free membership); that's a FOUNDER DECISION.
-- This builds the plumbing so either reward model can sit on top later.
alter table public.members add column if not exists is_liaison boolean not null default false;
alter table public.members add column if not exists referral_code text unique;
alter table public.members add column if not exists referred_by_member_id uuid references public.members(id);
create index if not exists members_referred_by_idx on public.members (referred_by_member_id);
