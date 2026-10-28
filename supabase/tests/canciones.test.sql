-- =====================================================================
-- B2 · Canciones: acceso por permiso (tabla y bucket) y último uso.
-- Correr con:  npx supabase test db
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000b201', 'canciones.editor@test', 'authenticated', 'authenticated', '{"full_name":"Editor"}'),
  ('00000000-0000-0000-0000-00000000b202', 'canciones.lector@test', 'authenticated', 'authenticated', '{"full_name":"Lector"}');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000b201', 'servidor_planeacion');

insert into public.songs (id, title, lyrics) values
  ('00000000-0000-0000-0000-00000000b2a1', 'Canción de prueba', E'[Verso 1]\nUno\n[Coro]\nDos');

create or replace function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claim.sub', p_uid, true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ── Sin canciones.editar ─────────────────────────────────────────────
select pg_temp.como('00000000-0000-0000-0000-00000000b202');
select is((select title from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), 'Canción de prueba',
          'Cualquier autenticado lee canciones');
select throws_ok($$ insert into public.songs (title) values ('X') $$, '42501', null,
          'Sin canciones.editar no se crean canciones');
update public.songs set title = 'Cambiada' where id = '00000000-0000-0000-0000-00000000b2a1';
select is((select title from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), 'Canción de prueba',
          'Sin canciones.editar no se editan canciones');
delete from public.songs where id = '00000000-0000-0000-0000-00000000b2a1';
select is((select count(*) from public.songs where id = '00000000-0000-0000-0000-00000000b2a1')::int, 1,
          'Sin canciones.editar no se borran canciones');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('songs', '00000000-0000-0000-0000-00000000b2a1/x.txt') $$,
          '42501', null, 'Sin canciones.editar no se suben archivos al bucket songs');

-- ── Con canciones.editar (servidor_planeacion) ───────────────────────
select pg_temp.como('00000000-0000-0000-0000-00000000b201');
select lives_ok($$ insert into public.songs (id, title) values ('00000000-0000-0000-0000-00000000b2a2', 'Nueva') $$,
          'Con canciones.editar se crean canciones');
update public.songs set bpm = 72 where id = '00000000-0000-0000-0000-00000000b2a1';
select is((select bpm from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), 72,
          'Con canciones.editar se editan canciones');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('songs', '00000000-0000-0000-0000-00000000b2a1/x.txt') $$,
          'Con canciones.editar se suben archivos al bucket songs');

-- El lector sí puede leer (descargar) el archivo
select pg_temp.como('00000000-0000-0000-0000-00000000b202');
select is((select count(*) from storage.objects where bucket_id = 'songs' and name = '00000000-0000-0000-0000-00000000b2a1/x.txt')::int, 1,
          'Cualquier autenticado ve los archivos de canciones');

-- ── Último uso ───────────────────────────────────────────────────────
reset role;
insert into public.meetings (id, name, meeting_date, status) values
  ('00000000-0000-0000-0000-00000000b2f1', 'Domingo A', '2026-11-01', 'publicada'),
  ('00000000-0000-0000-0000-00000000b2f2', 'Domingo B', '2026-11-08', 'borrador');
insert into public.run_items (meeting_id, sort, kind, title, song_id) values
  ('00000000-0000-0000-0000-00000000b2f1', 0, 'cancion', 'Canción', '00000000-0000-0000-0000-00000000b2a1'),
  ('00000000-0000-0000-0000-00000000b2f2', 0, 'cancion', 'Canción', '00000000-0000-0000-0000-00000000b2a1');
select is((select last_used_on from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), '2026-11-01'::date,
          'last_used_on toma la reunión publicada, no el borrador');

update public.meetings set status = 'publicada' where id = '00000000-0000-0000-0000-00000000b2f2';
select is((select last_used_on from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), '2026-11-08'::date,
          'Al publicar otra reunión, last_used_on avanza');

update public.meetings set status = 'cancelada' where id = '00000000-0000-0000-0000-00000000b2f2';
select is((select last_used_on from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), '2026-11-01'::date,
          'Al cancelar, last_used_on vuelve a la anterior');

delete from public.run_items where meeting_id = '00000000-0000-0000-0000-00000000b2f1';
select is((select last_used_on from public.songs where id = '00000000-0000-0000-0000-00000000b2a1'), null::date,
          'Sin reuniones, last_used_on queda vacío');

select * from finish();
rollback;
