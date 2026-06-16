-- Correction to 0006: ON DELETE SET NULL requires UPDATEing events when a
-- referenced row is deleted, but the append-only trigger (forbid_event_change)
-- forbids every UPDATE/DELETE on events — so the cascade is blocked and the
-- referenced entity can't be deleted either.
--
-- The right design for an append-only audit log is to NOT couple it to entity
-- lifecycle with FKs at all. Drop the FK constraints: the event row keeps the
-- raw id value (better for audit than nulling it), and entities can be hard-
-- deleted (tests; never in prod) without touching the immutable log. The
-- columns remain plain uuids; application code still fills them the same way.
alter table public.events drop constraint if exists events_house_id_fkey;
alter table public.events drop constraint if exists events_member_id_fkey;
alter table public.events drop constraint if exists events_tech_id_fkey;
alter table public.events drop constraint if exists events_appointment_id_fkey;
