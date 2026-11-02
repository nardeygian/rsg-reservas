-- =====================================================================
-- Etapa 5 · Servir — C3 Estadísticas y salud del servidor
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (sección 3.2, frente C3).
--
-- * servir_ajustes: umbrales del semáforo. Valores de Gian (28 oct):
--   3 servicios en 30 días ya es mucho (sobrecargado) y 1 es poco
--   (alejándose); inactivo tras 6 semanas sin servir. Planeación los ajusta.
-- * salud_servidor_mensual: vista materializada por persona y mes, que
--   pg_cron refresca cada noche. No tiene RLS, así que nadie la lee directo:
--   se lee con salud_mensual(), que filtra con can_see_person_stats().
-- * salud_servidores(): el semáforo de hoy por persona (en vivo sobre
--   service_units), solo para las personas que el usuario puede ver.
-- * estadisticas_reuniones(): una fila por reunión del periodo con
--   cobertura, respuesta, asistencia, checklist y duración real; las
--   cifras de asignaciones solo cuentan las de su alcance.
-- * ficha_servidor(): historial completo de una persona.
-- Los conteos de servicio salen de service_units (reglas de
-- 01-reglas-que-no-se-rompen.md). Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Umbrales ─────────────────────────────────────────────────────────

create table if not exists public.servir_ajustes (
  id                   boolean primary key default true check (id),
  sobrecargado_desde   int not null default 3 check (sobrecargado_desde > 0),   -- servicios en la ventana
  alejandose_hasta     int not null default 1 check (alejandose_hasta >= 0),    -- servicios en la ventana
  inactivo_semanas     int not null default 6 check (inactivo_semanas > 0),
  ventana_dias         int not null default 30 check (ventana_dias between 7 and 120),
  updated_by           uuid references public.profiles(id) on delete set null,
  updated_at           timestamptz not null default now(),
  check (alejandose_hasta < sobrecargado_desde)
);

insert into public.servir_ajustes (id) values (true) on conflict do nothing;

alter table public.servir_ajustes enable row level security;

drop policy if exists "servir_ajustes: lectura" on public.servir_ajustes;
create policy "servir_ajustes: lectura" on public.servir_ajustes for select to authenticated using (true);
drop policy if exists "servir_ajustes: editar" on public.servir_ajustes;
create policy "servir_ajustes: editar" on public.servir_ajustes for update to authenticated
  using ((select public.has_global_permission('servir.planear')))
  with check ((select public.has_global_permission('servir.planear')));

revoke all on public.servir_ajustes from anon, authenticated;
grant select on public.servir_ajustes to authenticated;
grant update (sobrecargado_desde, alejandose_hasta, inactivo_semanas, ventana_dias, updated_by, updated_at)
  on public.servir_ajustes to authenticated;
grant all on public.servir_ajustes to service_role;

drop trigger if exists servir_ajustes_updated_at on public.servir_ajustes;
create trigger servir_ajustes_updated_at before update on public.servir_ajustes
  for each row execute function public.set_updated_at();

-- ── 2. Vista materializada mensual ──────────────────────────────────────

drop function if exists public.salud_mensual(uuid, int);
drop materialized view if exists public.salud_servidor_mensual;
create materialized view public.salud_servidor_mensual as
with meses as (
  select su.person_id, date_trunc('month', su.meeting_date)::date as mes,
         count(*) as servicios,
         count(*) filter (where su.counting = 'min') as min,
         count(*) filter (where su.counting = 'serv') as serv,
         max(su.meeting_date) as ultima_fecha
    from public.service_units su
   group by 1, 2
),
asis as (
  select at.person_id, date_trunc('month', m.meeting_date)::date as mes,
         count(*) filter (where at.status = 'ausente') as ausencias,
         count(*) filter (where at.status = 'tarde') as tardes
    from public.attendance at
    join public.meetings m on m.id = at.meeting_id
   where m.status <> 'cancelada'
   group by 1, 2
),
asig as (
  select a.person_id, date_trunc('month', m.meeting_date)::date as mes,
         count(*) as asignaciones,
         count(*) filter (where a.status = 'aceptada') as aceptadas,
         count(*) filter (where a.status = 'rechazada') as rechazadas,
         count(*) filter (where a.status = 'pendiente') as pendientes,
         avg(extract(epoch from a.responded_at - a.created_at) / 3600.0)
           filter (where a.responded_at is not null) as horas_respuesta
    from public.assignments a
    join public.meetings m on m.id = a.meeting_id
   where m.status <> 'cancelada' and a.status <> 'cancelada'
   group by 1, 2
),
chk as (
  select a.person_id, date_trunc('month', m.meeting_date)::date as mes,
         count(ci.id) filter (where ci.done_at is not null) as checklist_hechos,
         count(ci.id) as checklist_total
    from public.checklist_items ci
    join public.assignments a on a.id = ci.assignment_id
    join public.meetings m on m.id = a.meeting_id
   where m.status <> 'cancelada'
   group by 1, 2
),
llaves as (
  select person_id, mes from meses union select person_id, mes from asis
  union select person_id, mes from asig union select person_id, mes from chk
)
select k.person_id, k.mes,
       coalesce(me.servicios, 0)::int as servicios,
       coalesce(me.min, 0)::int as min,
       coalesce(me.serv, 0)::int as serv,
       me.ultima_fecha,
       coalesce(asis.ausencias, 0)::int as ausencias,
       coalesce(asis.tardes, 0)::int as tardes,
       coalesce(asig.asignaciones, 0)::int as asignaciones,
       coalesce(asig.aceptadas, 0)::int as aceptadas,
       coalesce(asig.rechazadas, 0)::int as rechazadas,
       coalesce(asig.pendientes, 0)::int as pendientes,
       round(asig.horas_respuesta::numeric, 1) as horas_respuesta,
       coalesce(chk.checklist_hechos, 0)::int as checklist_hechos,
       coalesce(chk.checklist_total, 0)::int as checklist_total
  from llaves k
  left join meses me on me.person_id = k.person_id and me.mes = k.mes
  left join asis on asis.person_id = k.person_id and asis.mes = k.mes
  left join asig on asig.person_id = k.person_id and asig.mes = k.mes
  left join chk on chk.person_id = k.person_id and chk.mes = k.mes;

create unique index if not exists salud_servidor_mensual_pk on public.salud_servidor_mensual (person_id, mes);

revoke all on public.salud_servidor_mensual from public, anon, authenticated;
grant select on public.salud_servidor_mensual to service_role;

-- Refresco nocturno: 1:20 a. m. en Bogotá (06:20 UTC).
create or replace function public.refrescar_salud_servidor()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  refresh materialized view concurrently public.salud_servidor_mensual;
end;
$$;
revoke all on function public.refrescar_salud_servidor() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('salud-servidor') where exists (select 1 from cron.job where jobname = 'salud-servidor');
  perform cron.schedule('salud-servidor', '20 6 * * *', 'select public.refrescar_salud_servidor()');
end $$;

-- Historial mensual de las personas que el usuario puede ver.
create or replace function public.salud_mensual(p_person_id uuid default null, p_meses int default 6)
returns setof public.salud_servidor_mensual
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.*
    from public.salud_servidor_mensual s
   where (p_person_id is null or s.person_id = p_person_id)
     and s.mes >= (date_trunc('month', (now() at time zone 'America/Bogota')::date)
                   - make_interval(months => greatest(p_meses, 1) - 1))::date
     and public.can_see_person_stats(s.person_id)
   order by s.person_id, s.mes;
$$;

-- ── 3. Semáforo de hoy ──────────────────────────────────────────────────

-- ¿Puede ver estadísticas de alguien? (para mostrar el tablero)
create or replace function public.puede_ver_estadisticas()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('servir.estadisticas') or public.has_permission('servir.ver_todo');
$$;

-- Personas del alcance: miembros activos de un equipo, o quien sirvió en
-- los últimos 6 meses. p_ministry_id filtra por departamento.
create or replace function public.salud_servidores(p_ministry_id uuid default null)
returns table (
  person_id         uuid,
  full_name         text,
  departamentos     text[],
  servicios_ventana int,
  min_ventana       int,
  serv_ventana      int,
  ausencias_ventana int,
  tardes_ventana    int,
  rechazos_60       int,
  respuestas_60     int,
  promedio_3m       numeric,
  ultima_fecha      date,
  racha_semanas     int,
  semaforo          text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with aj as (select * from public.servir_ajustes where id),
  hoy as (select (now() at time zone 'America/Bogota')::date as d),
  gente as (
    select p.id, p.full_name
      from public.people p
     where p.active
       and public.puede_ver_estadisticas()
       and public.can_see_person_stats(p.id)
       and (exists (select 1 from public.team_members tm where tm.person_id = p.id and tm.active
                     and (p_ministry_id is null or tm.ministry_id = p_ministry_id))
            or (p_ministry_id is null and exists (
                  select 1 from public.service_units su, hoy
                   where su.person_id = p.id and su.meeting_date > hoy.d - 183)))
  ),
  uni as (
    select su.person_id, su.meeting_date, su.counting
      from public.service_units su join gente g on g.id = su.person_id, hoy
     where su.meeting_date <= hoy.d
  ),
  sv as (
    select g.id as person_id,
           count(u.*) filter (where u.meeting_date > hoy.d - aj.ventana_dias) as total,
           count(u.*) filter (where u.meeting_date > hoy.d - aj.ventana_dias and u.counting = 'min') as min,
           count(u.*) filter (where u.meeting_date > hoy.d - aj.ventana_dias and u.counting = 'serv') as serv,
           count(u.*) filter (where u.meeting_date > hoy.d - aj.ventana_dias - 90
                                and u.meeting_date <= hoy.d - aj.ventana_dias) / 3.0 as prom3,
           max(u.meeting_date) as ultima
      from gente g cross join aj cross join hoy
      left join uni u on u.person_id = g.id
     group by g.id
  ),
  -- Racha: semanas seguidas (hasta la actual o la anterior) con al menos un servicio.
  semanas as (
    select distinct u.person_id, date_trunc('week', u.meeting_date)::date as w from uni u
  ),
  racha as (
    select s.person_id, count(*)::int as n
      from (
        select person_id, w,
               w + (row_number() over (partition by person_id order by w desc) * 7)::int as grp,
               first_value(w) over (partition by person_id order by w desc) as ultima_w
          from semanas
      ) s, hoy
     where s.ultima_w >= date_trunc('week', hoy.d)::date - 7
     group by s.person_id, s.grp, s.ultima_w
    having max(s.w) = s.ultima_w
  ),
  asis as (
    select at.person_id,
           count(*) filter (where at.status = 'ausente') as ausencias,
           count(*) filter (where at.status = 'tarde') as tardes
      from public.attendance at
      join public.meetings m on m.id = at.meeting_id
      join gente g on g.id = at.person_id
      cross join aj cross join hoy
     where m.status <> 'cancelada' and m.meeting_date > hoy.d - aj.ventana_dias and m.meeting_date <= hoy.d
     group by at.person_id
  ),
  resp as (
    select a.person_id,
           count(*) filter (where a.status = 'rechazada') as rechazos,
           count(*) filter (where a.status in ('aceptada', 'rechazada')) as respuestas
      from public.assignments a
      join gente g on g.id = a.person_id
     where a.responded_at > now() - interval '60 days'
     group by a.person_id
  ),
  deps as (
    select tm.person_id, array_agg(distinct mi.name order by mi.name) as nombres
      from public.team_members tm join public.ministries mi on mi.id = tm.ministry_id
     where tm.active
     group by tm.person_id
  )
  select g.id, g.full_name, coalesce(deps.nombres, '{}'),
         sv.total::int, sv.min::int, sv.serv::int,
         coalesce(asis.ausencias, 0)::int, coalesce(asis.tardes, 0)::int,
         coalesce(resp.rechazos, 0)::int, coalesce(resp.respuestas, 0)::int,
         round(sv.prom3, 1), sv.ultima, coalesce(racha.n, 0),
         case
           when sv.ultima is null or sv.ultima <= hoy.d - aj.inactivo_semanas * 7 then 'inactivo'
           when sv.total >= aj.sobrecargado_desde then 'sobrecargado'
           when sv.total <= aj.alejandose_hasta
             or (coalesce(resp.respuestas, 0) >= 2 and resp.rechazos * 2 >= resp.respuestas) then 'alejandose'
           else 'sano'
         end
    from gente g
    join sv on sv.person_id = g.id
    cross join aj cross join hoy
    left join racha on racha.person_id = g.id
    left join asis on asis.person_id = g.id
    left join resp on resp.person_id = g.id
    left join deps on deps.person_id = g.id
   order by g.full_name;
$$;

-- ── 4. Reuniones ────────────────────────────────────────────────────────

-- Una fila por reunión del periodo (por fecha en que se hizo o se iba a
-- hacer). Las cifras de asignaciones, asistencia y checklist solo cuentan
-- las personas que el usuario puede ver; las de la reunión (estado,
-- reprogramaciones, duración) son de la reunión.
create or replace function public.estadisticas_reuniones(
  p_desde date, p_hasta date, p_meeting_type_id uuid default null, p_ministry_id uuid default null
)
returns table (
  meeting_id        uuid,
  name              text,
  meeting_date      date,
  status            text,
  meeting_type_id   uuid,
  tipo              text,
  color             text,
  reprogramaciones  int,
  motivo_cancelacion text,
  requeridas        int,
  asignadas         int,
  aceptadas         int,
  rechazadas        int,
  pendientes        int,
  horas_respuesta   numeric,
  asistio           int,
  tarde             int,
  ausente           int,
  checklist_hechos  int,
  checklist_total   int,
  duracion_plan_seg int,
  duracion_real_seg int
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with reus as (
    select m.*
      from public.meetings m
     where public.puede_ver_estadisticas()
       and m.meeting_date between p_desde and p_hasta
       and m.status <> 'borrador'
       and (p_meeting_type_id is null or m.meeting_type_id = p_meeting_type_id)
       and (public.can_see_meeting(m.id)
            or (m.ministry_id is not null and public.has_permission('servir.estadisticas', 'ministerio', m.ministry_id::text))
            or exists (select 1 from public.assignments a where a.meeting_id = m.id and public.can_see_person_stats(a.person_id)))
  ),
  asig as (
    select a.*
      from public.assignments a join reus r on r.id = a.meeting_id
     where a.status <> 'cancelada'
       and (p_ministry_id is null or a.ministry_id = p_ministry_id)
       and (public.has_global_permission('servir.estadisticas') or public.has_permission('servir.ver_todo')
            or public.can_see_person_stats(a.person_id)
            or (r.ministry_id is not null and public.has_permission('servir.estadisticas', 'ministerio', r.ministry_id::text)))
  )
  select r.id, r.name, r.meeting_date, r.status, r.meeting_type_id, t.name, t.color,
         (select count(*)::int from public.meeting_changes mc where mc.meeting_id = r.id and mc.change = 'reprogramada'),
         (select mc.reason from public.meeting_changes mc where mc.meeting_id = r.id and mc.change = 'cancelada'
           order by mc.created_at desc limit 1),
         coalesce((select sum((x ->> 'count')::int)::int
                     from public.meeting_templates mt, jsonb_array_elements(mt.required_positions) x
                     join public.positions po on po.id = (x ->> 'position_id')::uuid
                    where mt.id = r.template_id and (p_ministry_id is null or po.ministry_id = p_ministry_id)), 0),
         (select count(*)::int from asig a where a.meeting_id = r.id),
         (select count(*)::int from asig a where a.meeting_id = r.id and a.status = 'aceptada'),
         (select count(*)::int from asig a where a.meeting_id = r.id and a.status = 'rechazada'),
         (select count(*)::int from asig a where a.meeting_id = r.id and a.status = 'pendiente'),
         (select round(avg(extract(epoch from a.responded_at - a.created_at) / 3600.0)::numeric, 1)
            from asig a where a.meeting_id = r.id and a.responded_at is not null),
         (select count(*)::int from public.attendance at where at.meeting_id = r.id and at.status = 'asistio'
             and exists (select 1 from asig a where a.meeting_id = r.id and a.person_id = at.person_id)),
         (select count(*)::int from public.attendance at where at.meeting_id = r.id and at.status = 'tarde'
             and exists (select 1 from asig a where a.meeting_id = r.id and a.person_id = at.person_id)),
         (select count(*)::int from public.attendance at where at.meeting_id = r.id and at.status = 'ausente'
             and exists (select 1 from asig a where a.meeting_id = r.id and a.person_id = at.person_id)),
         (select count(*)::int from public.checklist_items ci join asig a on a.id = ci.assignment_id
           where a.meeting_id = r.id and ci.done_at is not null),
         (select count(*)::int from public.checklist_items ci join asig a on a.id = ci.assignment_id
           where a.meeting_id = r.id),
         (select coalesce(sum(ri.duration_sec), 0)::int from public.run_items ri where ri.meeting_id = r.id),
         case when r.actual_start is not null and r.actual_end is not null
              then extract(epoch from r.actual_end - r.actual_start)::int end
    from reus r
    left join public.meeting_types t on t.id = r.meeting_type_id
   order by r.meeting_date, r.name;
$$;

-- ── 5. Ficha del servidor ───────────────────────────────────────────────

create or replace function public.ficha_servidor(p_person_id uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case when not coalesce(public.can_see_person_stats(p_person_id), false) then null else
    jsonb_build_object(
      'persona', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'notes', p.notes,
                                            'discipulado', g.name, 'tiene_cuenta', p.profile_id is not null)
                    from public.people p left join public.discipleship_groups g on g.id = p.discipleship_group_id
                   where p.id = p_person_id),
      'equipos', coalesce((select jsonb_agg(jsonb_build_object('departamento', mi.name, 'area', ar.name) order by mi.name)
                             from public.team_members tm
                             join public.ministries mi on mi.id = tm.ministry_id
                             left join public.areas ar on ar.id = tm.area_id
                            where tm.person_id = p_person_id and tm.active), '[]'),
      'posiciones', coalesce((select jsonb_agg(po.name order by po.name)
                                from public.person_positions pp join public.positions po on po.id = pp.position_id
                               where pp.person_id = p_person_id), '[]'),
      'bloqueos', coalesce((select jsonb_agg(jsonb_build_object('desde', b.starts_on, 'hasta', b.ends_on, 'motivo', b.reason) order by b.starts_on)
                              from public.availability_blocks b
                             where b.person_id = p_person_id and b.ends_on >= (now() at time zone 'America/Bogota')::date), '[]'),
      'historial', coalesce((
        select jsonb_agg(h order by h ->> 'fecha' desc)
          from (
            select jsonb_build_object(
                     'meeting_id', m.id, 'fecha', m.meeting_date, 'reunion', m.name, 'tipo', t.name,
                     'estado_reunion', m.status,
                     'posiciones', (select array_agg(po.name order by po.name) from public.assignments a2
                                     join public.positions po on po.id = a2.position_id
                                    where a2.meeting_id = m.id and a2.person_id = p_person_id and a2.status <> 'cancelada'),
                     'respuesta', (select case when bool_or(a2.status = 'aceptada') then 'aceptada'
                                               when bool_or(a2.status = 'rechazada') then 'rechazada'
                                               when bool_or(a2.status = 'pendiente') then 'pendiente' end
                                     from public.assignments a2
                                    where a2.meeting_id = m.id and a2.person_id = p_person_id and a2.status <> 'cancelada'),
                     'motivo_rechazo', (select string_agg(a2.decline_reason, '; ') from public.assignments a2
                                         where a2.meeting_id = m.id and a2.person_id = p_person_id and a2.decline_reason is not null),
                     'asistencia', at.status,
                     'roles_listado', at.roles,
                     'checklist_hechos', (select count(*) from public.checklist_items ci join public.assignments a2 on a2.id = ci.assignment_id
                                           where a2.meeting_id = m.id and a2.person_id = p_person_id and ci.done_at is not null),
                     'checklist_total', (select count(*) from public.checklist_items ci join public.assignments a2 on a2.id = ci.assignment_id
                                          where a2.meeting_id = m.id and a2.person_id = p_person_id)
                   ) as h
              from public.meetings m
              left join public.meeting_types t on t.id = m.meeting_type_id
              left join public.attendance at on at.meeting_id = m.id and at.person_id = p_person_id
             where m.status <> 'borrador'
               and (at.id is not null or exists (select 1 from public.assignments a
                                                  where a.meeting_id = m.id and a.person_id = p_person_id and a.status <> 'cancelada'))
             order by m.meeting_date desc
             limit 200
          ) x), '[]')
    )
  end;
$$;

revoke all on function public.salud_mensual(uuid, int)                         from public, anon;
revoke all on function public.puede_ver_estadisticas()                          from public, anon;
revoke all on function public.salud_servidores(uuid)                            from public, anon;
revoke all on function public.estadisticas_reuniones(date, date, uuid, uuid)    from public, anon;
revoke all on function public.ficha_servidor(uuid)                              from public, anon;
grant execute on function public.salud_mensual(uuid, int)                      to authenticated;
grant execute on function public.puede_ver_estadisticas()                       to authenticated;
grant execute on function public.salud_servidores(uuid)                         to authenticated;
grant execute on function public.estadisticas_reuniones(date, date, uuid, uuid) to authenticated;
grant execute on function public.ficha_servidor(uuid)                           to authenticated;
