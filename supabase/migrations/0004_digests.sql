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
