-- =====================================================================
-- Etapa 5 · Servir — tipos de reunión iniciales y vista de conteos
-- =====================================================================
-- Tipos sacados de las 119 reuniones existentes (plan, sección 3.1).
-- asana_rules: { keywords: [...], sections: [...] } — el clasificador
-- (lib/servir/clasificar.ts) compara sin tildes ni mayúsculas: un tipo
-- aplica si alguna palabra clave aparece en el nombre y, si tiene
-- secciones, la sección coincide. Un tipo sin palabras clave aplica solo
-- por sección (respaldo). Se prueba en orden de `sort`.
-- =====================================================================

insert into public.meeting_types (name, ministry_id, counting, kind, usual_weekday, sort, asana_rules)
select t.name, m.id, t.counting, t.kind, t.weekday, t.sort, t.rules::jsonb
from (values
  ('Reunión Central',          null,                    'min',  'ministerio',  0, 10, '{"keywords":["reunion central"]}'),
  ('Jóvenes · Reunión semanal','Jóvenes',               'min',  'ministerio',  3, 20, '{"keywords":["reunion semanal","reunion jovenes"]}'),
  ('Mega Jóvenes',             'Jóvenes',               'min',  'ministerio',  6, 30, '{"keywords":["mega jovenes"]}'),
  ('Mujeres',                  'Mujeres',               'min',  'ministerio',  6, 40, '{"keywords":["mujeres"]}'),
  ('Hombres',                  'Hombres',               'min',  'ministerio',  6, 50, '{"keywords":["hombres"]}'),
  ('Mayores con Propósito',    'Mayores con Propósito', 'min',  'ministerio',  6, 60, '{"keywords":["mayores con proposito"]}'),
  ('Sesiones de Vida',         'Sesiones de Vida',      'min',  'ministerio',  6, 70, '{"keywords":["sesiones de vida"]}'),
  ('Cursos Formativos',        'Casa de Formación',     'min',  'ministerio',  2, 80, '{"keywords":["cursos formativos","curso formativo"]}'),
  ('Estudio Bíblico',          'Casa de Formación',     'min',  'ministerio',  4, 90, '{"keywords":["estudio biblico"]}'),
  ('Entrenamiento Roadies',    'Roadies',               'min',  'ministerio',  1, 100, '{"keywords":["roadies"]}'),
  ('Semilleros',               null,                    'serv', 'servolucion', 6, 110, '{"keywords":["semilleros"]}'),
  ('Lazos de Amor',            null,                    'serv', 'servolucion', 6, 120, '{"keywords":["lazos de amor"]}'),
  ('Corazón y Visión',         null,                    'min',  'evento',      3, 130, '{"keywords":["corazon y vision"]}'),
  ('Bautizos',                 null,                    'min',  'evento',      0, 140, '{"keywords":["bautizo","bautismo"]}'),
  -- Respaldos por sección (sin palabras clave): al final
  ('Jornada de Servolución',   null,                    'serv', 'servolucion', null, 900, '{"sections":["servolucion"]}'),
  ('Evento especial',          null,                    'min',  'evento',      null, 910, '{"sections":["evento rsg","eventos"]}')
) as t(name, ministry_name, counting, kind, weekday, sort, rules)
left join public.ministries m on m.name = t.ministry_name
on conflict (name) do nothing;

-- ── Conteo de servicios ─────────────────────────────────────────────────
-- Reglas de 01-reglas-que-no-se-rompen.md (sección Servicio, Conteo):
-- * Varios roles en una misma reunión = un servicio (una fila de
--   attendance por persona y reunión ya lo garantiza).
-- * Las Reuniones Centrales de un mismo día cuentan como una: unidad
--   'central|fecha' si el nombre contiene "reunion central"; si no, 'r|id'.
-- * Tipo: 'serv' si la reunión es de Servolución, si no 'min'. Ministerio y
--   Servolución se cuentan por separado.
-- * Ausente: queda registrado pero no cuenta como servicio.
create or replace view public.service_units
with (security_invoker = true) as
select distinct on (a.person_id, unit_key)
       a.person_id,
       m.meeting_date,
       case when m.kind = 'servolucion' then 'serv' else 'min' end as counting,
       unit_key,
       m.id as meeting_id,
       m.meeting_type_id
  from public.attendance a
  join public.meetings m on m.id = a.meeting_id
  cross join lateral (
    select case
             when lower(translate(m.name, 'ÁÉÍÓÚáéíóúÜüÑñ', 'AEIOUaeiouUuNn')) like '%reunion central%'
               then 'central|' || m.meeting_date::text
             else 'r|' || m.id::text
           end as unit_key
  ) u
 where a.status <> 'ausente'
   and m.status <> 'cancelada'
 order by a.person_id, unit_key, m.meeting_date;

grant select on public.service_units to authenticated;
revoke all on public.service_units from anon;
grant select on public.service_units to service_role;
