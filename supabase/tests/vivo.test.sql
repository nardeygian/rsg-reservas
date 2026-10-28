-- =====================================================================
-- Pruebas de C1: en vivo y asistencia (20261028180000_c1_vivo.sql).
-- Correr con:  npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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

-- Usuarios: Planeación, líder de Creativos, líder de Protocolo, servidores A y B
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008a1', 'plan8@test',  'authenticated', 'authenticated', '{"full_name":"Planeacion"}'),
  ('00000000-0000-0000-0000-0000000008a2', 'lidc8@test',  'authenticated', 'authenticated', '{"full_name":"Lider Creativos"}'),
  ('00000000-0000-0000-0000-0000000008a3', 'lidp8@test',  'authenticated', 'authenticated', '{"full_name":"Lider Protocolo"}'),
  ('00000000-0000-0000-0000-0000000008a4', 'serva8@test', 'authenticated', 'authenticated', '{"full_name":"Servidor A"}'),
  ('00000000-0000-0000-0000-0000000008a5', 'servb8@test', 'authenticated', 'authenticated', '{"full_name":"Servidor B"}');
update public.profiles set role = 'planeacion' where id = '00000000-0000-0000-0000-0000000008a1';

insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000008d1', 'Test Creativos 8', 'departamento'),
  ('00000000-0000-0000-0000-0000000008d2', 'Test Protocolo 8', 'departamento');
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-0000000008a2', 'lider_departamento', '00000000-0000-0000-0000-0000000008d1'),
  ('00000000-0000-0000-0000-0000000008a3', 'lider_departamento', '00000000-0000-0000-0000-0000000008d2');
insert into public.positions (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008d1', 'Luces'),
  ('00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008d2', 'Ujier');
insert into public.checklist_templates (position_id, moment, text, sort) values
  ('00000000-0000-0000-0000-0000000008b1', 'antes', 'Probar consola', 1),
  ('00000000-0000-0000-0000-0000000008b1', 'durante', 'Escena del coro', 2);
insert into public.people (id, full_name, profile_id) values
  ('00000000-0000-0000-0000-0000000008c1', 'Servidor A', '00000000-0000-0000-0000-0000000008a4'),
  ('00000000-0000-0000-0000-0000000008c2', 'Servidor B', '00000000-0000-0000-0000-0000000008a5');
insert into public.team_members (person_id, ministry_id) values
  ('00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008d1'),
  ('00000000-0000-0000-0000-0000000008c2', '00000000-0000-0000-0000-0000000008d2');

insert into public.meetings (id, name, meeting_date, status) values
  ('00000000-0000-0000-0000-0000000008f1', 'Reunión Central', (now() at time zone 'America/Bogota')::date, 'publicada'),
  ('00000000-0000-0000-0000-0000000008f2', 'Semilleros', (now() at time zone 'America/Bogota')::date + 10, 'publicada');
insert into public.run_items (id, meeting_id, sort, kind, title, duration_sec) values
  ('00000000-0000-0000-0000-000000000891', '00000000-0000-0000-0000-0000000008f1', 1, 'cancion', 'Canción 1', 300),
  ('00000000-0000-0000-0000-000000000892', '00000000-0000-0000-0000-0000000008f1', 2, 'predica', 'Prédica', 1800);
insert into public.assignments (id, meeting_id, person_id, position_id, ministry_id, status) values
  ('00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c1',
   '00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008d1', 'aceptada'),
  ('00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c2',
   '00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008d2', 'aceptada');

-- ── Permisos de tabla ───────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000008a4');
select throws_ok($$ update public.checklist_items set text = 'x' $$, '42501', null,
                 'Un servidor no puede editar el texto de su checklist directo');
select throws_ok($$ insert into public.checklist_items (assignment_id, moment, text)
                    values ('00000000-0000-0000-0000-000000000881', 'antes', 'x') $$, '42501', null,
                 'Ni crear puntos de checklist');

-- ── En vivo ─────────────────────────────────────────────────────────────
select throws_ok($$ select public.iniciar_reunion('00000000-0000-0000-0000-0000000008f1') $$, '42501', null,
                 'Un servidor no puede abrir la reunión en vivo');
select pg_temp.como('00000000-0000-0000-0000-0000000008a2');
select throws_ok($$ select public.iniciar_reunion('00000000-0000-0000-0000-0000000008f1') $$, '42501', null,
                 'Un líder de departamento tampoco');

select pg_temp.como('00000000-0000-0000-0000-0000000008a1');
select is((select status || '/' || (current_item_id = '00000000-0000-0000-0000-000000000891')::text
             from public.iniciar_reunion('00000000-0000-0000-0000-0000000008f1')),
          'en_vivo/true', 'Planeación abre la reunión en vivo y el primer ítem queda como actual');
select isnt((select actual_start from public.run_items where id = '00000000-0000-0000-0000-000000000891'), null,
            'El primer ítem marca su inicio real');
select is((select current_item_id from public.avanzar_item('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-000000000892')),
          '00000000-0000-0000-0000-000000000892'::uuid, 'Planeación avanza al siguiente ítem');
select isnt((select actual_end from public.run_items where id = '00000000-0000-0000-0000-000000000891'), null,
            'El ítem anterior queda con su fin real');
select throws_ok($$ select public.avanzar_item('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008f2') $$,
                 '22023', null, 'No se puede avanzar a un ítem de otra reunión');
select pg_temp.sistema();
update public.meetings set status = 'borrador' where id = '00000000-0000-0000-0000-0000000008f2';
select pg_temp.como('00000000-0000-0000-0000-0000000008a1');
select throws_ok($$ select public.iniciar_reunion('00000000-0000-0000-0000-0000000008f2') $$, 'P0001', null,
                 'Un borrador no se puede abrir en vivo');

-- El servidor ve el ítem actual y marca su checklist
select pg_temp.como('00000000-0000-0000-0000-0000000008a4');
select is((select current_item_id from public.meetings where id = '00000000-0000-0000-0000-0000000008f1'),
          '00000000-0000-0000-0000-000000000892'::uuid, 'El servidor ve el ítem actual');
select lives_ok($$ select public.toggle_checklist_item(id, true) from public.checklist_items $$,
                'El servidor completa su checklist');

-- ── Asistencia ──────────────────────────────────────────────────────────
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1',
                    '[{"person_id":"00000000-0000-0000-0000-0000000008c1","status":"asistio"}]') $$, '42501', null,
                 'El servidor no confirma su propia asistencia');
select is((select count(*)::int from public.asistencia_sugerida('00000000-0000-0000-0000-0000000008f1')), 0,
          'El servidor no ve la lista de asistencia');

select pg_temp.como('00000000-0000-0000-0000-0000000008a2');
select is((select string_agg(full_name || ':' || coalesce(suggested, '-'), ',')
             from public.asistencia_sugerida('00000000-0000-0000-0000-0000000008f1')),
          'Servidor A:asistio', 'El líder de Creativos ve solo a su gente, prellenada con "asistió" (checklist completo)');
select is((select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1',
             '[{"person_id":"00000000-0000-0000-0000-0000000008c1","status":"tarde","roles":["Luces"]}]')),
          1, 'El líder de departamento confirma la asistencia de su gente');
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1',
                    '[{"person_id":"00000000-0000-0000-0000-0000000008c2","status":"ausente"}]') $$, '42501', null,
                 'El líder de Creativos no confirma a alguien de Protocolo');
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1', '[]', true) $$, '42501', null,
                 'El líder no puede cerrar la asistencia');

select pg_temp.como('00000000-0000-0000-0000-0000000008a1');
select is((select count(*)::int from public.asistencia_sugerida('00000000-0000-0000-0000-0000000008f1')), 2,
          'Planeación ve a todos los asignados');
select is((select public.terminar_reunion('00000000-0000-0000-0000-0000000008f1')).status, 'cerrada',
          'Planeación termina la reunión');
select is((select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1',
             '[{"person_id":"00000000-0000-0000-0000-0000000008c2","status":"asistio"}]', true)),
          1, 'Planeación confirma y cierra la asistencia');
select isnt((select attendance_closed_at from public.meetings where id = '00000000-0000-0000-0000-0000000008f1'), null,
            'La reunión queda con la asistencia cerrada');

select pg_temp.como('00000000-0000-0000-0000-0000000008a2');
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1',
                    '[{"person_id":"00000000-0000-0000-0000-0000000008c1","status":"asistio"}]') $$, '42501', null,
                 'Cerrada la asistencia, el líder ya no la cambia');

select pg_temp.sistema();
select is((select count(*)::int from public.service_units where meeting_id = '00000000-0000-0000-0000-0000000008f1'), 2,
          'La asistencia confirmada cuenta en Servicio (tarde cuenta, como hoy)');
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f2', '[]') $$, '42501', null,
                 'Sin sesión no se confirma nada');

select pg_temp.como('00000000-0000-0000-0000-0000000008a1');
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f2',
                    '[{"person_id":"00000000-0000-0000-0000-0000000008c1","status":"asistio"}]') $$, 'P0001', null,
                 'No se confirma la asistencia de un borrador');
select throws_ok($$ select public.confirmar_asistencia('00000000-0000-0000-0000-0000000008f1',
                    '[{"person_id":"00000000-0000-0000-0000-0000000008c1","status":"presente"}]') $$, '22023', null,
                 'Estado de asistencia inválido');

select * from finish();
rollback;
