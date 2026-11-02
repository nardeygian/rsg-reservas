-- =====================================================================
-- Etapa 5 · Servir — C1 En vivo y asistencia
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (secciones 4.5, 4.6 y 7, frente C1).
--
-- * iniciar_reunion / avanzar_item / terminar_reunion (servir.vivo):
--   estado en_vivo → cerrada, ítem actual y tiempos reales del orden.
-- * asistencia_sugerida: lista para confirmar, prellenada con "asistió"
--   para quien completó su checklist.
-- * confirmar_asistencia: Planeación (servir.asistencia) confirma a
--   cualquiera y cierra; el líder de departamento confirma a su gente
--   mientras la asistencia no esté cerrada (decisión de Gian).
-- * Realtime: reuniones, orden, asignaciones, checklist y asistencia. RLS
--   sigue decidiendo qué le llega a cada uno.
-- * Arreglo: en Supabase las tablas nuevas de public ya traen todos los
--   permisos para authenticated, así que los "grant update (read_at)" de
--   la Fase A no restringían nada. Se quitan los permisos de más.
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── 0. Permisos de tabla que la Fase A quería limitar ───────────────────
revoke insert, update, delete, truncate on public.notifications   from authenticated;
revoke insert, update, delete, truncate on public.checklist_items from authenticated;
grant select on public.notifications, public.checklist_items to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ── 1. Conducir la reunión ──────────────────────────────────────────────

create or replace function public.iniciar_reunion(p_meeting_id uuid)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_first uuid;
begin
  if not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status = 'en_vivo' then
    return v_m;
  end if;
  if v_m.status <> 'publicada' then
    raise exception 'estado_invalido' using errcode = 'P0001',
      hint = 'Solo una reunión publicada se puede abrir en vivo.';
  end if;

  select id into v_first from public.run_items where meeting_id = p_meeting_id order by sort, created_at limit 1;
  if v_first is not null then
    update public.run_items set actual_start = now(), actual_end = null where id = v_first;
  end if;

  update public.meetings
     set status = 'en_vivo', actual_start = coalesce(actual_start, now()), actual_end = null,
         current_item_id = v_first
   where id = p_meeting_id
  returning * into v_m;
  return v_m;
end;
$$;

-- Pasa al ítem p_item_id (null = ninguno, p. ej. al acabar el orden).
-- Cierra el ítem actual con su hora real de fin.
create or replace function public.avanzar_item(p_meeting_id uuid, p_item_id uuid)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
begin
  if not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status <> 'en_vivo' then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'La reunión no está en vivo.';
  end if;
  if p_item_id is not null and not exists (select 1 from public.run_items where id = p_item_id and meeting_id = p_meeting_id) then
    raise exception 'item_invalido' using errcode = '22023';
  end if;
  if p_item_id is not distinct from v_m.current_item_id then
    return v_m;
  end if;

  if v_m.current_item_id is not null then
    update public.run_items set actual_end = now() where id = v_m.current_item_id and actual_end is null;
  end if;
  if p_item_id is not null then
    -- Volver a un ítem lo reabre; su inicio real se conserva.
    update public.run_items set actual_start = coalesce(actual_start, now()), actual_end = null where id = p_item_id;
  end if;

  update public.meetings set current_item_id = p_item_id where id = p_meeting_id returning * into v_m;
  return v_m;
end;
$$;

create or replace function public.terminar_reunion(p_meeting_id uuid)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
begin
  if not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status = 'cerrada' then
    return v_m;
  end if;
  if v_m.status <> 'en_vivo' then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'La reunión no está en vivo.';
  end if;

  update public.run_items set actual_end = now()
   where meeting_id = p_meeting_id and actual_start is not null and actual_end is null;
  update public.meetings
     set status = 'cerrada', current_item_id = null, actual_end = now()
   where id = p_meeting_id
  returning * into v_m;
  return v_m;
end;
$$;

-- ── 2. Asistencia ───────────────────────────────────────────────────────

-- ¿Puede confirmar la asistencia de esta persona en esta reunión?
-- Planeación (servir.asistencia) siempre. El líder de departamento, si la
-- persona tiene una asignación de su departamento en la reunión y la
-- asistencia no está cerrada.
create or replace function public.can_confirm_attendance(p_meeting_id uuid, p_person_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('servir.asistencia')
      or exists (
        select 1
          from public.assignments a
          join public.meetings m on m.id = a.meeting_id
         where a.meeting_id = p_meeting_id and a.person_id = p_person_id
           and a.status <> 'cancelada'
           and m.attendance_closed_at is null
           and public.has_permission('servir.asignar', 'departamento', a.ministry_id::text)
      );
$$;

-- La lista para confirmar: una fila por persona asignada (no cancelada) o
-- ya registrada, solo las que el usuario puede confirmar.
create or replace function public.asistencia_sugerida(p_meeting_id uuid)
returns table (
  person_id        uuid,
  full_name        text,
  roles            text[],
  ministries       text[],
  assignment_status text,
  checklist_done   int,
  checklist_total  int,
  suggested        text,
  current_status   text,
  current_note     text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with asig as (
    select a.person_id,
           array_agg(distinct po.name order by po.name) as roles,
           array_agg(distinct mi.name order by mi.name) as ministries,
           case when bool_or(a.status = 'aceptada') then 'aceptada'
                when bool_or(a.status = 'pendiente') then 'pendiente'
                else 'rechazada' end as assignment_status,
           count(ci.id) filter (where ci.done_at is not null)::int as done,
           count(ci.id)::int as total
      from public.assignments a
      join public.positions po on po.id = a.position_id
      join public.ministries mi on mi.id = a.ministry_id
      left join public.checklist_items ci on ci.assignment_id = a.id
     where a.meeting_id = p_meeting_id and a.status <> 'cancelada'
     group by a.person_id
  ),
  gente as (
    select person_id from asig
    union
    select at.person_id from public.attendance at where at.meeting_id = p_meeting_id
  )
  select g.person_id, p.full_name,
         coalesce(asig.roles, at.roles, '{}'), coalesce(asig.ministries, '{}'),
         asig.assignment_status,
         coalesce(asig.done, 0), coalesce(asig.total, 0),
         case when asig.assignment_status = 'aceptada' and asig.total > 0 and asig.done = asig.total then 'asistio'
              when asig.assignment_status = 'rechazada' then 'ausente'
              else null end,
         at.status, at.note
    from gente g
    join public.people p on p.id = g.person_id
    left join asig on asig.person_id = g.person_id
    left join public.attendance at on at.meeting_id = p_meeting_id and at.person_id = g.person_id
   where public.can_see_meeting(p_meeting_id)
     and public.can_confirm_attendance(p_meeting_id, g.person_id)
   order by p.full_name;
$$;

-- p_filas: [{ person_id, status ('asistio'|'tarde'|'ausente'), roles: [..], note }]
-- Una fila por persona: varios roles en la misma reunión = un servicio.
-- p_cerrar (solo servir.asistencia): cierra la asistencia y la reunión.
create or replace function public.confirmar_asistencia(p_meeting_id uuid, p_filas jsonb, p_cerrar boolean default false)
returns int
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_fila jsonb;
  v_person uuid;
  v_status text;
  v_n int := 0;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if auth.uid() is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status in ('borrador', 'cancelada') or (v_m.status = 'publicada' and v_m.meeting_date > v_hoy) then
    raise exception 'estado_invalido' using errcode = 'P0001',
      hint = 'La asistencia se confirma el día de la reunión o después.';
  end if;
  if p_cerrar and not public.has_permission('servir.asistencia') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  for v_fila in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_person := (v_fila ->> 'person_id')::uuid;
    v_status := v_fila ->> 'status';
    if v_status is null or v_status not in ('asistio', 'tarde', 'ausente') then
      raise exception 'estado_asistencia_invalido' using errcode = '22023';
    end if;
    if not public.can_confirm_attendance(p_meeting_id, v_person) then
      raise exception 'sin_permiso' using errcode = '42501',
        hint = 'No puedes confirmar la asistencia de esta persona.';
    end if;

    insert into public.attendance (meeting_id, person_id, assignment_id, status, roles, note, source, confirmed_by, confirmed_at)
    values (
      p_meeting_id, v_person,
      (select a.id from public.assignments a
        where a.meeting_id = p_meeting_id and a.person_id = v_person and a.status <> 'cancelada'
        order by (a.status = 'aceptada') desc, a.created_at limit 1),
      v_status,
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_fila -> 'roles') x), '{}'),
      nullif(trim(v_fila ->> 'note'), ''),
      'app', auth.uid(), now()
    )
    on conflict (meeting_id, person_id) do update
      set status = excluded.status,
          roles = case when cardinality(excluded.roles) > 0 then excluded.roles else attendance.roles end,
          note = excluded.note,
          assignment_id = coalesce(attendance.assignment_id, excluded.assignment_id),
          source = 'app', confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at;
    v_n := v_n + 1;
  end loop;

  if p_cerrar then
    update public.run_items set actual_end = now()
     where meeting_id = p_meeting_id and actual_start is not null and actual_end is null;
    update public.meetings
       set status = 'cerrada', current_item_id = null,
           actual_end = case when actual_start is not null then coalesce(actual_end, now()) end,
           attendance_closed_at = now(), attendance_closed_by = auth.uid()
     where id = p_meeting_id;
  end if;

  return v_n;
end;
$$;

revoke all on function public.iniciar_reunion(uuid)                      from public, anon;
revoke all on function public.avanzar_item(uuid, uuid)                   from public, anon;
revoke all on function public.terminar_reunion(uuid)                     from public, anon;
revoke all on function public.can_confirm_attendance(uuid, uuid)         from public, anon;
revoke all on function public.asistencia_sugerida(uuid)                  from public, anon;
revoke all on function public.confirmar_asistencia(uuid, jsonb, boolean) from public, anon;
grant execute on function public.iniciar_reunion(uuid)                      to authenticated;
grant execute on function public.avanzar_item(uuid, uuid)                   to authenticated;
grant execute on function public.terminar_reunion(uuid)                     to authenticated;
grant execute on function public.can_confirm_attendance(uuid, uuid)         to authenticated;
grant execute on function public.asistencia_sugerida(uuid)                  to authenticated;
grant execute on function public.confirmar_asistencia(uuid, jsonb, boolean) to authenticated;

-- ── 3. Realtime ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['meetings', 'run_items', 'assignments', 'checklist_items', 'attendance'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
