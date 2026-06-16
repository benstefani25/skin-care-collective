-- events is append-only (rows are never updated or deleted), but its FK columns
-- referencing members/appointments/houses/techs blocked deletion of those
-- entities while any event pointed at them. In PRODUCTION this never matters —
-- members and events are soft-deleted (status columns), never hard-deleted, so
-- these constraints never fire. They only blocked integration-test teardown,
-- leaving orphan test rows visible in the founder console.
--
-- Switch the event FKs to ON DELETE SET NULL: the append-only event ROW and its
-- payload are preserved; only the entity reference is nulled if (and only if)
-- the referenced row is ever hard-deleted (tests). Audit integrity in prod is
-- unchanged because prod never hard-deletes.
alter table public.events
  drop constraint if exists events_house_id_fkey,
  add constraint events_house_id_fkey foreign key (house_id) references public.houses(id) on delete set null;
alter table public.events
  drop constraint if exists events_member_id_fkey,
  add constraint events_member_id_fkey foreign key (member_id) references public.members(id) on delete set null;
alter table public.events
  drop constraint if exists events_tech_id_fkey,
  add constraint events_tech_id_fkey foreign key (tech_id) references public.techs(id) on delete set null;
alter table public.events
  drop constraint if exists events_appointment_id_fkey,
  add constraint events_appointment_id_fkey foreign key (appointment_id) references public.appointments(id) on delete set null;
