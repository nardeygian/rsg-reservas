-- =====================================================================
-- Pruebas: rol 'servidor', solicitudes de departamento y eliminar cuenta
-- con sus reservas (20261028170000_c_cuentas_servidor.sql).
-- Correr con:  npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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

-- ── Rol inicial ─────────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'g@test', 'authenticated', 'authenticated', '{"provider":"google"}', '{"full_name":"Con Google"}'),
  ('00000000-0000-0000-0000-0000000007a2', 'a@test', 'authenticated', 'authenticated', '{"provider":"apple"}',  '{"name":"Con Apple"}'),
  ('00000000-0000-0000-0000-0000000007a3', 'c@test', 'authenticated', 'authenticated', '{"provider":"email"}',  '{"full_name":"Correo","requested_role":"pastor_sede"}'),
  ('00000000-0000-0000-0000-0000000007a4', 'i@test', 'authenticated', 'authenticated', '{"provider":"email"}',  '{"full_name":"Invitado","via":"invitacion"}'),
  ('00000000-0000-0000-0000-0000000007a5', 'l@test', 'authenticated', 'authenticated', '{"provider":"email"}',  '{"full_name":"Lider Dep"}'),
  ('00000000-0000-0000-0000-0000000007a6', 'o@test', 'authenticated', 'authenticated', '{"provider":"email"}',  '{"full_name":"Lider Otro"}'),
  ('00000000-0000-0000-0000-0000000007a7', 'p@test', 'authenticated', 'authenticated', '{"provider":"email"}',  '{"full_name":"Pastor"}');

select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000007a1'), 'servidor', 'Quien entra con Google sin invitación es servidor');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000007a2'), 'servidor', 'Quien entra con Apple sin invitación es servidor');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000007a2'), 'Con Apple', 'Apple: toma el nombre de "name"');
select is((select role || '/' || requested_role from public.profiles where id = '00000000-0000-0000-0000-0000000007a3'),
          'leader/pastor_sede', 'El registro por correo sigue como hoy (leader con rol pedido)');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000007a4'), 'servidor', 'El registro por invitación es servidor');

update public.profiles set role = 'pastor_sede' where id = '00000000-0000-0000-0000-0000000007a7';
insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000007d1', 'Test Alabanza', 'departamento'),
  ('00000000-0000-0000-0000-0000000007d2', 'Test Logística', 'departamento'),
  ('00000000-0000-0000-0000-0000000007d3', 'Test Ministerio', 'ministerio');
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-0000000007a5', 'lider_departamento', '00000000-0000-0000-0000-0000000007d1'),
  ('00000000-0000-0000-0000-0000000007a6', 'lider_departamento', '00000000-0000-0000-0000-0000000007d2');

-- Un servidor no puede reservar espacios.
insert into public.organizations (id, name, type) values ('00000000-0000-0000-0000-0000000007f1', 'Test Org', 'church');
insert into public.spaces (id, name, slug, status, booking_policy) values
  ('00000000-0000-0000-0000-0000000007e1', 'Test Sala', 'test-sala-7', 'active', 'self_serve');
select pg_temp.como('00000000-0000-0000-0000-0000000007a1');
select throws_ok($$ insert into public.bookings (space_id, owner_org_id, use_type, starts_at, ends_at, created_by)
                    values ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007f1', 'otro',
                            now() + interval '1 day', now() + interval '1 day 1 hour', '00000000-0000-0000-0000-0000000007a1') $$,
                 '42501', null, 'Un servidor no puede crear reservas');

-- ── Solicitudes ─────────────────────────────────────────────────────────
select throws_ok($$ select public.solicitar_unirse('00000000-0000-0000-0000-0000000007d3') $$, '22023', null,
                 'Solo se puede pedir unirse a un departamento (no a un ministerio)');
select lives_ok($$ select public.solicitar_unirse('00000000-0000-0000-0000-0000000007d1', 'Toco guitarra') $$,
                'El servidor pide unirse a Alabanza');
select lives_ok($$ select public.solicitar_unirse('00000000-0000-0000-0000-0000000007d1', 'Y bajo') $$,
                'Pedir otra vez actualiza la misma solicitud pendiente');
select is((select count(*)::int from public.team_join_requests), 1, 'El servidor ve su única solicitud');
select throws_ok($$ insert into public.team_join_requests (profile_id, ministry_id) values
                    ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007d2') $$,
                 '42501', null, 'Nadie escribe solicitudes directo en la tabla');
select throws_ok($$ select public.responder_solicitud((select id from public.team_join_requests limit 1), true) $$,
                 '42501', null, 'El servidor no puede aprobarse a sí mismo');

select pg_temp.como('00000000-0000-0000-0000-0000000007a6');
select is((select count(*)::int from public.team_join_requests), 0, 'El líder de otro departamento no ve la solicitud');
select is((select count(*)::int from public.notifications where kind = 'solicitud_equipo'), 0, 'Ni recibe el aviso');

select pg_temp.como('00000000-0000-0000-0000-0000000007a5');
select is((select count(*)::int from public.notifications where kind = 'solicitud_equipo'), 1, 'El líder de Alabanza recibe un aviso');
select is((select message from public.team_join_requests), 'Y bajo', 'El líder de Alabanza ve la solicitud');
select isnt((select public.responder_solicitud((select id from public.team_join_requests limit 1), true)), null,
            'El líder de Alabanza aprueba');

select pg_temp.sistema();
select is((select count(*)::int from public.team_members tm join public.people p on p.id = tm.person_id
            where p.profile_id = '00000000-0000-0000-0000-0000000007a1' and tm.ministry_id = '00000000-0000-0000-0000-0000000007d1'),
          1, 'Al aprobar, la persona se crea unida a su cuenta y entra al equipo');

select pg_temp.como('00000000-0000-0000-0000-0000000007a1');
select throws_ok($$ select public.solicitar_unirse('00000000-0000-0000-0000-0000000007d1') $$, 'P0001', null,
                 'No puede volver a pedir un departamento donde ya está');
select is((select title from public.notifications where kind = 'solicitud_equipo'), 'Ya eres parte de Test Alabanza',
          'El servidor recibe el aviso de aprobación');
select lives_ok($$ select public.solicitar_unirse('00000000-0000-0000-0000-0000000007d2') $$, 'Pide unirse a Logística');

select pg_temp.como('00000000-0000-0000-0000-0000000007a7');
select lives_ok($$ select public.responder_solicitud((select id from public.team_join_requests where status = 'pendiente'), false, 'Está lleno') $$,
                'Un pastor de sede puede responder solicitudes de cualquier departamento');

-- ── Eliminar cuenta con reservas ────────────────────────────────────────
select pg_temp.sistema();
update public.profiles set role = 'leader' where id = '00000000-0000-0000-0000-0000000007a3';
insert into public.bookings (id, space_id, owner_org_id, use_type, starts_at, ends_at, created_by, ministry_id) values
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007f1', 'otro',
   now() + interval '2 day', now() + interval '2 day 1 hour', '00000000-0000-0000-0000-0000000007a3', null);
update public.ministries set lead_user_id = '00000000-0000-0000-0000-0000000007a3' where id = '00000000-0000-0000-0000-0000000007d2';

select is((select row(reservas, reservas_futuras, ministerios_que_lidera)::text
             from public.cuenta_resumen_eliminacion('00000000-0000-0000-0000-0000000007a3')),
          '(1,1,1)', 'El resumen cuenta sus reservas y los ministerios que lidera');
select public.eliminar_datos_personales('00000000-0000-0000-0000-0000000007a3');
delete from auth.users where id = '00000000-0000-0000-0000-0000000007a3';
select is((select count(*)::int from public.bookings where id = '00000000-0000-0000-0000-0000000007b1'), 0,
          'Al eliminar la cuenta se borran sus reservas');

select * from finish();
rollback;
