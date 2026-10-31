-- =====================================================================
-- Pruebas: espacios de la reunión, montaje/desmonte y bloqueo en Reservas
-- (20261029100000_espacios_reunion.sql). Correr con: npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.sistema() returns void language sql as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '', true);
$$;
-- Planeación no lee bookings (RLS de Reservas): las pruebas leen las
-- reservas con esta vista, que se va con el rollback.
create view public.prueba_reservas as select * from public.bookings;
grant select on public.prueba_reservas to authenticated;

-- 10:00 de Bogotá, dentro de N días.
create or replace function pg_temp.a_las(p_dias int, p_hora int) returns timestamptz language sql as $$
  select (((now() at time zone 'America/Bogota')::date + p_dias) + make_time(p_hora, 0, 0)) at time zone 'America/Bogota';
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a0a1', 'plan10@test', 'authenticated', 'authenticated', '{"full_name":"Planeacion"}'),
  ('00000000-0000-0000-0000-00000000a0a2', 'past10@test', 'authenticated', 'authenticated', '{"full_name":"Pastor Sede"}'),
  ('00000000-0000-0000-0000-00000000a0a3', 'lid10@test',  'authenticated', 'authenticated', '{"full_name":"Lider"}'),
  ('00000000-0000-0000-0000-00000000a0a4', 'pmin10@test', 'authenticated', 'authenticated', '{"full_name":"Pastor Min"}');
update public.profiles set role = 'planeacion'  where id = '00000000-0000-0000-0000-00000000a0a1';
update public.profiles set role = 'pastor_sede' where id = '00000000-0000-0000-0000-00000000a0a2';

insert into public.ministries (id, name, type) values ('00000000-0000-0000-0000-00000000a0d1', 'Test Ministerio 10', 'ministerio');
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-00000000a0a4', 'pastor_ministerio', '00000000-0000-0000-0000-00000000a0d1');
insert into public.spaces (id, name, slug, status, booking_policy) values
  ('00000000-0000-0000-0000-00000000a0e1', 'Test Auditorio', 'test-auditorio-10', 'active', 'needs_approval'),
  ('00000000-0000-0000-0000-00000000a0e2', 'Test Lobby',     'test-lobby-10',     'active', 'self_serve');
insert into public.meeting_types (id, name, ministry_id) values
  ('00000000-0000-0000-0000-00000000a0b1', 'Test Tipo 10', '00000000-0000-0000-0000-00000000a0d1');
insert into public.meeting_templates (id, meeting_type_id, name) values
  ('00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0b1', 'Test Plantilla 10');

-- ── Planeación arma la reunión (borrador): no bloquea ───────────────────
select pg_temp.como('00000000-0000-0000-0000-00000000a0a1');
insert into public.meetings (id, name, meeting_date, starts_at, ends_at, kind, status, created_by) values
  ('00000000-0000-0000-0000-00000000a0f1', 'Reunión Central', (pg_temp.a_las(7, 10) at time zone 'America/Bogota')::date,
   pg_temp.a_las(7, 10), pg_temp.a_las(7, 12), 'ministerio', 'borrador', '00000000-0000-0000-0000-00000000a0a1');
insert into public.meeting_spaces (meeting_id, space_id) values ('00000000-0000-0000-0000-00000000a0f1', '00000000-0000-0000-0000-00000000a0e1');

select is((select count(*)::int from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'), 0,
          'En borrador los espacios quedan escogidos pero no se reservan');
select is((select libre from public.disponibilidad_espacios(pg_temp.a_las(7, 10), pg_temp.a_las(7, 12)) where name = 'Test Auditorio'), true,
          'El Auditorio sigue libre mientras la reunión es borrador');

-- ── Publicar: reserva aprobada con montaje y desmonte ───────────────────
update public.meetings set status = 'publicada' where id = '00000000-0000-0000-0000-00000000a0f1';
select is((select status from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'), 'approved',
          'Reunión de ministerio: la reserva queda aprobada aunque el Auditorio pida aprobación');
select is((select tstzrange(pg_temp.a_las(7, 8), pg_temp.a_las(7, 13), '[)') = time_range from public.prueba_reservas
            where meeting_id = '00000000-0000-0000-0000-00000000a0f1'), true,
          'La reserva ocupa de 8:00 a 13:00: 2 horas de montaje y 1 de desmonte por defecto');
select is((select occupied_from from public.bookings_calendar where id = (select id from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1')),
          pg_temp.a_las(7, 8), 'El calendario de Reservas muestra desde cuándo está ocupado');

select pg_temp.como('00000000-0000-0000-0000-00000000a0a2');
select is((select count(*)::int from public.notifications where kind = 'reserva_reunion'), 1, 'El pastor de sede recibe un aviso de la reserva');

-- ── Un líder ya no puede reservar en la franja (desmonte incluido) ──────
select pg_temp.como('00000000-0000-0000-0000-00000000a0a3');
select throws_ok($$ insert into public.bookings (space_id, owner_org_id, use_type, starts_at, ends_at, created_by)
                    values ('00000000-0000-0000-0000-00000000a0e1', (select id from public.organizations where name = 'RSG'), 'otro',
                            pg_temp.a_las(7, 12) + interval '30 minutes', pg_temp.a_las(7, 14), '00000000-0000-0000-0000-00000000a0a3') $$,
                 '23P01', null, 'Un líder no puede reservar el Auditorio durante el desmonte');
select lives_ok($$ insert into public.bookings (space_id, owner_org_id, use_type, starts_at, ends_at, created_by)
                   values ('00000000-0000-0000-0000-00000000a0e2', (select id from public.organizations where name = 'RSG'), 'otro',
                           pg_temp.a_las(7, 7), pg_temp.a_las(7, 9), '00000000-0000-0000-0000-00000000a0a3') $$,
                'Un líder reserva el Lobby de 7:00 a 9:00');
select is((select count(*)::int from public.disponibilidad_espacios(pg_temp.a_las(7, 10), pg_temp.a_las(7, 12))), 0,
          'Un líder sin servir.planear no consulta la disponibilidad de Servir');
select throws_ok($$ insert into public.meeting_spaces (meeting_id, space_id) values
                    ('00000000-0000-0000-0000-00000000a0f1', '00000000-0000-0000-0000-00000000a0e2') $$,
                 '42501', null, 'Un líder no escoge espacios de una reunión');

-- ── Choque: el Lobby ya está ocupado en el montaje ──────────────────────
select pg_temp.como('00000000-0000-0000-0000-00000000a0a1');
select is((select libre from public.disponibilidad_espacios(pg_temp.a_las(7, 10), pg_temp.a_las(7, 12), 120, 60) where name = 'Test Lobby'), false,
          'Disponibilidad: el Lobby no está libre (choca con el montaje)');
select throws_like($$ insert into public.meeting_spaces (meeting_id, space_id) values
                      ('00000000-0000-0000-0000-00000000a0f1', '00000000-0000-0000-0000-00000000a0e2') $$,
                   '%espacio_ocupado%', 'No se puede escoger un espacio ocupado');
select is((select count(*)::int from public.meeting_spaces where meeting_id = '00000000-0000-0000-0000-00000000a0f1'), 1,
          'El espacio ocupado no queda escogido');
select lives_ok($$ update public.meetings set setup_minutes = 30 where id = '00000000-0000-0000-0000-00000000a0f1' $$,
                'Planeación baja el montaje a 30 minutos');
select lives_ok($$ insert into public.meeting_spaces (meeting_id, space_id) values
                   ('00000000-0000-0000-0000-00000000a0f1', '00000000-0000-0000-0000-00000000a0e2') $$,
                'Con 30 minutos de montaje, el Lobby sí cabe (desde 9:30)');
select is((select lower(time_range) from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'
            and space_id = '00000000-0000-0000-0000-00000000a0e1'), pg_temp.a_las(7, 9) + interval '30 minutes',
          'El cambio de montaje también mueve la reserva del Auditorio');

select is((select string_agg(status, ',') from public.reservas_de_reunion('00000000-0000-0000-0000-00000000a0f1')), 'approved,approved',
          'Planeación ve el estado de las reservas de su reunión');

-- ── Reprogramar, quitar un espacio, cancelar y restaurar ────────────────
update public.meetings set starts_at = pg_temp.a_las(8, 10), ends_at = pg_temp.a_las(8, 12),
                           meeting_date = (pg_temp.a_las(8, 10) at time zone 'America/Bogota')::date
 where id = '00000000-0000-0000-0000-00000000a0f1';
select is((select count(*)::int from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'
            and status = 'approved' and starts_at = pg_temp.a_las(8, 10)), 2, 'Al reprogramar, las dos reservas se mueven a la fecha nueva');
delete from public.meeting_spaces where meeting_id = '00000000-0000-0000-0000-00000000a0f1' and space_id = '00000000-0000-0000-0000-00000000a0e2';
select is((select status from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'
            and space_id = '00000000-0000-0000-0000-00000000a0e2'), 'cancelled', 'Quitar un espacio libera su reserva');
update public.meetings set status = 'cancelada' where id = '00000000-0000-0000-0000-00000000a0f1';
select is((select count(*)::int from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'
            and status in ('requested', 'approved')), 0, 'Cancelar la reunión libera todas sus reservas');
update public.meetings set status = 'borrador' where id = '00000000-0000-0000-0000-00000000a0f1';
update public.meetings set status = 'publicada' where id = '00000000-0000-0000-0000-00000000a0f1';
select is((select count(*)::int from public.prueba_reservas where meeting_id = '00000000-0000-0000-0000-00000000a0f1'
            and status = 'approved'), 1, 'Al volver a publicarla, se reserva otra vez su espacio (sin duplicar)');

-- ── Evento: sigue la política del espacio ───────────────────────────────
insert into public.meetings (id, name, meeting_date, starts_at, ends_at, kind, status, created_by) values
  ('00000000-0000-0000-0000-00000000a0f2', 'Evento especial', (pg_temp.a_las(9, 18) at time zone 'America/Bogota')::date,
   pg_temp.a_las(9, 18), pg_temp.a_las(9, 20), 'evento', 'borrador', '00000000-0000-0000-0000-00000000a0a1');
insert into public.meeting_spaces (meeting_id, space_id) values
  ('00000000-0000-0000-0000-00000000a0f2', '00000000-0000-0000-0000-00000000a0e1'),
  ('00000000-0000-0000-0000-00000000a0f2', '00000000-0000-0000-0000-00000000a0e2');
update public.meetings set status = 'publicada' where id = '00000000-0000-0000-0000-00000000a0f2';
select is((select string_agg(s.name || ':' || b.status, ',' order by s.name) from public.prueba_reservas b join public.spaces s on s.id = b.space_id
            where b.meeting_id = '00000000-0000-0000-0000-00000000a0f2'),
          'Test Auditorio:requested,Test Lobby:approved', 'Un evento pide aprobación del Auditorio y reserva el Lobby directo');

-- ── Sin hora no se reserva ──────────────────────────────────────────────
insert into public.meetings (id, name, meeting_date, kind, status, created_by) values
  ('00000000-0000-0000-0000-00000000a0f3', 'Sin hora', (pg_temp.a_las(10, 10) at time zone 'America/Bogota')::date, 'ministerio', 'borrador',
   '00000000-0000-0000-0000-00000000a0a1');
insert into public.meeting_spaces (meeting_id, space_id) values ('00000000-0000-0000-0000-00000000a0f3', '00000000-0000-0000-0000-00000000a0e1');
select throws_like($$ update public.meetings set status = 'publicada' where id = '00000000-0000-0000-0000-00000000a0f3' $$,
                   '%reunion_sin_hora%', 'Con espacios, no se publica una reunión sin hora de inicio y fin');

-- ── Borrar la reunión libera sus reservas ───────────────────────────────
delete from public.meetings where id = '00000000-0000-0000-0000-00000000a0f2';
select pg_temp.sistema();
select is((select count(*)::int from public.prueba_reservas where title = 'Evento especial' and status in ('requested', 'approved')), 0,
          'Borrar la reunión libera sus reservas');

-- ── Quién cambia montaje y desmonte ─────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-00000000a0a4');
select lives_ok($$ update public.meeting_templates set name = 'Test Plantilla 10b' where id = '00000000-0000-0000-0000-00000000a0c1' $$,
                'El pastor de ministerio edita su plantilla');
select throws_ok($$ update public.meeting_templates set setup_minutes = 15 where id = '00000000-0000-0000-0000-00000000a0c1' $$,
                 '42501', null, 'Pero no cambia el montaje');
select throws_ok($$ update public.meeting_types set usual_space_ids = array['00000000-0000-0000-0000-00000000a0e1'::uuid]
                    where id = '00000000-0000-0000-0000-00000000a0b1' $$,
                 '42501', null, 'Ni los espacios habituales del tipo');

select pg_temp.como('00000000-0000-0000-0000-00000000a0a2');
select lives_ok($$ update public.meeting_templates set setup_minutes = 180, teardown_minutes = 90,
                     space_ids = array['00000000-0000-0000-0000-00000000a0e1'::uuid]
                   where id = '00000000-0000-0000-0000-00000000a0c1' $$,
                'Un pastor de sede ajusta montaje, desmonte y espacios de la plantilla');

select pg_temp.como('00000000-0000-0000-0000-00000000a0a4');
select lives_ok($$ insert into public.meeting_templates (meeting_type_id, name, version, space_ids, setup_minutes, teardown_minutes)
                   values ('00000000-0000-0000-0000-00000000a0b1', 'Test Plantilla 10b', 2,
                           array['00000000-0000-0000-0000-00000000a0e1'::uuid], 180, 90) $$,
                'El pastor de ministerio crea una versión nueva que copia los espacios y el montaje');
select throws_ok($$ insert into public.meeting_templates (meeting_type_id, name, version, setup_minutes)
                    values ('00000000-0000-0000-0000-00000000a0b1', 'Test Plantilla 10b', 3, 5) $$,
                 '42501', null, 'Pero no una versión con otro montaje');

select * from finish();
rollback;
