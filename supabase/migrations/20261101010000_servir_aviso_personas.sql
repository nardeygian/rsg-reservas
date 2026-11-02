-- =====================================================================
-- Etapa 5 · Servir — aviso desde la reunión: escoger a quién
-- =====================================================================
-- Pedido de Gian (1 nov): en "Enviar aviso" solo salía "Todos" cuando la
-- reunión no tenía asignaciones en la app. Ahora:
-- * Quien conduce (servir.vivo) y los líderes (servir.asignar) escogen
--   cualquier departamento; un servidor, el suyo (por asignación en la
--   reunión o por su equipo).
-- * A un departamento le llega a sus asignados en la reunión; si no tiene
--   asignados, a todo su equipo activo.
-- * Se puede escoger persona por persona (p_personas).
-- Migración aditiva e idempotente.
-- =====================================================================

create or replace function public.departamentos_para_avisar(p_meeting_id uuid)
returns table (ministry_id uuid, nombre text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with mios as (
    select a.ministry_id from public.assignments a
     where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada') and a.ministry_id is not null
       and a.person_id = public.current_person_id()
    union
    select tm.ministry_id from public.team_members tm
     where tm.person_id = public.current_person_id() and tm.active
  )
  select m.id, m.name from public.ministries m
   where m.type = 'departamento'
     and public.can_see_meeting(p_meeting_id)
     and (public.has_permission('servir.vivo') or public.has_permission('servir.asignar')
          or m.id in (select ministry_id from mios))
   order by m.name;
$$;

-- Personas a las que el usuario puede avisar en esta reunión, con su
-- departamento. Asignados en la reunión; si un departamento no tiene
-- asignados, su equipo. Quien conduce o lidera también ve a los asignados
-- a roles generales (ministry_id nulo).
create or replace function public.personas_para_avisar(p_meeting_id uuid)
returns table (person_id uuid, nombre text, ministry_id uuid, asignado boolean, con_cuenta boolean)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with deptos as (select d.ministry_id from public.departamentos_para_avisar(p_meeting_id) d),
  todos as (select public.has_permission('servir.vivo') or public.has_permission('servir.asignar') as si),
  asignados as (
    select distinct a.person_id, a.ministry_id from public.assignments a
     where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada')
       and (a.ministry_id in (select ministry_id from deptos) or (a.ministry_id is null and (select si from todos)))
  ),
  equipo as (
    select distinct tm.person_id, tm.ministry_id from public.team_members tm
     where tm.active and tm.ministry_id in (select ministry_id from deptos)
       and not exists (select 1 from asignados x where x.ministry_id = tm.ministry_id)
  ),
  juntos as (
    select person_id, ministry_id, true as asignado from asignados
    union all
    select person_id, ministry_id, false from equipo
  )
  select distinct on (j.person_id, j.ministry_id) j.person_id, pe.full_name, j.ministry_id, j.asignado, pe.profile_id is not null
    from juntos j join public.people pe on pe.id = j.person_id
   where pe.active is not false
   order by j.person_id, j.ministry_id, j.asignado desc;
$$;
grant execute on function public.personas_para_avisar(uuid) to authenticated;

drop function if exists public.enviar_aviso_reunion(uuid, uuid[], text);
create or replace function public.enviar_aviso_reunion(
  p_meeting_id uuid, p_ministerios uuid[], p_texto text, p_personas uuid[] default null
)
returns int
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_n int;
  v_nombre text;
  v_texto text := nullif(trim(left(p_texto, 500)), '');
begin
  if auth.uid() is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if v_texto is null then
    raise exception 'texto_requerido' using errcode = '22023', hint = 'Escribe el aviso.';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id;
  if not found or not public.can_see_meeting(p_meeting_id) then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status not in ('publicada', 'en_vivo') then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'Solo se avisa en una reunión publicada o en vivo.';
  end if;
  if p_ministerios is not null and exists (
       select 1 from unnest(p_ministerios) x where x not in (select ministry_id from public.departamentos_para_avisar(p_meeting_id))) then
    raise exception 'sin_permiso' using errcode = '42501', hint = 'No puedes avisar a esos departamentos.';
  end if;
  if not exists (select 1 from public.departamentos_para_avisar(p_meeting_id))
     and not (public.has_permission('servir.vivo') or public.has_permission('servir.asignar')) then
    raise exception 'sin_permiso' using errcode = '42501', hint = 'Solo puedes avisar en una reunión donde sirves.';
  end if;

  select full_name into v_nombre from public.profiles where id = auth.uid();

  -- Destinatarios: las personas permitidas, filtradas por departamento o
  -- por la lista de personas escogidas.
  insert into public.notifications (user_id, kind, title, body, link)
  select distinct pe.profile_id, 'aviso_reunion', coalesce(v_nombre, 'Aviso') || ' · ' || v_m.name, v_texto,
         '/servir/' || p_meeting_id || '/vivo'
    from public.personas_para_avisar(p_meeting_id) pa
    join public.people pe on pe.id = pa.person_id
   where pe.profile_id is not null
     and (p_ministerios is null or pa.ministry_id = any (p_ministerios))
     and (p_personas is null or pa.person_id = any (p_personas));
  get diagnostics v_n = row_count;
  begin
    perform public.notificador_disparar();
  exception when others then
    null;
  end;

  insert into public.meeting_live_changes (meeting_id, kind, item_title, created_by, data)
  values (p_meeting_id, 'aviso', v_texto, auth.uid(),
          jsonb_build_object('ministerios', p_ministerios, 'personas', p_personas, 'destinatarios', v_n));
  return v_n;
end;
$$;
grant execute on function public.enviar_aviso_reunion(uuid, uuid[], text, uuid[]) to authenticated;
