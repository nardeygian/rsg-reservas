-- =====================================================================
-- Etapa 5 · Servir — ajustes en vivo y reporte de la reunión
-- =====================================================================
-- Pedido de Gian (29 oct): una reunión se atrasa o hay que quitar una
-- canción o ajustar un punto del orden mientras pasa. El cambio se hace en
-- segundos desde En vivo, las horas proyectadas de cada punto se recalculan,
-- se avisa a todos los servidores asignados ese día y, al terminar, queda un
-- reporte con lo planeado frente a lo real, los atrasos y los ajustes.
--
-- Quién:
--   * Atraso, ajustar duración y quitar puntos: quien conduce en vivo
--     (servir.vivo: Planeación, pastor de sede, fundador, super admin).
--   * Quitar una canción: solo la música. Es el líder del departamento de
--     música (servir_ajustes.ministerio_musica_id, por defecto LMRSG) o
--     quien esté asignado esa reunión a un rol de director de ese
--     departamento (rol cuyo nombre empieza por "Director"). El super admin
--     también puede, como salida de emergencia.
--
-- Cómo:
--   * atrasar_reunion(min): antes de empezar corre la hora de inicio
--     (meetings.delay_minutes); en vivo alarga el punto actual. Acepta
--     cualquier cantidad de minutos (también negativa para corregir).
--   * ajustar_item(item, min): suma o resta minutos a un punto (mínimo 1).
--   * quitar_item(item, quitar): quita o devuelve un punto. Queda en el
--     orden marcado como quitado (para el reporte y para deshacer).
--   * Cada cambio queda en meeting_live_changes y avisa a los asignados.
--   * proyeccion_reunion(): hora proyectada de cada punto.
--   * terminar_reunion guarda el reporte en meetings.report y avisa a
--     Planeación y a los pastores de sede.
--
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── Columnas ────────────────────────────────────────────────────────────

alter table public.meetings  add column if not exists delay_minutes int not null default 0;
alter table public.meetings  add column if not exists report jsonb;
alter table public.run_items add column if not exists planned_duration_sec int;   -- la duración antes del primer ajuste
alter table public.run_items add column if not exists removed_at timestamptz;      -- quitado en vivo

alter table public.servir_ajustes add column if not exists ministerio_musica_id uuid references public.ministries(id) on delete set null;
update public.servir_ajustes
   set ministerio_musica_id = (select id from public.ministries where name = 'LMRSG' limit 1)
 where ministerio_musica_id is null;

-- ── Registro de cambios en vivo ─────────────────────────────────────────

create table if not exists public.meeting_live_changes (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  run_item_id  uuid references public.run_items(id) on delete set null,
  kind         text not null check (kind in ('atraso', 'duracion', 'quitar', 'devolver')),
  minutes      int,
  item_title   text,                 -- copia, por si el punto se borra después
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists meeting_live_changes_meeting_idx on public.meeting_live_changes (meeting_id, created_at);

alter table public.meeting_live_changes enable row level security;
revoke insert, update, delete, truncate on public.meeting_live_changes from anon, authenticated;
grant select on public.meeting_live_changes to authenticated;
drop policy if exists "meeting_live_changes: lectura" on public.meeting_live_changes;
create policy "meeting_live_changes: lectura" on public.meeting_live_changes for select to authenticated
  using (public.can_see_meeting(meeting_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_live_changes') then
    alter publication supabase_realtime add table public.meeting_live_changes;
  end if;
end $$;

-- ── ¿Puede quitar canciones? ────────────────────────────────────────────

create or replace function public.puede_quitar_canciones(p_meeting_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  with musica as (select ministerio_musica_id as id from public.servir_ajustes where id)
  select public.is_super_admin()
      or exists (select 1 from public.user_roles ur, musica
                  where ur.user_id = auth.uid() and ur.role = 'lider_departamento' and ur.ministry_id = musica.id)
      or exists (select 1 from public.assignments a
                   join public.positions po on po.id = a.position_id, musica
                  where a.meeting_id = p_meeting_id
                    and a.person_id = public.current_person_id()
                    and a.status in ('pendiente', 'aceptada')
                    and po.ministry_id = musica.id
                    and po.name ilike 'director%');
$$;

-- ── Proyección: hora de cada punto ──────────────────────────────────────
-- En vivo: los puntos ya pasados con su hora real; el actual desde su inicio
-- real; los siguientes, uno tras otro desde que termina el actual (o desde
-- ahora, si el actual ya se pasó de tiempo). Antes de empezar: desde la hora
-- de inicio más el atraso anunciado. Los puntos quitados no cuentan.
create or replace function public.proyeccion_reunion(p_meeting_id uuid)
returns table (run_item_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_t timestamptz;
  v_actual_sort int;
  r record;
begin
  if not public.can_see_meeting(p_meeting_id) then
    return;
  end if;
  select * into v_m from public.meetings where id = p_meeting_id;
  if not found then
    return;
  end if;

  select ri.sort into v_actual_sort from public.run_items ri where ri.id = v_m.current_item_id;

  if v_m.status = 'en_vivo' and v_actual_sort is not null then
    v_t := null;
    for r in select * from public.run_items ri
              where ri.meeting_id = p_meeting_id and ri.removed_at is null
              order by ri.sort, ri.created_at loop
      if r.sort < v_actual_sort then
        run_item_id := r.id; starts_at := r.actual_start; ends_at := r.actual_end;
      elsif r.id = v_m.current_item_id then
        run_item_id := r.id; starts_at := r.actual_start;
        ends_at := greatest(r.actual_start + make_interval(secs => r.duration_sec), now());
        v_t := ends_at;
      else
        run_item_id := r.id; starts_at := v_t; ends_at := v_t + make_interval(secs => r.duration_sec);
        v_t := ends_at;
      end if;
      return next;
    end loop;
    return;
  end if;

  if v_m.starts_at is null then
    return;
  end if;
  v_t := v_m.starts_at + make_interval(mins => v_m.delay_minutes);
  for r in select * from public.run_items ri
            where ri.meeting_id = p_meeting_id and ri.removed_at is null
            order by ri.sort, ri.created_at loop
    run_item_id := r.id; starts_at := v_t; ends_at := v_t + make_interval(secs => r.duration_sec);
    v_t := ends_at;
    return next;
  end loop;
end;
$$;

-- ── Avisar a los asignados ──────────────────────────────────────────────
-- Una fila por persona y reunión mientras los cambios lleguen seguidos: si
-- en el último minuto ya hubo un aviso de esta reunión, se actualiza ese
-- (la bandeja muestra lo último) y no se vuelve a mandar push hasta que
-- pase el minuto. Luego se pide al notificador que despache ya.
create or replace function public.avisar_cambio_vivo(p_meeting_id uuid, p_titulo text, p_cuerpo text)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_link text := '/servir/' || p_meeting_id || '/vivo';
  r record;
  v_prev public.notifications;
begin
  for r in select distinct pe.profile_id
             from public.assignments a
             join public.people pe on pe.id = a.person_id
            where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada')
              and pe.profile_id is not null loop
    select * into v_prev from public.notifications n
     where n.user_id = r.profile_id and n.kind = 'cambio_vivo' and n.link = v_link
       and n.created_at > now() - interval '1 minute'
     order by n.created_at desc limit 1;
    if found then
      update public.notifications set title = p_titulo, body = p_cuerpo, read_at = null where id = v_prev.id;
    else
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.profile_id, 'cambio_vivo', p_titulo, p_cuerpo, v_link);
    end if;
  end loop;

  begin
    perform public.notificador_disparar();
  exception when others then
    null;   -- sin notificador configurado (local): queda para el cron
  end;
end;
$$;

-- Texto del aviso: atraso total y la hora del siguiente punto.
create or replace function public.resumen_cambio_vivo(p_meeting_id uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (select * from public.meetings where id = p_meeting_id),
  proy as (select * from public.proyeccion_reunion(p_meeting_id)),
  siguiente as (
    select ri.title, p.starts_at
      from proy p join public.run_items ri on ri.id = p.run_item_id, m
     where p.starts_at >= now() and ri.kind <> 'encabezado'
       and (m.current_item_id is null or ri.id <> m.current_item_id)
     order by p.starts_at limit 1
  ),
  fin as (select max(ends_at) as fin from proy)
  select concat_ws(' · ',
           (select s.title || ' a las ' || to_char(s.starts_at at time zone 'America/Bogota', 'FMHH12:MI am') from siguiente s),
           (select 'termina ' || to_char(f.fin at time zone 'America/Bogota', 'FMHH12:MI am') from fin f where f.fin is not null));
$$;

-- ── Atraso ──────────────────────────────────────────────────────────────

create or replace function public.atrasar_reunion(p_meeting_id uuid, p_minutos int)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_item public.run_items;
  v_total int;
begin
  if not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_minutos is null or p_minutos = 0 or abs(p_minutos) > 240 then
    raise exception 'minutos_invalidos' using errcode = '22023', hint = 'Escribe entre 1 y 240 minutos.';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status not in ('publicada', 'en_vivo') then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'Solo se ajusta una reunión publicada o en vivo.';
  end if;

  if v_m.status = 'en_vivo' and v_m.current_item_id is not null then
    -- En vivo el atraso es del punto que está pasando: todo lo demás se corre.
    select * into v_item from public.run_items where id = v_m.current_item_id for update;
    update public.run_items
       set planned_duration_sec = coalesce(planned_duration_sec, duration_sec),
           duration_sec = greatest(60, duration_sec + p_minutos * 60)
     where id = v_item.id;
  end if;
  update public.meetings set delay_minutes = delay_minutes + p_minutos where id = p_meeting_id returning * into v_m;

  insert into public.meeting_live_changes (meeting_id, run_item_id, kind, minutes, item_title, created_by)
  values (p_meeting_id, v_item.id, 'atraso', p_minutos, v_item.title, auth.uid());

  v_total := v_m.delay_minutes;
  perform public.avisar_cambio_vivo(p_meeting_id,
    case when v_total > 0 then v_m.name || ' va ' || v_total || ' min atrasada'
         when v_total < 0 then v_m.name || ' va ' || abs(v_total) || ' min adelantada'
         else v_m.name || ' va a tiempo' end,
    public.resumen_cambio_vivo(p_meeting_id));
  return v_m;
end;
$$;

-- ── Ajustar la duración de un punto ─────────────────────────────────────

create or replace function public.ajustar_item(p_item_id uuid, p_minutos int)
returns public.run_items
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_i public.run_items;
  v_m public.meetings;
begin
  if not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_minutos is null or p_minutos = 0 or abs(p_minutos) > 240 then
    raise exception 'minutos_invalidos' using errcode = '22023', hint = 'Escribe entre 1 y 240 minutos.';
  end if;
  select * into v_i from public.run_items where id = p_item_id for update;
  if not found then
    raise exception 'item_invalido' using errcode = '22023';
  end if;
  select * into v_m from public.meetings where id = v_i.meeting_id;
  if v_m.status not in ('publicada', 'en_vivo') then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'Solo se ajusta una reunión publicada o en vivo.';
  end if;
  if v_i.removed_at is not null then
    raise exception 'item_quitado' using errcode = 'P0001', hint = 'Ese punto está quitado. Devuélvelo primero.';
  end if;

  update public.run_items
     set planned_duration_sec = coalesce(planned_duration_sec, duration_sec),
         duration_sec = greatest(60, duration_sec + p_minutos * 60)
   where id = p_item_id
  returning * into v_i;

  insert into public.meeting_live_changes (meeting_id, run_item_id, kind, minutes, item_title, created_by)
  values (v_i.meeting_id, v_i.id, 'duracion', p_minutos, v_i.title, auth.uid());

  perform public.avisar_cambio_vivo(v_i.meeting_id,
    v_m.name || ': ' || v_i.title || ' ' || case when p_minutos > 0 then '+' else '−' end || abs(p_minutos) || ' min',
    public.resumen_cambio_vivo(v_i.meeting_id));
  return v_i;
end;
$$;

-- ── Quitar o devolver un punto ──────────────────────────────────────────

create or replace function public.quitar_item(p_item_id uuid, p_quitar boolean default true)
returns public.run_items
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_i public.run_items;
  v_m public.meetings;
  v_sig uuid;
begin
  select * into v_i from public.run_items where id = p_item_id for update;
  if not found then
    raise exception 'item_invalido' using errcode = '22023';
  end if;
  if v_i.kind = 'cancion' then
    if not public.puede_quitar_canciones(v_i.meeting_id) then
      raise exception 'sin_permiso' using errcode = '42501', hint = 'Solo la música puede quitar canciones.';
    end if;
  elsif not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select * into v_m from public.meetings where id = v_i.meeting_id for update;
  if v_m.status not in ('publicada', 'en_vivo') then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'Solo se ajusta una reunión publicada o en vivo.';
  end if;
  if (v_i.removed_at is not null) = p_quitar then
    return v_i;
  end if;

  update public.run_items set removed_at = case when p_quitar then now() end where id = p_item_id returning * into v_i;

  -- Si se quita el punto que está pasando, la reunión sigue con el siguiente.
  if p_quitar and v_m.current_item_id = p_item_id then
    select ri.id into v_sig from public.run_items ri
     where ri.meeting_id = v_i.meeting_id and ri.removed_at is null and ri.sort > v_i.sort
     order by ri.sort, ri.created_at limit 1;
    update public.run_items set actual_end = now() where id = p_item_id and actual_end is null;
    if v_sig is not null then
      update public.run_items set actual_start = coalesce(actual_start, now()), actual_end = null where id = v_sig;
    end if;
    update public.meetings set current_item_id = v_sig where id = v_m.id;
  end if;

  insert into public.meeting_live_changes (meeting_id, run_item_id, kind, item_title, created_by)
  values (v_i.meeting_id, v_i.id, case when p_quitar then 'quitar' else 'devolver' end, v_i.title, auth.uid());

  perform public.avisar_cambio_vivo(v_i.meeting_id,
    v_m.name || ': ' || case when p_quitar then 'se quitó ' else 'vuelve ' end || v_i.title,
    public.resumen_cambio_vivo(v_i.meeting_id));
  return v_i;
end;
$$;

-- ── Conducir: no se pasa a un punto quitado ─────────────────────────────

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

  select id into v_first from public.run_items
   where meeting_id = p_meeting_id and removed_at is null order by sort, created_at limit 1;
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
  if p_item_id is not null and exists (select 1 from public.run_items where id = p_item_id and removed_at is not null) then
    raise exception 'item_quitado' using errcode = 'P0001', hint = 'Ese punto está quitado. Devuélvelo primero.';
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

-- ── Reporte ─────────────────────────────────────────────────────────────

create or replace function public.armar_reporte_reunion(p_meeting_id uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  with m as (select * from public.meetings where id = p_meeting_id),
  plan as (
    select coalesce(sum(coalesce(ri.planned_duration_sec, ri.duration_sec)), 0) as seg
      from public.run_items ri where ri.meeting_id = p_meeting_id
  )
  select jsonb_build_object(
    'generado', now(),
    'inicio_planeado', m.starts_at,
    'fin_planeado', case when m.starts_at is not null then m.starts_at + make_interval(secs => plan.seg) end,
    'inicio_real', m.actual_start,
    'fin_real', m.actual_end,
    'atraso_inicio_min', case when m.starts_at is not null and m.actual_start is not null
                              then round(extract(epoch from (m.actual_start - m.starts_at)) / 60) end,
    'diferencia_fin_min', case when m.starts_at is not null and m.actual_end is not null
                               then round(extract(epoch from (m.actual_end - (m.starts_at + make_interval(secs => plan.seg)))) / 60) end,
    'puntos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'titulo', ri.title, 'tipo', ri.kind,
               'planeado_min', round(coalesce(ri.planned_duration_sec, ri.duration_sec) / 60.0),
               'ajustado_min', round(ri.duration_sec / 60.0),
               'real_min', case when ri.actual_start is not null and ri.actual_end is not null
                                then round(extract(epoch from (ri.actual_end - ri.actual_start)) / 60) end,
               'quitado', ri.removed_at is not null)
             order by ri.sort, ri.created_at)
        from public.run_items ri where ri.meeting_id = p_meeting_id and ri.kind <> 'encabezado'), '[]'),
    'cambios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'hora', c.created_at, 'tipo', c.kind, 'minutos', c.minutes, 'punto', c.item_title,
               'quien', pr.full_name)
             order by c.created_at)
        from public.meeting_live_changes c
        left join public.profiles pr on pr.id = c.created_by
       where c.meeting_id = p_meeting_id), '[]')
  )
  from m, plan;
$$;

create or replace function public.terminar_reunion(p_meeting_id uuid)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_dif numeric;
  r record;
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
   where id = p_meeting_id;
  update public.meetings set report = public.armar_reporte_reunion(p_meeting_id)
   where id = p_meeting_id
  returning * into v_m;

  -- Aviso a Planeación y a los pastores de sede.
  v_dif := (v_m.report ->> 'diferencia_fin_min')::numeric;
  for r in select distinct p.id from public.profiles p
            where p.role in ('planeacion', 'pastor_sede', 'fundador')
               or exists (select 1 from public.user_roles ur
                           where ur.user_id = p.id and ur.role in ('servidor_planeacion', 'pastor_sede', 'fundador')) loop
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.id, 'reporte_reunion', 'Reporte: ' || v_m.name,
            concat_ws(' · ',
              case when v_dif is null then null
                   when v_dif > 0 then 'terminó ' || v_dif || ' min tarde'
                   when v_dif < 0 then 'terminó ' || abs(v_dif) || ' min antes'
                   else 'terminó a tiempo' end,
              (select count(*) || ' cambios en vivo' from public.meeting_live_changes c where c.meeting_id = p_meeting_id having count(*) > 0)),
            '/servir/reuniones/' || p_meeting_id);
  end loop;
  return v_m;
end;
$$;

-- ── Permisos de las funciones ───────────────────────────────────────────

revoke all on function public.puede_quitar_canciones(uuid)         from public, anon;
revoke all on function public.proyeccion_reunion(uuid)             from public, anon;
revoke all on function public.avisar_cambio_vivo(uuid, text, text) from public, anon, authenticated;
revoke all on function public.resumen_cambio_vivo(uuid)            from public, anon, authenticated;
revoke all on function public.atrasar_reunion(uuid, int)           from public, anon;
revoke all on function public.ajustar_item(uuid, int)              from public, anon;
revoke all on function public.quitar_item(uuid, boolean)           from public, anon;
revoke all on function public.armar_reporte_reunion(uuid)          from public, anon, authenticated;
grant execute on function public.puede_quitar_canciones(uuid) to authenticated;
grant execute on function public.proyeccion_reunion(uuid)     to authenticated;
grant execute on function public.atrasar_reunion(uuid, int)   to authenticated;
grant execute on function public.ajustar_item(uuid, int)      to authenticated;
grant execute on function public.quitar_item(uuid, boolean)   to authenticated;
