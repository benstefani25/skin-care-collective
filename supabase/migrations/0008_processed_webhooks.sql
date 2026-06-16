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
