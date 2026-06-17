-- T2-4 — Tokenized per-house signup. Each house gets an opaque token; members
-- reach signup via /join/<token> (QR/link distributed at the house) instead of
-- a public dropdown that enumerates every house. The campus→house view stays
-- founder-only.
create extension if not exists pgcrypto;

alter table public.houses add column if not exists signup_token text unique;
update public.houses set signup_token = encode(gen_random_bytes(12), 'hex') where signup_token is null;
alter table public.houses alter column signup_token set default encode(gen_random_bytes(12), 'hex');
alter table public.houses alter column signup_token set not null;
