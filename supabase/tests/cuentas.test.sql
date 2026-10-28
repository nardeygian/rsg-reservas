-- =====================================================================
-- Pruebas del frente B5 Cuentas: invitaciones que unen la cuenta a la
-- persona, permisos para invitar y tablas cerradas.
-- Correr con:  npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

truncate public.people, public.account_invitations cascade;

-- ── Datos de prueba ─────────────────────────────────────────────────────
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a2', 'pastor@b5.test',    'authenticated', 'authenticated', '{"full_name":"Pastor"}'),
  ('00000000-0000-0000-0000-0000000005a4', 'liderc@b5.test',    'authenticated', 'authenticated', '{"full_name":"Lider Creativos"}'),
  ('00000000-0000-0000-0000-0000000005a5', 'liderarea@b5.test', 'authenticated', 'authenticated', '{"full_name":"Lider Luces"}'),
  ('00000000-0000-0000-0000-0000000005a6', 'serva@b5.test',     'authenticated', 'authenticated', '{"full_name":"Servidor A"}'),
  ('00000000-0000-0000-0000-0000000005a7', 'nueva@privaterelay.appleid.com', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000005a8', 'otra@b5.test',      'authenticated', 'authenticated', '{}');
update public.profiles set role = 'pastor_sede' where id = '00000000-0000-0000-0000-0000000005a2';

insert into public.ministries (id, name, type) values
  ('00000000-0000-0000-0000-0000000005d1', 'B5 Creativos', 'departamento'),
  ('00000000-0000-0000-0000-0000000005d2', 'B5 Protocolo', 'departamento');
insert into public.areas (id, ministry_id, name) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005d1', 'Luces');
insert into public.user_roles (user_id, role, ministry_id) values
  ('00000000-0000-0000-0000-0000000005a4', 'lider_departamento', '00000000-0000-0000-0000-0000000005d1');
insert into public.user_roles (user_id, role, area_id) values
  ('00000000-0000-0000-0000-0000000005a5', 'lider_area', '00000000-0000-0000-0000-0000000005e1');

insert into public.people (id, full_name, email, profile_id) values
  ('00000000-0000-0000-0000-0000000005c1', 'Ana Luces',     null, null),                                     -- Creativos · Luces
  ('00000000-0000-0000-0000-0000000005c2', 'Beto Creativos', 'beto@b5.test', null),                          -- Creativos sin área
  ('00000000-0000-0000-0000-0000000005c3', 'Ciro Protocolo', null, null),                                    -- Protocolo
  ('00000000-0000-0000-0000-0000000005c4', 'Servidor A',     null, '00000000-0000-0000-0000-0000000005a6');  -- ya tiene cuenta
insert into public.team_members (person_id, ministry_id, area_id) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005e1'),
  ('00000000-0000-0000-0000-0000000005c2', '00000000-0000-0000-0000-0000000005d1', null),
  ('00000000-0000-0000-0000-0000000005c3', '00000000-0000-0000-0000-0000000005d2', null),
  ('00000000-0000-0000-0000-0000000005c4', '00000000-0000-0000-0000-0000000005d1', null);

create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.anonimo() returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claim.sub', '', true),
         set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create or replace function pg_temp.sistema() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create temp table tokens (nombre text primary key, token text);
grant all on tokens to authenticated, anon;

-- ── Quién puede invitar ─────────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-0000000005a4');
select ok(public.can_invite_person('00000000-0000-0000-0000-0000000005c2'), 'líder de departamento invita a su gente');
select ok(not public.can_invite_person('00000000-0000-0000-0000-0000000005c3'), 'líder de departamento no invita a otro departamento');
insert into tokens select 'beto', token from public.crear_invitacion('00000000-0000-0000-0000-0000000005c2', 'Beto@B5.test');
select is((select count(*)::int from public.account_invitations), 1, 'el líder ve la invitación que creó');
select is((select email from public.account_invitations), 'beto@b5.test', 'el correo se guarda normalizado');
select throws_ok($$ select public.crear_invitacion('00000000-0000-0000-0000-0000000005c3') $$,
  '42501', 'sin_permiso', 'no puede invitar fuera de su alcance');
select throws_ok($$ select public.crear_invitacion('00000000-0000-0000-0000-0000000005c4') $$,
  'P0001', 'ya_tiene_cuenta', 'no se invita a quien ya tiene cuenta');
select throws_ok($$ insert into public.account_invitations (person_id, token_hash) values ('00000000-0000-0000-0000-0000000005c2', 'x') $$,
  '42501', null, 'nadie inserta invitaciones a mano');

select pg_temp.como('00000000-0000-0000-0000-0000000005a5');
select ok(public.can_invite_person('00000000-0000-0000-0000-0000000005c1'), 'líder de área invita a su área');
select ok(not public.can_invite_person('00000000-0000-0000-0000-0000000005c2'), 'líder de área no invita al resto del departamento');
insert into tokens select 'ana', token from public.crear_invitacion('00000000-0000-0000-0000-0000000005c1');

select pg_temp.como('00000000-0000-0000-0000-0000000005a6');
select throws_ok($$ select public.crear_invitacion('00000000-0000-0000-0000-0000000005c1') $$,
  '42501', 'sin_permiso', 'un servidor sin servir.asignar no invita');
select is((select count(*)::int from public.account_invitations), 0, 'un servidor no ve invitaciones');

select pg_temp.como('00000000-0000-0000-0000-0000000005a2');
select ok(public.can_invite_person('00000000-0000-0000-0000-0000000005c3'), 'pastor de sede invita a cualquiera (servir.asignar global)');
insert into tokens select 'ciro1', token from public.crear_invitacion('00000000-0000-0000-0000-0000000005c3');
insert into tokens select 'ciro2', token from public.crear_invitacion('00000000-0000-0000-0000-0000000005c3');

-- ── Ver y aceptar ───────────────────────────────────────────────────────
select pg_temp.anonimo();
select is((select first_name || '|' || invited_by_name || '|' || status from public.ver_invitacion((select token from tokens where nombre = 'beto'))),
  'Beto|Lider Creativos|pendiente', 'sin sesión se ve el primer nombre, quién invita y el estado');
select is((select count(*)::int from public.ver_invitacion('token-que-no-existe')), 0, 'un token falso no devuelve nada');
select throws_ok($$ select public.aceptar_invitacion((select token from tokens where nombre = 'beto')) $$,
  '42501', null, 'sin sesión no se acepta');

-- Cuenta de Apple con correo oculto: se une por el token, no por el correo.
select pg_temp.como('00000000-0000-0000-0000-0000000005a7');
select is(public.aceptar_invitacion((select token from tokens where nombre = 'beto')),
  '00000000-0000-0000-0000-0000000005c2'::uuid, 'aceptar une la cuenta con la persona aunque el correo no coincida');
select is(public.current_person_id(), '00000000-0000-0000-0000-0000000005c2'::uuid, 'la cuenta ya es esa persona');
select throws_ok($$ select public.aceptar_invitacion((select token from tokens where nombre = 'ana')) $$,
  'P0001', 'cuenta_con_otra_persona', 'una cuenta no se une a dos personas');

select pg_temp.como('00000000-0000-0000-0000-0000000005a8');
select throws_ok($$ select public.aceptar_invitacion((select token from tokens where nombre = 'beto')) $$,
  'P0001', 'ya_usada', 'la invitación es de un solo uso');

-- Vencida y revocada
select pg_temp.sistema();
update public.account_invitations set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
 where person_id = '00000000-0000-0000-0000-0000000005c1';
select pg_temp.como('00000000-0000-0000-0000-0000000005a8');
select throws_ok($$ select public.aceptar_invitacion((select token from tokens where nombre = 'ana')) $$,
  'P0001', 'vencida', 'una invitación vencida no sirve');

select throws_ok($$ select public.aceptar_invitacion((select token from tokens where nombre = 'ciro1')) $$,
  'P0001', 'revocada', 'una invitación nueva revoca el enlace anterior');

-- ── Tablas y funciones cerradas ─────────────────────────────────────────
select throws_ok($$ select * from public.account_provider_tokens $$,
  '42501', null, 'nadie fuera de service_role lee los tokens de Apple');
select throws_ok($$ select public.eliminar_datos_personales('00000000-0000-0000-0000-0000000005a8') $$,
  '42501', null, 'borrar datos personales es solo de service_role');

select * from finish();
rollback;
