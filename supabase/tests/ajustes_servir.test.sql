-- =====================================================================
-- Pruebas de los ajustes del 29 oct:
--   20261029120000_servir_directorio_y_agenda.sql
--   20261029130000_servir_roles_generales.sql
--   20261029140000_servir_ajustes_en_vivo.sql
-- Correr con:  npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

truncate public.meetings, public.people, public.discipleship_groups cascade;

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

-- Usuarios: Planeación, líder de Música, líder de Protocolo, líder de
-- discipulado, servidor A (Música), servidor B (Protocolo), servidor C (sin asignar)
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000ba1', 'plan@t9',  'authenticated', 'authenticated', '{"full_name":"Planeacion"}'),
  ('00000000-0000-0000-0000-000000000ba2', 'lmus@t9',  'authenticated', 'authenticated', '{"full_name":"Lider Musica"}'),
  ('00000000-0000-0000-0000-000000000ba3', 'lprot@t9', 'authenticated', 'authenticated', '{"full_name":"Lider Protocolo"}'),
  ('00000000-0000-0000-0000-000000000ba4', 'ldisc@t9', 'authenticated', 'authenticated', '{"full_name":"Lider Discipulado"}'),
  ('00000000-0000-0000-0000-000000000ba5', 'sa@t9',    'authenticated', 'authenticated', '{"full_name":"Servidor A"}'),
  ('00000000-0000-0000-0000-000000000ba6', 'sb@t9',    'authenticated', 'authenticated', '{"full_name":"Servidor B"}'),
  ('00000000-0000-0000-0000-000000000ba7', 'sc@t9',    'authenticated', 'authenticated', '{"full_name":"Servidor C"}');
update public.profiles set role = 'planeacion' where id = '00000000-0000-0000-0000-000000000ba1';
update public.profiles set role = 'servidor'
 where id in ('00000000-0000-0000-0000-000000000ba5', '00000000-0000-0000-0000-000000000ba6', '00000000-0000-0000-0000-000000000ba7');

insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-000000000bd1', 'Test Musica 9', 'departamento'),
  ('00000000-0000-0000-0000-000000000bd2', 'Test Protocolo 9', 'departamento');
update public.servir_ajustes set ministerio_musica_id = '00000000-0000-0000-0000-000000000bd1';
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-000000000ba2', 'lider_departamento', '00000000-0000-0000-0000-000000000bd1'),
  ('00000000-0000-0000-0000-000000000ba3', 'lider_departamento', '00000000-0000-0000-0000-000000000bd2');
insert into public.positions (id, ministry_id, name) values
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000bd1', 'Guitarra'),
  ('00000000-0000-0000-0000-000000000bb2', '00000000-0000-0000-0000-000000000bd2', 'Ujier');
insert into public.discipleship_groups (id, name, leader_user_ids) values
  ('t9-grupo', 'Grupo 9', array['00000000-0000-0000-0000-000000000ba4'::uuid]);
insert into public.people (id, full_name, profile_id, phone, email, notes, discipleship_group_id) values
  ('00000000-0000-0000-0000-000000000bc1', 'Servidor A', '00000000-0000-0000-0000-000000000ba5', '300 1', 'a@t9', 'nota A', 't9-grupo'),
  ('00000000-0000-0000-0000-000000000bc2', 'Servidor B', '00000000-0000-0000-0000-000000000ba6', '300 2', 'b@t9', 'nota B', null),
  ('00000000-0000-0000-0000-000000000bc3', 'Servidor C', '00000000-0000-0000-0000-000000000ba7', '300 3', 'c@t9', null, null);
insert into public.team_members (person_id, ministry_id) values
  ('00000000-0000-0000-0000-000000000bc1', '00000000-0000-0000-0000-000000000bd1'),
  ('00000000-0000-0000-0000-000000000bc2', '00000000-0000-0000-0000-000000000bd2'),
  ('00000000-0000-0000-0000-000000000bc3', '00000000-0000-0000-0000-000000000bd2');

-- Reunión de mañana a las 10:00 (publicada) y otra sin asignados
insert into public.meetings (id, name, meeting_date, starts_at, status, notes) values
  ('00000000-0000-0000-0000-000000000bf1', 'Reunión Central', (now() at time zone 'America/Bogota')::date + 1,
   (((now() at time zone 'America/Bogota')::date + 1)::timestamp + time '10:00') at time zone 'America/Bogota', 'publicada', 'nota interna'),
  ('00000000-0000-0000-0000-000000000bf2', 'Semilleros', (now() at time zone 'America/Bogota')::date + 2, null, 'publicada', 'otra nota');
insert into public.run_items (id, meeting_id, sort, kind, title, duration_sec) values
  ('00000000-0000-0000-0000-000000000b91', '00000000-0000-0000-0000-000000000bf1', 1, 'cancion', 'Canción 1', 300),
  ('00000000-0000-0000-0000-000000000b92', '00000000-0000-0000-0000-000000000bf1', 2, 'predica', 'Prédica', 1800);
insert into public.assignments (id, meeting_id, person_id, position_id, ministry_id, status) values
  ('00000000-0000-0000-0000-000000000b81', '00000000-0000-0000-0000-000000000bf1', '00000000-0000-0000-0000-000000000bc1',
   '00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000bd1', 'aceptada'),
  ('00000000-0000-0000-0000-000000000b82', '00000000-0000-0000-0000-000000000bf1', '00000000-0000-0000-0000-000000000bc2',
   '00000000-0000-0000-0000-000000000bb2', '00000000-0000-0000-0000-000000000bd2', 'aceptada');
insert into public.bookings (space_id, owner_org_id, use_type, starts_at, ends_at, status, created_by)
values ((select id from public.spaces where slug = 'lobby'), (select id from public.organizations where name = 'RSG'), 'otro',
        now() + interval '5 days', now() + interval '5 days 1 hour', 'approved', '00000000-0000-0000-0000-000000000ba3');

-- ── 1. Directorio ───────────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-000000000ba2');
select is((select full_name from public.people where id = '00000000-0000-0000-0000-000000000bc2'), 'Servidor B',
          'Un líder ve el nombre de alguien de otro departamento');
select throws_ok($$ select phone from public.people $$, '42501', null,
                 'Pero no puede leer teléfonos directo de la tabla');
select is((select count(*)::int from public.contacto_personas(array['00000000-0000-0000-0000-000000000bc1'::uuid, '00000000-0000-0000-0000-000000000bc2'::uuid])), 1,
          'contacto_personas solo le da el contacto de su propio equipo');
select is((select phone from public.contacto_personas(array['00000000-0000-0000-0000-000000000bc1'::uuid])), '300 1',
          'Con su teléfono');
select is((select departamentos from public.directorio_personas() where id = '00000000-0000-0000-0000-000000000bc2'), array['Test Protocolo 9'],
          'El directorio muestra el departamento de cada persona');

select pg_temp.como('00000000-0000-0000-0000-000000000ba4');
select is((select email from public.contacto_personas(array['00000000-0000-0000-0000-000000000bc1'::uuid])), 'a@t9',
          'El líder de discipulado ve el contacto de su discípulo');

select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select is((select count(*)::int from public.contacto_personas(array['00000000-0000-0000-0000-000000000bc1'::uuid, '00000000-0000-0000-0000-000000000bc2'::uuid, '00000000-0000-0000-0000-000000000bc3'::uuid])), 3,
          'Planeación ve el contacto de todos');

select pg_temp.como('00000000-0000-0000-0000-000000000ba6');
select is((select notes from public.contacto_personas(array['00000000-0000-0000-0000-000000000bc2'::uuid])), 'nota B',
          'Cada quien ve su propio contacto');
select is((select count(*)::int from public.directorio_personas()), 0, 'Un servidor no tiene directorio');

-- ── 2. El servidor no ve Reservas ───────────────────────────────────────
select is((select count(*)::int from public.spaces), 0, 'Un servidor no ve los espacios');
select is((select count(*)::int from public.bookings_calendar), 0, 'Ni el calendario de reservas');
select pg_temp.como('00000000-0000-0000-0000-000000000ba3');
select ok((select count(*) from public.bookings_calendar) > 0, 'Un líder sí ve el calendario de reservas');

select pg_temp.como('00000000-0000-0000-0000-000000000ba7');
select is((select count(*)::int from public.agenda_reuniones(current_date, current_date + 7)), 2,
          'La agenda le muestra al servidor todas las reuniones publicadas');
select is((select count(*)::int from public.agenda_reuniones(current_date, current_date + 7) where ve_detalle or notes is not null), 0,
          'Sin detalle ni notas de las reuniones donde no sirve');
select is((select count(*)::int from public.meetings), 0, 'Y no puede leer esas reuniones');
select pg_temp.como('00000000-0000-0000-0000-000000000ba5');
select is((select asignado::text || '/' || ve_detalle::text from public.agenda_reuniones(current_date, current_date + 7)
            where id = '00000000-0000-0000-0000-000000000bf1'), 'true/true',
          'En la reunión donde está asignado ve el detalle');

-- ── 3. Roles generales ──────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-000000000ba2');
select throws_ok($$ insert into public.positions (name) values ('VIO prueba 9b') $$, '42501', null,
                 'Un líder de departamento no crea roles generales');
select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select lives_ok($$ insert into public.positions (id, name) values ('00000000-0000-0000-0000-000000000bb9', 'VIO prueba 9') $$,
                'Planeación crea el rol general VIO');
select lives_ok($$ insert into public.checklist_templates (position_id, moment, text) values ('00000000-0000-0000-0000-000000000bb9', 'antes', 'Reunión inicial de servidores') $$,
                'Y su checklist');
select pg_temp.como('00000000-0000-0000-0000-000000000ba3');
select throws_ok($$ insert into public.assignments (meeting_id, person_id, position_id)
                    values ('00000000-0000-0000-0000-000000000bf1', '00000000-0000-0000-0000-000000000bc2', '00000000-0000-0000-0000-000000000bb9') $$,
                 '42501', null, 'Un líder no asigna roles generales');
select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select lives_ok($$ insert into public.assignments (meeting_id, person_id, position_id, status)
                   values ('00000000-0000-0000-0000-000000000bf1', '00000000-0000-0000-0000-000000000bc2', '00000000-0000-0000-0000-000000000bb9', 'aceptada') $$,
                'Planeación asigna VIO a alguien de Protocolo que ya sirve como ujier');
select is((select roles from public.asistencia_sugerida('00000000-0000-0000-0000-000000000bf1') where person_id = '00000000-0000-0000-0000-000000000bc2'),
          array['Ujier', 'VIO prueba 9'], 'La asistencia lo cuenta una vez, con sus dos roles');

-- ── 4. Ajustes en vivo ──────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-000000000ba5');
select throws_ok($$ select public.atrasar_reunion('00000000-0000-0000-0000-000000000bf1', 10) $$, '42501', null,
                 'Un servidor no puede anunciar atrasos');

select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select is((select delay_minutes from public.atrasar_reunion('00000000-0000-0000-0000-000000000bf1', 7)), 7,
          'Planeación atrasa la reunión 7 minutos');
select is((select starts_at - (select starts_at from public.meetings where id = '00000000-0000-0000-0000-000000000bf1')
             from public.proyeccion_reunion('00000000-0000-0000-0000-000000000bf1') where run_item_id = '00000000-0000-0000-0000-000000000b91'),
          interval '7 minutes', 'La proyección corre el primer punto 7 minutos');
select pg_temp.sistema();
select is((select count(*)::int from public.notifications where kind = 'cambio_vivo' and link = '/servir/00000000-0000-0000-0000-000000000bf1/vivo'), 2,
          'Les llega un aviso a los dos servidores asignados');
select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select is((select duration_sec || '/' || planned_duration_sec from public.ajustar_item('00000000-0000-0000-0000-000000000b92', 5)), '2100/1800',
          'Ajustar suma 5 minutos y guarda la duración planeada');
select pg_temp.sistema();
select is((select count(*)::int from public.notifications where kind = 'cambio_vivo' and link = '/servir/00000000-0000-0000-0000-000000000bf1/vivo'), 2,
          'Varios cambios seguidos no amontonan avisos');

select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select throws_ok($$ select public.quitar_item('00000000-0000-0000-0000-000000000b91', true) $$, '42501', null,
                 'Planeación no puede quitar canciones');
select pg_temp.como('00000000-0000-0000-0000-000000000ba3');
select throws_ok($$ select public.quitar_item('00000000-0000-0000-0000-000000000b91', true) $$, '42501', null,
                 'Un líder que no es de música tampoco');
select pg_temp.como('00000000-0000-0000-0000-000000000ba2');
select ok((select removed_at is not null from public.quitar_item('00000000-0000-0000-0000-000000000b91', true)),
          'El líder de música quita la canción');

select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select is((select current_item_id from public.iniciar_reunion('00000000-0000-0000-0000-000000000bf1')), '00000000-0000-0000-0000-000000000b92'::uuid,
          'Al abrir en vivo empieza por el primer punto que no se quitó');
select throws_ok($$ select public.avanzar_item('00000000-0000-0000-0000-000000000bf1', '00000000-0000-0000-0000-000000000b91') $$, 'P0001', null,
                 'No se puede pasar a un punto quitado');
select lives_ok($$ select public.atrasar_reunion('00000000-0000-0000-0000-000000000bf1', 3) $$,
                'En vivo, el atraso alarga el punto actual');
select is((select duration_sec from public.run_items where id = '00000000-0000-0000-0000-000000000b92'), 2280,
          'La prédica queda con 3 minutos más');

select pg_temp.como('00000000-0000-0000-0000-000000000ba7');
select is((select count(*)::int from public.meeting_live_changes), 0, 'Un servidor que no sirve ahí no ve los cambios');
select pg_temp.como('00000000-0000-0000-0000-000000000ba6');
select is((select count(*)::int from public.meeting_live_changes), 4, 'Uno asignado sí los ve');

select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select is((select jsonb_array_length(report -> 'cambios') from public.terminar_reunion('00000000-0000-0000-0000-000000000bf1')), 4,
          'Al terminar queda el reporte con los cuatro cambios');
select pg_temp.sistema();
select is((select count(*)::int from public.notifications
            where kind = 'reporte_reunion' and user_id = '00000000-0000-0000-0000-000000000ba1'
              and link = '/servir/reuniones/00000000-0000-0000-0000-000000000bf1'), 1,
          'Y Planeación recibe el aviso del reporte');

-- Cerrar con "Confirmar y cerrar" la asistencia también deja el reporte.
select pg_temp.como('00000000-0000-0000-0000-000000000ba1');
select lives_ok($$ select public.iniciar_reunion('00000000-0000-0000-0000-000000000bf2');
                   select public.confirmar_asistencia('00000000-0000-0000-0000-000000000bf2', '[]'::jsonb, true) $$,
                'Planeación cierra otra reunión desde la asistencia');
select ok((select status = 'cerrada' and report is not null from public.meetings where id = '00000000-0000-0000-0000-000000000bf2'),
          'Y esa reunión también queda con su reporte');

select * from finish();
rollback;
