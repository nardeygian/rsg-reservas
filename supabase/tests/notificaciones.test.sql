-- =====================================================================
-- Pruebas del frente B4 Notificaciones: audiencias por rol, avisos
-- automáticos, despachador y bandeja.
-- Correr con:  npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

truncate public.meetings, public.people, public.discipleship_groups, public.broadcasts cascade;

-- ── Datos de prueba ─────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'pastor@test',   'authenticated', 'authenticated', '{"full_name":"Pastor"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'liderc@test',   'authenticated', 'authenticated', '{"full_name":"Lider Creativos"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'liderarea@test','authenticated', 'authenticated', '{"full_name":"Lider Luces"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'serva@test',    'authenticated', 'authenticated', '{"full_name":"Servidor A"}'),
  ('00000000-0000-0000-0000-0000000000a7', 'servb@test',    'authenticated', 'authenticated', '{"full_name":"Servidor B"}'),
  ('00000000-0000-0000-0000-0000000000a8', 'servp@test',    'authenticated', 'authenticated', '{"full_name":"Ujier P"}');
update public.profiles set role = 'pastor_sede' where id = '00000000-0000-0000-0000-0000000000a2';

insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000000d1', 'Test Creativos', 'departamento'),
  ('00000000-0000-0000-0000-0000000000d2', 'Test Protocolo', 'departamento');
insert into public.areas (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Luces');
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-0000000000a4', 'lider_departamento', '00000000-0000-0000-0000-0000000000d1');
insert into public.user_roles (user_id, role, area_id) values
  ('00000000-0000-0000-0000-0000000000a5', 'lider_area', '00000000-0000-0000-0000-0000000000e1');

insert into public.positions (id, ministry_id, area_id, name) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Luces'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2', null, 'Ujier');
insert into public.people (id, full_name, profile_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'Servidor A', '00000000-0000-0000-0000-0000000000a6'),
  ('00000000-0000-0000-0000-0000000000c2', 'Servidor B', '00000000-0000-0000-0000-0000000000a7'),
  ('00000000-0000-0000-0000-0000000000c3', 'Ujier P',    '00000000-0000-0000-0000-0000000000a8');
insert into public.team_members (person_id, ministry_id, area_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1', null),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d2', null);
insert into public.meetings (id, name, meeting_date, starts_at, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'Reunión Central', current_date + 7, now() + interval '7 days', 'publicada');

create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.sistema() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- ── Avisos automáticos ──────────────────────────────────────────────────
insert into public.assignments (id, meeting_id, person_id, position_id, ministry_id, assigned_by) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a5'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3',
   '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d2', null);

select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a6' and kind = 'asignacion')::int, 1,
          'Al asignar, el servidor recibe "Te asignaron"');
select is((select title from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a6' and kind = 'asignacion'),
          'Te asignaron Luces', 'El aviso nombra la posición');

select pg_temp.como('00000000-0000-0000-0000-0000000000a8');
select lives_ok($$ select public.respond_assignment('00000000-0000-0000-0000-000000000012', false, 'Viajo') $$, 'Ujier P rechaza');
select pg_temp.sistema();
select is((select count(*) from public.notifications where kind = 'rechazo')::int, 0,
          'Sin quien asignó, el rechazo no avisa a nadie');

select pg_temp.como('00000000-0000-0000-0000-0000000000a6');
select lives_ok($$ select public.respond_assignment('00000000-0000-0000-0000-000000000011', false, 'Enfermo') $$, 'Servidor A rechaza');
select pg_temp.sistema();
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a5' and kind = 'rechazo')::int, 1,
          'El rechazo le avisa a quien asignó');
update public.assignments set status = 'aceptada' where id = '00000000-0000-0000-0000-000000000011';

insert into public.meeting_changes (meeting_id, change, previous_date, new_date, new_starts_at)
values ('00000000-0000-0000-0000-0000000000f1', 'reprogramada', current_date + 7, current_date + 8, now() + interval '8 days');
select is((select count(*) from public.notifications where kind = 'cambio_reunion')::int, 1,
          'Reprogramar avisa solo a los asignados vigentes (A sí, P rechazó)');

-- ── Despachador ─────────────────────────────────────────────────────────
update public.reminders set send_at = now() - interval '1 minute'
 where assignment_id = '00000000-0000-0000-0000-000000000011' and kind = 'manana';
select is((select (public.notificador_procesar() ->> 'recordatorios')::int), 1, 'El despachador procesa el recordatorio vencido');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a6' and kind = 'recordatorio')::int, 1,
          'El recordatorio vencido queda en la bandeja del servidor');
select is((select count(*) from public.reminders where kind = 'manana' and sent_at is not null)::int, 1, 'El recordatorio queda marcado');
select is((select (public.notificador_procesar() ->> 'recordatorios')::int), 0, 'Una segunda corrida no lo duplica');

-- ── Audiencias por rol ──────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$ insert into public.broadcasts (author_id, audience, title, body)
                   values ('00000000-0000-0000-0000-0000000000a4', 'todos', 'Hola', 'Todos') $$,
          '42501', null, 'Líder de departamento NO envía a todos');
select throws_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                   values ('00000000-0000-0000-0000-0000000000a4', 'departamento', '00000000-0000-0000-0000-0000000000d2', 'Hola', 'x') $$,
          '42501', null, 'Líder de departamento NO envía a otro departamento');
select lives_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                  values ('00000000-0000-0000-0000-0000000000a4', 'area', '00000000-0000-0000-0000-0000000000e1', 'Luces', 'Ensayo') $$,
          'Líder de departamento envía a un área de su departamento');
select lives_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                  values ('00000000-0000-0000-0000-0000000000a4', 'departamento', '00000000-0000-0000-0000-0000000000d1', 'Creativos', 'Reunión de equipo') $$,
          'Líder de departamento envía a su departamento');
select throws_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body, sent_at)
                   values ('00000000-0000-0000-0000-0000000000a4', 'departamento', '00000000-0000-0000-0000-0000000000d1', 'x', 'y', now()) $$,
          '42501', null, 'Nadie crea un envío marcado como ya enviado');
select is((select array_agg(audience order by audience) from public.my_broadcast_audiences()), array['area', 'departamento'],
          'Líder de departamento ve como audiencias su departamento y su área, no "todos"');

select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select throws_ok($$ insert into public.broadcasts (author_id, audience, scope_id, title, body)
                   values ('00000000-0000-0000-0000-0000000000a5', 'departamento', '00000000-0000-0000-0000-0000000000d1', 'x', 'y') $$,
          '42501', null, 'Líder de área NO envía a todo el departamento');

select pg_temp.sistema();
select is((select (public.notificador_procesar() ->> 'envios')::int), 2, 'El despachador procesa los dos envíos');
select is((select recipients_count from public.broadcasts where audience = 'departamento'), 2,
          'El envío al departamento llega a sus dos servidores con cuenta (no a Protocolo)');

-- ── Bandeja ─────────────────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000000a7');
select is((select count(*) from public.notifications)::int, 1, 'Servidor B ve solo su bandeja (el envío de Creativos)');
update public.notifications set read_at = now();
select is((select count(*) from public.notifications where read_at is null)::int, 0, 'Servidor B marca sus avisos como leídos');
select throws_ok($$ update public.notifications set title = 'x' $$, '42501', null, 'Servidor B no puede cambiar el texto de un aviso');
select throws_ok($$ select public.notificador_procesar() $$, '42501', null, 'Un usuario no puede correr el despachador');

select * from finish();
rollback;
