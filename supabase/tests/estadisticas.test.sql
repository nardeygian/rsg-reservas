-- =====================================================================
-- Pruebas de C3: estadísticas y salud del servidor
-- (20261028190000_c3_estadisticas.sql). Correr con: npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
create or replace function pg_temp.hoy() returns date language sql as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009a1', 'plan9@test', 'authenticated', 'authenticated', '{"full_name":"Planeacion"}'),
  ('00000000-0000-0000-0000-0000000009a2', 'lid9@test',  'authenticated', 'authenticated', '{"full_name":"Lider D1"}'),
  ('00000000-0000-0000-0000-0000000009a3', 'area9@test', 'authenticated', 'authenticated', '{"full_name":"Lider Area"}'),
  ('00000000-0000-0000-0000-0000000009a4', 'disc9@test', 'authenticated', 'authenticated', '{"full_name":"Lider Disc"}'),
  ('00000000-0000-0000-0000-0000000009a5', 'serv9@test', 'authenticated', 'authenticated', '{"full_name":"Servidor A"}');
update public.profiles set role = 'planeacion' where id = '00000000-0000-0000-0000-0000000009a1';

insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000009d1', 'Test D1', 'departamento'),
  ('00000000-0000-0000-0000-0000000009d2', 'Test D2', 'departamento');
insert into public.areas (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009d1', 'Área 1');
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-0000000009a2', 'lider_departamento', '00000000-0000-0000-0000-0000000009d1');
insert into public.user_roles (user_id, role, area_id) values
  ('00000000-0000-0000-0000-0000000009a3', 'lider_area', '00000000-0000-0000-0000-0000000009e1');
insert into public.discipleship_groups (id, name, leader_user_ids) values
  ('test-g9', 'Grupo 9', array['00000000-0000-0000-0000-0000000009a4'::uuid]);

-- A (D1, Área 1): 3 servicios → sobrecargado. B (D1): 2 → sano.
-- C (D2): 1 → alejándose. Dd (D2, discípulo de G9): hace 60 días → inactivo.
insert into public.people (id, full_name, profile_id, discipleship_group_id) values
  ('00000000-0000-0000-0000-0000000009c1', 'A', '00000000-0000-0000-0000-0000000009a5', null),
  ('00000000-0000-0000-0000-0000000009c2', 'B', null, null),
  ('00000000-0000-0000-0000-0000000009c3', 'C', null, null),
  ('00000000-0000-0000-0000-0000000009c4', 'Dd', null, 'test-g9');
insert into public.team_members (person_id, ministry_id, area_id) values
  ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009e1'),
  ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-0000000009d1', null),
  ('00000000-0000-0000-0000-0000000009c3', '00000000-0000-0000-0000-0000000009d2', null),
  ('00000000-0000-0000-0000-0000000009c4', '00000000-0000-0000-0000-0000000009d2', null);
insert into public.positions (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1', 'Pos D1'),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009d2', 'Pos D2');

insert into public.meetings (id, name, meeting_date, status) values
  ('00000000-0000-0000-0000-0000000009f1', 'R1', pg_temp.hoy() - 3,  'cerrada'),
  ('00000000-0000-0000-0000-0000000009f2', 'R2', pg_temp.hoy() - 10, 'cerrada'),
  ('00000000-0000-0000-0000-0000000009f3', 'R3', pg_temp.hoy() - 17, 'cerrada'),
  ('00000000-0000-0000-0000-0000000009f4', 'R4', pg_temp.hoy() - 60, 'cerrada'),
  ('00000000-0000-0000-0000-0000000009f5', 'R5', pg_temp.hoy() - 5,  'cancelada');
insert into public.meeting_changes (meeting_id, change, reason) values
  ('00000000-0000-0000-0000-0000000009f5', 'cancelada', 'Lluvia'),
  ('00000000-0000-0000-0000-0000000009f1', 'reprogramada', 'Cambio de sala');
insert into public.assignments (meeting_id, person_id, position_id, ministry_id, status, responded_at, created_at) values
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1', 'aceptada', now() - interval '4 days', now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009c3', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009d2', 'aceptada', now() - interval '4 days', now() - interval '5 days');
insert into public.attendance (meeting_id, person_id, status) values
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009c1', 'asistio'),
  ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009c1', 'asistio'),
  ('00000000-0000-0000-0000-0000000009f3', '00000000-0000-0000-0000-0000000009c1', 'tarde'),
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009c2', 'asistio'),
  ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009c2', 'asistio'),
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009c3', 'asistio'),
  ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009c3', 'ausente'),
  ('00000000-0000-0000-0000-0000000009f4', '00000000-0000-0000-0000-0000000009c4', 'asistio');
refresh materialized view public.salud_servidor_mensual;

-- ── Planeación: todo ────────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000009a1');
select is((select string_agg(full_name || ':' || semaforo, ',' order by full_name) from public.salud_servidores()),
          'A:sobrecargado,B:sano,C:alejandose,Dd:inactivo', 'Semáforo con los umbrales de Gian (3 mucho, 1 poco, 6 semanas)');
select is((select racha_semanas from public.salud_servidores() where full_name = 'A'), 3, 'A lleva 3 semanas seguidas sirviendo');
select is((select ausencias_ventana from public.salud_servidores() where full_name = 'C'), 1, 'C tiene una ausencia');
select is((select string_agg(full_name, ',' order by full_name) from public.salud_servidores('00000000-0000-0000-0000-0000000009d2')),
          'C,Dd', 'Filtro por departamento');
select is((select count(*)::int from public.estadisticas_reuniones(pg_temp.hoy() - 30, pg_temp.hoy())), 4,
          'Planeación ve las reuniones del periodo (incluida la cancelada)');
select is((select motivo_cancelacion from public.estadisticas_reuniones(pg_temp.hoy() - 30, pg_temp.hoy()) where name = 'R5'),
          'Lluvia', 'La cancelada muestra su motivo');
select is((select reprogramaciones || '/' || aceptadas || '/' || asistio from public.estadisticas_reuniones(pg_temp.hoy() - 30, pg_temp.hoy()) where name = 'R1'),
          '1/2/2', 'R1: una reprogramación, dos aceptadas, dos asistieron');
select is((select (ficha_servidor('00000000-0000-0000-0000-0000000009c1') -> 'historial' -> 0 ->> 'reunion')), 'R1',
          'La ficha trae el historial, lo más reciente primero');
select is((select count(*)::int from public.salud_mensual()), 4, 'Historial mensual de todos (una fila por persona y mes)');
select lives_ok($$ update public.servir_ajustes set sobrecargado_desde = 4 $$, 'Planeación ajusta los umbrales');
select is((select semaforo from public.salud_servidores() where full_name = 'A'), 'sano', 'Con el umbral en 4, A queda sano');

-- ── Líder de departamento D1 ────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000009a2');
select is((select string_agg(full_name, ',' order by full_name) from public.salud_servidores()), 'A,B',
          'El líder de D1 ve solo la salud de su gente');
select is((select aceptadas from public.estadisticas_reuniones(pg_temp.hoy() - 30, pg_temp.hoy()) where name = 'R1'), 1,
          'En las reuniones, el líder de D1 solo cuenta las asignaciones de su gente');
select is(public.ficha_servidor('00000000-0000-0000-0000-0000000009c3'), null, 'El líder de D1 no ve la ficha de alguien de D2');
update public.servir_ajustes set sobrecargado_desde = 9;
select is((select sobrecargado_desde from public.servir_ajustes), 4, 'El líder no cambia los umbrales (RLS no deja tocar la fila)');

-- ── Líder de área, de discipulado y servidor ────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000009a3');
select is((select string_agg(full_name, ',') from public.salud_servidores()), 'A', 'El líder de área ve solo a su área');
select pg_temp.como('00000000-0000-0000-0000-0000000009a4');
select is((select string_agg(full_name, ',') from public.salud_servidores()), 'Dd', 'El líder de discipulado ve solo a sus discípulos que sirven');
select pg_temp.como('00000000-0000-0000-0000-0000000009a5');
select is((select count(*)::int from public.salud_servidores()), 0, 'Un servidor no ve el tablero');
select is((select count(*)::int from public.estadisticas_reuniones(pg_temp.hoy() - 30, pg_temp.hoy())), 0,
          'Ni las estadísticas de reuniones');
select throws_ok($$ select * from public.salud_servidor_mensual $$, '42501', null,
                 'Nadie lee la vista materializada directo');

select * from finish();
rollback;
