-- =====================================================================
-- Pruebas B4: los recordatorios siguen a la reunión al reprogramarla,
-- cancelarla o restaurarla (trigger meetings_reminders_sync).
-- Correr con:  npx supabase test db
-- (now() es fijo dentro de la transacción, así las horas son exactas.)
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

truncate public.meetings, public.people, public.discipleship_groups, public.broadcasts cascade;

insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000000d1', 'Test Creativos', 'departamento');
insert into public.positions (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'Luces');
insert into public.people (id, full_name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pendiente P'),
  ('00000000-0000-0000-0000-0000000000c2', 'Aceptado A');
insert into public.meetings (id, name, meeting_date, starts_at, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'Reunión Central', current_date + 7, now() + interval '7 days', 'publicada');
insert into public.assignments (id, meeting_id, person_id, position_id, ministry_id, status) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'pendiente'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'aceptada');

create or replace function pg_temp.r(p_kind text) returns public.reminders language sql as $$
  select * from public.reminders where kind = p_kind;
$$;
create or replace function pg_temp.mover(p_offset interval) returns void language sql as $$
  update public.meetings set starts_at = now() + p_offset, meeting_date = (now() + p_offset)::date
   where id = '00000000-0000-0000-0000-0000000000f1';
$$;

-- ── Reprogramar ─────────────────────────────────────────────────────────
select pg_temp.mover('10 days');
select is((pg_temp.r('manana')).send_at, now() + interval '9 days', '"Mañana" se mueve a 24 h antes del nuevo inicio');
select is((pg_temp.r('dos_horas')).send_at, now() + interval '10 days' - interval '2 hours', '"Dos horas" se mueve a 2 h antes del nuevo inicio');
select is((pg_temp.r('sin_respuesta')).send_at, now() + interval '48 hours', '"Sin respuesta" sigue la fórmula least(ahora + 48 h, inicio − 24 h)');

-- Un recordatorio ya enviado se vuelve a armar si su nueva hora es futura.
update public.reminders set sent_at = now() where kind = 'manana';
select pg_temp.mover('3 days');
select ok((pg_temp.r('manana')).sent_at is null, 'Un "mañana" ya enviado se re-arma si la reunión se mueve lejos');

-- Si la nueva hora ya pasó, se descarta (no se manda de golpe).
select pg_temp.mover('3 hours');
select ok((pg_temp.r('manana')).sent_at is not null, '"Mañana" con hora vencida queda descartado');
select ok((pg_temp.r('sin_respuesta')).sent_at is not null, '"Sin respuesta" con hora vencida queda descartado');
select is((pg_temp.r('dos_horas')).send_at, now() + interval '1 hour', '"Dos horas" sigue pendiente a su nueva hora');
select ok((pg_temp.r('dos_horas')).sent_at is null, '"Dos horas" no está descartado');
select is((public.notificador_procesar() ->> 'recordatorios')::int, 0, 'El despachador no manda avisos viejos de golpe');

-- Un cambio que no mueve el inicio no toca nada.
update public.meetings set status = 'borrador' where id = '00000000-0000-0000-0000-0000000000f1';
select is((pg_temp.r('dos_horas')).send_at, now() + interval '1 hour', 'Cambiar solo el estado (sin cancelar) no recalcula');

-- ── Cancelar y restaurar ────────────────────────────────────────────────
select pg_temp.mover('7 days');
update public.meetings set status = 'cancelada' where id = '00000000-0000-0000-0000-0000000000f1';
select is((select count(*) from public.reminders where sent_at is null)::int, 0, 'Al cancelar se borran los recordatorios pendientes');
select pg_temp.mover('8 days');
select is((select count(*) from public.reminders where sent_at is null)::int, 0, 'Mover una reunión cancelada no crea recordatorios');

update public.meetings set status = 'publicada' where id = '00000000-0000-0000-0000-0000000000f1';
select is((select count(*) from public.reminders where sent_at is null)::int, 3,
          'Al restaurar vuelven los recordatorios (1 sin respuesta + mañana + dos horas)');
select is((pg_temp.r('manana')).send_at, now() + interval '7 days', 'Restaurados con el inicio vigente');

select * from finish();
rollback;
