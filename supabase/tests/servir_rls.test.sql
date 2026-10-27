-- =====================================================================
-- Pruebas de acceso (RLS) del módulo Servir, por rol.
-- Correr con:  npx supabase test db
-- Cada prueba simula a un usuario con su JWT; nada depende de la interfaz.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- La base local puede tener datos migrados; la prueba parte de tablas vacías
-- (todo se deshace con el rollback del final).
truncate public.meetings, public.people, public.discipleship_groups cascade;

-- ── Datos de prueba ─────────────────────────────────────────────────────
-- Usuarios (el trigger crea su perfil como 'leader')
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'super@test',    'authenticated', 'authenticated', '{"full_name":"Super"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'pastor@test',   'authenticated', 'authenticated', '{"full_name":"Pastor"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'plan@test',     'authenticated', 'authenticated', '{"full_name":"Planeacion"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'liderc@test',   'authenticated', 'authenticated', '{"full_name":"Lider Creativos"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'liderarea@test','authenticated', 'authenticated', '{"full_name":"Lider Luces"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'serva@test',    'authenticated', 'authenticated', '{"full_name":"Servidor A"}'),
  ('00000000-0000-0000-0000-0000000000a7', 'servb@test',    'authenticated', 'authenticated', '{"full_name":"Servidor B"}');

update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'pastor_sede' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'planeacion'  where id = '00000000-0000-0000-0000-0000000000a3';

-- Departamentos y área
insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000000d1', 'Test Creativos', 'departamento'),
  ('00000000-0000-0000-0000-0000000000d2', 'Test Protocolo', 'departamento');
insert into public.areas (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Luces');

insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-0000000000a4', 'lider_departamento', '00000000-0000-0000-0000-0000000000d1');
insert into public.user_roles (user_id, role, area_id) values
  ('00000000-0000-0000-0000-0000000000a5', 'lider_area', '00000000-0000-0000-0000-0000000000e1');

-- Posiciones: Luces (área Luces), Cámaras (Creativos sin área), Ujier (Protocolo)
insert into public.positions (id, ministry_id, area_id, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Luces'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1', null, 'Cámaras'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2', null, 'Ujier');
insert into public.checklist_templates (position_id, moment, text, sort) values
  ('00000000-0000-0000-0000-0000000000b1', 'antes',   'Probar consola', 1),
  ('00000000-0000-0000-0000-0000000000b1', 'durante', 'Escena del coro', 2),
  ('00000000-0000-0000-0000-0000000000b3', 'antes',   'Recibir en la puerta', 1);

-- Personas: A y B con cuenta; P (Protocolo) sin cuenta
insert into public.people (id, full_name, profile_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'Servidor A', '00000000-0000-0000-0000-0000000000a6'),
  ('00000000-0000-0000-0000-0000000000c2', 'Servidor B', '00000000-0000-0000-0000-0000000000a7'),
  ('00000000-0000-0000-0000-0000000000c3', 'Ujier P', null);
insert into public.team_members (person_id, ministry_id, area_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1', null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d2', null);

-- Reuniones: M1 (A y P asignados) y M2 (nadie)
insert into public.meetings (id, name, meeting_date, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'Reunión Central', current_date + 7, 'publicada'),
  ('00000000-0000-0000-0000-0000000000f2', 'Mega Jóvenes',    current_date + 8, 'publicada');
insert into public.assignments (id, meeting_id, person_id, position_id, ministry_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2');
-- P acepta (lo hace el sistema: así existe un checklist de Protocolo)
update public.assignments set status = 'aceptada' where id = '00000000-0000-0000-0000-000000000012';

-- Simula a un usuario autenticado
create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ── Servidor A (asignado solo en M1) ────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a6');
select is((select count(*) from public.meetings)::int, 1, 'Servidor A ve solo la reunión donde está asignado');
select is((select count(*) from public.assignments)::int, 1, 'Servidor A ve solo su asignación');
select is((select status from public.respond_assignment('00000000-0000-0000-0000-000000000011', true)), 'aceptada',
          'Servidor A acepta su asignación');
select is((select count(*) from public.checklist_items)::int, 2, 'Al aceptar, Servidor A recibe su checklist (2 puntos de su posición)');
select is((select count(*) from public.run_items where meeting_id = '00000000-0000-0000-0000-0000000000f2')::int, 0,
          'Servidor A no ve el orden de una reunión donde no sirve');
select throws_ok($$ insert into public.meetings (name, meeting_date) values ('X', current_date) $$, '42501', null,
          'Servidor A no puede crear reuniones');
select ok(not public.has_permission('servir.ver_todo'), 'Servidor A no tiene servir.ver_todo');

-- ── Servidor B (sin asignaciones) ───────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a7');
select is((select count(*) from public.meetings)::int, 0, 'Servidor B no ve ninguna reunión');
select throws_ok($$ select public.respond_assignment('00000000-0000-0000-0000-000000000011', false, 'x') $$, '42501', null,
          'Servidor B no puede responder la asignación de otro');
select is((select count(*) from public.checklist_items)::int, 0, 'Servidor B no ve checklists ajenos');

-- ── Líder de departamento (Creativos) ───────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select is((select count(*) from public.meetings)::int, 2, 'Líder de departamento ve todas las reuniones');
select is((select count(*) from public.assignments)::int, 2, 'Líder de departamento ve el equipo completo (también Protocolo)');
select is((select count(*) from public.checklist_items ci join public.assignments a on a.id = ci.assignment_id
            where a.ministry_id = '00000000-0000-0000-0000-0000000000d1')::int, 2,
          'Líder de departamento ve los checklists de su departamento');
select is((select count(*) from public.checklist_items ci join public.assignments a on a.id = ci.assignment_id
            where a.ministry_id = '00000000-0000-0000-0000-0000000000d2')::int, 0,
          'Líder de departamento NO ve los checklists de otro departamento');
select lives_ok($$ insert into public.assignments (meeting_id, person_id, position_id, ministry_id)
                  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2',
                          '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1') $$,
          'Líder de departamento asigna a su gente');
select throws_ok($$ insert into public.assignments (meeting_id, person_id, position_id, ministry_id)
                   values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c3',
                           '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2') $$,
          '42501', null, 'Líder de departamento NO asigna en otro departamento');
select lives_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                  values ('00000000-0000-0000-0000-0000000000a4', 'departamento', '00000000-0000-0000-0000-0000000000d1', 'Hola', 'Equipo') $$,
          'Líder de departamento notifica a su departamento');
select throws_ok($$ insert into public.broadcasts (author_id, audience, title, body)
                   values ('00000000-0000-0000-0000-0000000000a4', 'todos', 'Hola', 'Todos') $$,
          '42501', null, 'Líder de departamento NO notifica a todos');

-- ── Líder de área (Luces) ───────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.meetings)::int, 2, 'Líder de área ve todas las reuniones');
select lives_ok($$ insert into public.assignments (meeting_id, person_id, position_id, ministry_id)
                  values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1',
                          '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') $$,
          'Líder de área asigna en su área');
select throws_ok($$ insert into public.assignments (meeting_id, person_id, position_id, ministry_id)
                   values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2',
                           '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1') $$,
          '42501', null, 'Líder de área NO asigna fuera de su área');

-- ── Planeación ──────────────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$ insert into public.meetings (name, meeting_date) values ('Nueva', current_date + 14) $$,
          'Planeación crea reuniones');
select is((select count(*) from public.checklist_items)::int, 3, 'Planeación ve todos los checklists (2 de Luces + 1 de Protocolo)');
select throws_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                   values ('00000000-0000-0000-0000-0000000000a3', 'departamento', '00000000-0000-0000-0000-0000000000d2', 'x', 'y') $$,
          '42501', null, 'Planeación NO notifica a un departamento');
select throws_ok($$ insert into public.broadcasts (author_id, audience, title, body)
                   values ('00000000-0000-0000-0000-0000000000a3', 'todos', 'x', 'y') $$,
          '42501', null, 'Planeación NO notifica a todos');
select lives_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                  values ('00000000-0000-0000-0000-0000000000a3', 'reunion', '00000000-0000-0000-0000-0000000000f1', 'Mañana', 'Los esperamos') $$,
          'Planeación notifica a los servidores de una reunión');

-- ── Pastor de sede ──────────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select ok(public.has_permission('servir.ver_todo'), 'Pastor de sede tiene servir.ver_todo');
select lives_ok($$ insert into public.broadcasts (author_id, audience, title, body)
                  values ('00000000-0000-0000-0000-0000000000a2', 'todos', 'Aviso', 'A todos los servidores') $$,
          'Pastor de sede notifica a todos los servidores');

-- ── Super admin ─────────────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.meetings)::int, 3, 'Super admin ve todas las reuniones');
select ok(public.has_permission('cualquier.permiso'), 'Super admin tiene cualquier permiso');

select * from finish();
rollback;
