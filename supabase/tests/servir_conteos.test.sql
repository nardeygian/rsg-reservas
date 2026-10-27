-- Reglas de conteo de servicio (01-reglas-que-no-se-rompen.md, Servicio).
begin;
select plan(5);

-- La base local puede tener datos migrados; la prueba parte de tablas vacías
-- (todo se deshace con el rollback del final).
truncate public.meetings, public.people, public.discipleship_groups cascade;

insert into public.people (id, full_name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Persona Conteo');

insert into public.meetings (id, name, meeting_date, kind) values
  ('00000000-0000-0000-0000-0000000000d1', 'Reunión Central 9am',  '2026-09-06', 'ministerio'),
  ('00000000-0000-0000-0000-0000000000d2', 'Reunion central 11am', '2026-09-06', 'ministerio'),
  ('00000000-0000-0000-0000-0000000000d3', 'Mega Jóvenes',         '2026-09-05', 'ministerio'),
  ('00000000-0000-0000-0000-0000000000d4', 'Semilleros',           '2026-09-05', 'servolucion'),
  ('00000000-0000-0000-0000-0000000000d5', 'Mujeres',              '2026-09-12', 'ministerio'),
  ('00000000-0000-0000-0000-0000000000d6', 'Hombres',              '2026-09-19', 'ministerio');

update public.meetings set status = 'cancelada' where id = '00000000-0000-0000-0000-0000000000d6';

insert into public.attendance (meeting_id, person_id, status, roles) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'asistio', '{Cámaras,Luces}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'tarde',   '{Cámaras}'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', 'asistio', '{Sonido}'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 'asistio', '{Logística}'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', 'ausente', '{Ujier}'),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000c1', 'asistio', '{Ujier}');

select is(
  (select count(*)::int from public.service_units
    where person_id = '00000000-0000-0000-0000-0000000000c1' and unit_key like 'central|%'),
  1, 'Dos Reuniones Centrales el mismo día cuentan como una');

select is(
  (select count(*)::int from public.service_units
    where person_id = '00000000-0000-0000-0000-0000000000c1' and counting = 'min'),
  2, 'Ministerio: la central del día y Mega Jóvenes (varios roles = un servicio)');

select is(
  (select count(*)::int from public.service_units
    where person_id = '00000000-0000-0000-0000-0000000000c1' and counting = 'serv'),
  1, 'Servolución se cuenta aparte');

select is(
  (select count(*)::int from public.service_units
    where meeting_id = '00000000-0000-0000-0000-0000000000d5'),
  0, 'Ausente no cuenta como servicio');

select is(
  (select count(*)::int from public.service_units
    where meeting_id = '00000000-0000-0000-0000-0000000000d6'),
  0, 'Una reunión cancelada no cuenta');

select * from finish();
rollback;
