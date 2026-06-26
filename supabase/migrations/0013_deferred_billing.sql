-- Deferred billing (C-1b): founding members save a card at signup but are not
-- charged until the founder triggers per-house launch (target: August).
-- New statuses: card_on_file (card saved, not yet billed) and payment_failed
-- (charge attempt at launch time failed — needs member action before activating).
alter table public.members
  drop constraint members_status_check;

alter table public.members
  add constraint members_status_check
  check (status in ('pending', 'card_on_file', 'active', 'paused', 'past_due', 'cancelled', 'payment_failed'));

-- Stores the Stripe payment method id captured via SetupIntent, so the launch
-- action can attach it to the new subscription without another checkout.
alter table public.members
  add column if not exists stripe_payment_method_id text;
