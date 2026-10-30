-- =====================================================================
-- Pruebas: despacho inmediato de notificaciones
-- (20261030100000_notificaciones_inmediatas.sql). Correr con:
-- npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- La llamada HTTP real no se hace en pruebas: se anota la petición que
-- recibiría el despachador.
create table public.prueba_llamadas (url text, headers jsonb);
create or replace function public.notificador_disparar()
returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.prueba_llamadas values ('notificador', '{}'::jsonb);
  return 1;
end;
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000b0a1', 'n1@test', 'authenticated', 'authenticated', '{"full_name":"Uno"}'),
  ('00000000-0000-0000-0000-00000000b0a2', 'n2@test', 'authenticated', 'authenticated', '{"full_name":"Dos"}');

select has_trigger('public', 'notifications', 'notifications_despachar_ya', 'Crear un aviso pide el despacho al instante');
select has_trigger('public', 'broadcasts', 'broadcasts_despachar_ya', 'Crear un envío pide el despacho al instante');

-- Un aviso: una llamada.
insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-00000000b0a1', 'prueba', 'Hola');
select is((select count(*)::int from public.prueba_llamadas), 1, 'Un aviso nuevo dispara una llamada al despachador');

-- Muchos avisos en la misma transacción: no más llamadas.
insert into public.notifications (user_id, kind, title)
select u, 'prueba', 'A todos' from unnest(array['00000000-0000-0000-0000-00000000b0a1'::uuid, '00000000-0000-0000-0000-00000000b0a2'::uuid]) u;
insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-00000000b0a2', 'prueba', 'Otro');
select is((select count(*)::int from public.prueba_llamadas), 1, 'En la misma transacción se pide una sola vez');

-- Otra transacción (simulada): vuelve a pedir.
select set_config('notificador.pedido', '', true);
insert into public.broadcasts (author_id, audience, title, body) values ('00000000-0000-0000-0000-00000000b0a1', 'todos', 'Aviso', 'Ya');
select is((select count(*)::int from public.prueba_llamadas), 2, 'Un envío a todos dispara la llamada al instante');

-- Si el despachador falla, el aviso se crea igual.
create or replace function public.notificador_disparar()
returns bigint language plpgsql as $$ begin raise exception 'sin red'; end; $$;
select set_config('notificador.pedido', '', true);
select lives_ok($$ insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-00000000b0a1', 'prueba', 'Igual') $$,
                'Si la llamada falla, el aviso se guarda igual (lo recoge pg_cron)');

select is((select schedule from cron.job where jobname = 'notificador'), '* * * * *', 'pg_cron queda de respaldo cada minuto');

select * from finish();
rollback;
