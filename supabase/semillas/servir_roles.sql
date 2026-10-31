-- =====================================================================
-- Datos de la organización: departamentos, áreas y roles de Servir
-- =====================================================================
-- Es dato, no esquema: se corre a mano en cada base (pruebas primero;
-- producción solo con permiso de Gian). Se puede correr varias veces:
-- solo crea lo que falta y no borra ni renombra nada.
-- Fuente: capturas de WorshipTools que pasó Gian el 31 oct.
-- =====================================================================

begin;

-- Departamentos que faltan.
insert into public.ministries (name, type)
select 'Servolución', 'departamento'
 where not exists (select 1 from public.ministries where name = 'Servolución' and type = 'departamento');

-- Áreas.
insert into public.areas (ministry_id, name)
select m.id, 'Bienvenido a RSG' from public.ministries m
 where m.name = 'Casa de Formación' and m.type = 'departamento'
on conflict (ministry_id, name) do nothing;

-- Roles de departamento (y de área cuando aplica), en orden.
with roles (depto, area, nombre, orden) as (values
  ('Casa de Formación', 'Bienvenido a RSG', 'Maestro', 1),
  ('Casa de Formación', 'Bienvenido a RSG', 'Monitor', 2),
  ('Casa de Formación', 'Bienvenido a RSG', 'Stand', 3),
  ('Casa de Formación', 'Bienvenido a RSG', 'Mi Casa desde Adentro', 4),
  ('Creativos', null, 'Cámara Principal', 1),
  ('Creativos', null, 'Apoyo de cámara', 2),
  ('Creativos', null, 'Pantalla', 3),
  ('Creativos', null, 'Transmisión', 4),
  ('Creativos', null, 'Host RSG Global', 5),
  ('Creativos', null, 'Redes Sociales', 6),
  ('Creativos', null, 'Luces', 7),
  ('Creativos', null, 'Host Instagram', 8),
  ('Creativos', null, 'Líder', 9),
  ('LMRSG', null, 'Líder', 1),
  ('LMRSG', null, 'Director Musical', 2),
  ('LMRSG', null, 'Voz', 3),
  ('LMRSG', null, 'Piano', 4),
  ('LMRSG', null, 'Guitarra Acústica', 5),
  ('LMRSG', null, 'Guitarra Eléctrica', 6),
  ('LMRSG', null, 'Bajo', 7),
  ('LMRSG', null, 'Batería', 8),
  ('LMRSG', null, 'Set de percusión', 9),
  ('Planeación', null, 'Líder encargado', 1),
  ('Planeación', null, 'Notas de la reunión', 2),
  ('Protocolo', null, 'Acomodador', 1),
  ('Protocolo', null, 'Lobby', 2),
  ('Protocolo', null, 'Merienda', 3),
  ('Protocolo', null, 'Información', 4),
  ('Protocolo', null, 'Líder', 5),
  ('Protocolo', null, 'Montaje y adecuación', 6),
  ('Roadies', null, 'Montaje', 1),
  ('Roadies', null, 'Ecualización', 2),
  ('Roadies', null, 'Asistencia y detalles', 3),
  ('Semillas', null, 'Maestro(a) Junior', 1),
  ('Semillas', null, 'Maestro(a) babys', 2),
  ('Semillas', null, 'Maestro(a) temario junior', 3),
  ('Semillas', null, 'Coordinador', 4),
  ('Semillas', null, 'Aux baby', 5),
  ('Semillas', null, 'Maestro(a) temario babys', 6),
  ('Servolución', null, 'Gracia para cada día', 1),
  ('Servolución', null, 'Tienda Servolución', 2),
  ('Servolución', null, 'Líder', 3),
  ('Servolución', null, 'Coordinador de proyecto', 4),
  ('Servolución', null, 'Monitor', 5),
  ('Servolución', null, 'Gestor de hidratación', 6)
)
insert into public.positions (ministry_id, area_id, name, sort)
select m.id, a.id, r.nombre, r.orden
  from roles r
  join public.ministries m on m.name = r.depto and m.type = 'departamento'
  left join public.areas a on a.ministry_id = m.id and a.name = r.area
 where (r.area is null or a.id is not null)
   -- Sin duplicar por mayúsculas o tildes de más ("Director musical").
   and not exists (select 1 from public.positions p where p.ministry_id = m.id and lower(p.name) = lower(r.nombre));

-- Roles generales (sin departamento), agrupados. Los asigna Planeación.
with generales (grupo, nombre, orden) as (values
  ('Escenario', 'Predicador Jornada 1', 1),
  ('Escenario', 'Predicador Jornada 2', 2),
  ('Escenario', 'Anuncios Jornada 1', 3),
  ('Escenario', 'Anuncios Jornada 2', 4),
  ('Escenario', 'Oración Jornada 1', 5),
  ('Escenario', 'Oración Jornada 2', 6),
  ('Escenario', 'Santa Cena', 7)
)
insert into public.positions (ministry_id, name, grupo, sort)
select null, g.nombre, g.grupo, g.orden from generales g
 where not exists (select 1 from public.positions p where p.ministry_id is null and lower(p.name) = lower(g.nombre));

-- Los generales que ya existían quedan en su grupo.
update public.positions set grupo = 'VIO' where ministry_id is null and grupo is null and name ilike 'VIO%';
update public.positions set grupo = 'Escenario' where ministry_id is null and grupo is null and name in ('Escenario', 'Predicador');

commit;
