-- =====================================================================
-- Etapa 5 · Servir — En vivo, segunda vuelta
-- =====================================================================
-- Pedido de Gian tras la Reunión Central del 1 nov:
--
-- * El "conteo que se reiniciaba" eran saltos de punto (tocar un punto del
--   orden salta ahí). Cada cambio de punto queda ahora registrado con
--   quién lo hizo (kind 'avanzar'); la app pide confirmar los saltos.
-- * Sumar o restar minutos, y anunciar atraso, piden un motivo: categoría
--   obligatoria y nota opcional. Alimenta las estadísticas de atrasos.
-- * Aviso desde la reunión: quien conduce y los líderes, a todos o a los
--   departamentos que escojan; un servidor asignado, a su departamento.
-- * Canciones: la música puede quitar o reemplazar una canción en vivo; las
--   dos cosas avisan a Creativos (los asignados de esa reunión).
-- * Avisos automáticos por reunión (y guardados en la plantilla): "cuando
--   falten N min de la prédica, avisar a LMRSG". Los revisa pg_cron cada
--   minuto y salen una sola vez.
-- * Estadísticas: atrasos por motivo e informes escritos con Claude.
--
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Registro de cambios en vivo: más tipos y el motivo ───────────────
alter table public.meeting_live_changes add column if not exists reason_category text;
alter table public.meeting_live_changes add column if not exists reason text;
alter table public.meeting_live_changes add column if not exists from_item_id uuid references public.run_items(id) on delete set null;
alter table public.meeting_live_changes add column if not exists data jsonb;

alter table public.meeting_live_changes drop constraint if exists meeting_live_changes_kind_check;
alter table public.meeting_live_changes add constraint meeting_live_changes_kind_check
  check (kind in ('atraso', 'duracion', 'quitar', 'devolver', 'avanzar', 'aviso', 'aviso_auto', 'cancion_cambiada'));
alter table public.meeting_live_changes drop constraint if exists meeting_live_changes_reason_category_check;
alter table public.meeting_live_changes add constraint meeting_live_changes_reason_category_check
  check (reason_category is null or reason_category in ('alabanza', 'predica', 'tecnica', 'llegada', 'logistica', 'otro'));

-- Departamento que recibe los cambios de canciones (letras y pantalla).
alter table public.servir_ajustes add column if not exists ministerio_creativos_id uuid references public.ministries(id) on delete set null;
update public.servir_ajustes
   set ministerio_creativos_id = (select id from public.ministries where name = 'Creativos' and type = 'departamento' limit 1)
 where ministerio_creativos_id is null;

-- ── 2. Avisar a los asignados de una reunión, por departamento ──────────
-- p_ministerios nulo = todos; p_generales incluye los roles sin departamento.
create or replace function public.avisar_asignados(
  p_meeting_id uuid, p_ministerios uuid[], p_generales boolean, p_kind text, p_titulo text, p_cuerpo text
)
returns int
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select distinct pe.profile_id, p_kind, p_titulo, p_cuerpo, '/servir/' || p_meeting_id || '/vivo'
    from public.assignments a
    join public.people pe on pe.id = a.person_id
   where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada') and pe.profile_id is not null
     and (p_ministerios is null
          or a.ministry_id = any (p_ministerios)
          or (p_generales and a.ministry_id is null));
  get diagnostics v_n = row_count;
  begin
    perform public.notificador_disparar();
  exception when others then
    null;   -- sin notificador configurado (local): queda para el cron
  end;
  return v_n;
end;
$$;
revoke all on function public.avisar_asignados(uuid, uuid[], boolean, text, text, text) from public, anon, authenticated;

-- ── 3. Avanzar: registra quién y cuántos puntos se saltó ────────────────
create or replace function public.avanzar_item(p_meeting_id uuid, p_item_id uuid)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_de int;
  v_a int;
  v_titulo text;
  v_desde uuid;
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

  -- Posición (entre los no quitados) de donde sale y a donde va.
  with orden as (
    select id, row_number() over (order by sort, created_at) as n
      from public.run_items where meeting_id = p_meeting_id and removed_at is null
  )
  select (select n from orden where id = v_m.current_item_id), (select n from orden where id = p_item_id)
    into v_de, v_a;
  select title into v_titulo from public.run_items where id = p_item_id;
  v_desde := v_m.current_item_id;

  if v_m.current_item_id is not null then
    update public.run_items set actual_end = now() where id = v_m.current_item_id and actual_end is null;
  end if;
  if p_item_id is not null then
    -- Volver a un ítem lo reabre; su inicio real se conserva.
    update public.run_items set actual_start = coalesce(actual_start, now()), actual_end = null where id = p_item_id;
  end if;

  update public.meetings set current_item_id = p_item_id where id = p_meeting_id returning * into v_m;

  insert into public.meeting_live_changes (meeting_id, run_item_id, from_item_id, kind, minutes, item_title, created_by, data)
  values (p_meeting_id, p_item_id, v_desde, 'avanzar',
          case when v_de is not null and v_a is not null then v_a - v_de end, v_titulo, auth.uid(),
          jsonb_build_object('de', v_de, 'a', v_a));
  return v_m;
end;
$$;

-- ── 4. Atraso y duración, con motivo ────────────────────────────────────
drop function if exists public.atrasar_reunion(uuid, int);
create or replace function public.atrasar_reunion(p_meeting_id uuid, p_minutos int, p_categoria text, p_motivo text default null)
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
  if p_categoria is null or p_categoria not in ('alabanza', 'predica', 'tecnica', 'llegada', 'logistica', 'otro') then
    raise exception 'motivo_requerido' using errcode = '22023', hint = 'Escoge el motivo del ajuste.';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status not in ('publicada', 'en_vivo') then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'Solo se ajusta una reunión publicada o en vivo.';
  end if;

  if v_m.status = 'en_vivo' and v_m.current_item_id is not null then
    select * into v_item from public.run_items where id = v_m.current_item_id for update;
    update public.run_items
       set planned_duration_sec = coalesce(planned_duration_sec, duration_sec),
           duration_sec = greatest(60, duration_sec + p_minutos * 60)
     where id = v_item.id;
  end if;
  update public.meetings set delay_minutes = delay_minutes + p_minutos where id = p_meeting_id returning * into v_m;

  insert into public.meeting_live_changes (meeting_id, run_item_id, kind, minutes, item_title, created_by, reason_category, reason)
  values (p_meeting_id, v_item.id, 'atraso', p_minutos, v_item.title, auth.uid(), p_categoria, nullif(trim(left(p_motivo, 300)), ''));

  v_total := v_m.delay_minutes;
  perform public.avisar_cambio_vivo(p_meeting_id,
    case when v_total > 0 then v_m.name || ' va ' || v_total || ' min atrasada'
         when v_total < 0 then v_m.name || ' va ' || abs(v_total) || ' min adelantada'
         else v_m.name || ' va a tiempo' end,
    public.resumen_cambio_vivo(p_meeting_id));
  return v_m;
end;
$$;

drop function if exists public.ajustar_item(uuid, int);
create or replace function public.ajustar_item(p_item_id uuid, p_minutos int, p_categoria text, p_motivo text default null)
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
  if p_categoria is null or p_categoria not in ('alabanza', 'predica', 'tecnica', 'llegada', 'logistica', 'otro') then
    raise exception 'motivo_requerido' using errcode = '22023', hint = 'Escoge el motivo del ajuste.';
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

  insert into public.meeting_live_changes (meeting_id, run_item_id, kind, minutes, item_title, created_by, reason_category, reason)
  values (v_i.meeting_id, v_i.id, 'duracion', p_minutos, v_i.title, auth.uid(), p_categoria, nullif(trim(left(p_motivo, 300)), ''));

  perform public.avisar_cambio_vivo(v_i.meeting_id,
    v_m.name || ': ' || v_i.title || ' ' || case when p_minutos > 0 then '+' else '−' end || abs(p_minutos) || ' min',
    public.resumen_cambio_vivo(v_i.meeting_id));
  return v_i;
end;
$$;

grant execute on function public.atrasar_reunion(uuid, int, text, text), public.ajustar_item(uuid, int, text, text) to authenticated;

-- ── 5. Canciones: quitar avisa a Creativos; reemplazar ──────────────────
create or replace function public.avisar_creativos(p_meeting_id uuid, p_titulo text, p_cuerpo text)
returns void
language sql volatile security definer
set search_path = public, pg_temp
as $$
  select public.avisar_asignados(p_meeting_id, array[(select ministerio_creativos_id from public.servir_ajustes where id)],
                                 false, 'cancion_vivo', p_titulo, p_cuerpo)
   where exists (select 1 from public.servir_ajustes where id and ministerio_creativos_id is not null);
$$;
revoke all on function public.avisar_creativos(uuid, text, text) from public, anon, authenticated;

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
  if v_i.kind = 'cancion' then
    perform public.avisar_creativos(v_i.meeting_id,
      v_m.name || ': ' || case when p_quitar then 'se quitó la canción ' else 'vuelve la canción ' end || v_i.title,
      'Actualicen letras y pantalla.');
  end if;
  return v_i;
end;
$$;

create or replace function public.reemplazar_cancion(p_item_id uuid, p_song_id uuid, p_motivo text default null)
returns public.run_items
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_i public.run_items;
  v_m public.meetings;
  v_s public.songs;
  v_antes text;
begin
  select * into v_i from public.run_items where id = p_item_id for update;
  if not found or v_i.kind <> 'cancion' then
    raise exception 'item_invalido' using errcode = '22023', hint = 'Ese punto no es una canción.';
  end if;
  if not public.puede_quitar_canciones(v_i.meeting_id) then
    raise exception 'sin_permiso' using errcode = '42501', hint = 'Solo la música puede cambiar canciones.';
  end if;
  select * into v_m from public.meetings where id = v_i.meeting_id;
  if v_m.status not in ('publicada', 'en_vivo') then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'Solo se cambia en una reunión publicada o en vivo.';
  end if;
  select * into v_s from public.songs where id = p_song_id and active;
  if not found then
    raise exception 'cancion_invalida' using errcode = '22023', hint = 'Esa canción no está en el catálogo.';
  end if;
  if v_i.song_id = p_song_id then
    return v_i;
  end if;

  v_antes := v_i.title;
  update public.run_items set song_id = v_s.id, title = v_s.title, song_key = v_s.default_key
   where id = p_item_id returning * into v_i;

  insert into public.meeting_live_changes (meeting_id, run_item_id, kind, item_title, created_by, reason, data)
  values (v_i.meeting_id, v_i.id, 'cancion_cambiada', v_s.title, auth.uid(), nullif(trim(left(p_motivo, 300)), ''),
          jsonb_build_object('antes', v_antes));

  perform public.avisar_cambio_vivo(v_i.meeting_id, v_m.name || ': ' || v_antes || ' → ' || v_s.title,
    public.resumen_cambio_vivo(v_i.meeting_id));
  perform public.avisar_creativos(v_i.meeting_id, v_m.name || ': cambió una canción',
    v_antes || ' → ' || v_s.title || coalesce(' (tono ' || v_s.default_key || ')', '') || '. Actualicen letras y pantalla.');
  return v_i;
end;
$$;
grant execute on function public.reemplazar_cancion(uuid, uuid, text) to authenticated;

-- ── 6. Aviso manual desde la reunión ────────────────────────────────────
-- Quien conduce (servir.vivo) y los líderes (servir.asignar): a todos o a
-- los departamentos escogidos. Un servidor asignado: a su departamento.
create or replace function public.departamentos_para_avisar(p_meeting_id uuid)
returns table (ministry_id uuid, nombre text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with todos as (
    select distinct a.ministry_id from public.assignments a
     where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada') and a.ministry_id is not null
  ),
  mios as (
    select distinct a.ministry_id from public.assignments a
     where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada') and a.ministry_id is not null
       and a.person_id = public.current_person_id()
  )
  select m.id, m.name from public.ministries m
   where m.id in (select ministry_id from todos)
     and (public.has_permission('servir.vivo') or public.has_permission('servir.asignar')
          or m.id in (select ministry_id from mios))
   order by m.name;
$$;
grant execute on function public.departamentos_para_avisar(uuid) to authenticated;

create or replace function public.enviar_aviso_reunion(p_meeting_id uuid, p_ministerios uuid[], p_texto text)
returns int
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_todos boolean;
  v_permitidos uuid[];
  v_destino uuid[];
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

  v_todos := public.has_permission('servir.vivo') or public.has_permission('servir.asignar');
  select coalesce(array_agg(ministry_id), '{}') into v_permitidos from public.departamentos_para_avisar(p_meeting_id);
  if p_ministerios is null then
    if not v_todos then
      v_destino := v_permitidos;          -- un servidor: su departamento
    end if;                               -- líder o quien conduce: todos (null)
  else
    select coalesce(array_agg(x), '{}') into v_destino from unnest(p_ministerios) x where x = any (v_permitidos);
    if cardinality(v_destino) = 0 then
      raise exception 'sin_permiso' using errcode = '42501', hint = 'No puedes avisar a esos departamentos.';
    end if;
  end if;
  if not v_todos and cardinality(coalesce(v_destino, '{}')) = 0 then
    raise exception 'sin_permiso' using errcode = '42501', hint = 'Solo puedes avisar en una reunión donde sirves.';
  end if;

  select full_name into v_nombre from public.profiles where id = auth.uid();
  v_n := public.avisar_asignados(p_meeting_id, v_destino, v_destino is null, 'aviso_reunion',
                                 coalesce(v_nombre, 'Aviso') || ' · ' || v_m.name, v_texto);

  insert into public.meeting_live_changes (meeting_id, kind, item_title, created_by, data)
  values (p_meeting_id, 'aviso', v_texto, auth.uid(),
          jsonb_build_object('ministerios', v_destino, 'destinatarios', v_n));
  return v_n;
end;
$$;
grant execute on function public.enviar_aviso_reunion(uuid, uuid[], text) to authenticated;

-- ── 7. Avisos automáticos ───────────────────────────────────────────────
create table if not exists public.meeting_alerts (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  run_item_id   uuid not null references public.run_items(id) on delete cascade,
  anchor        text not null default 'antes_fin' check (anchor in ('antes_fin', 'despues_inicio')),
  minutes       int not null check (minutes between 0 and 240),
  ministry_ids  uuid[] not null check (cardinality(ministry_ids) > 0),
  message       text not null check (length(message) between 1 and 300),
  sent_at       timestamptz,
  skipped       boolean not null default false,   -- el punto terminó antes de que tocara
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists meeting_alerts_meeting_idx on public.meeting_alerts (meeting_id);
create index if not exists meeting_alerts_pendientes_idx on public.meeting_alerts (meeting_id) where sent_at is null;

alter table public.meeting_alerts enable row level security;
drop policy if exists "meeting_alerts: lectura" on public.meeting_alerts;
create policy "meeting_alerts: lectura" on public.meeting_alerts for select to authenticated
  using (public.can_see_meeting(meeting_id));
drop policy if exists "meeting_alerts: escritura" on public.meeting_alerts;
create policy "meeting_alerts: escritura" on public.meeting_alerts for all to authenticated
  using ((select public.has_permission('servir.planear')) or (select public.has_permission('servir.vivo')))
  with check ((select public.has_permission('servir.planear')) or (select public.has_permission('servir.vivo')));
grant select, insert, update, delete on public.meeting_alerts to authenticated;

-- En la plantilla: [{ item_sort, anchor, minutes, ministry_ids, message }]
alter table public.meeting_templates add column if not exists alerts jsonb not null default '[]'::jsonb;

-- La revisa pg_cron cada minuto: dispara lo que ya toca en reuniones en
-- vivo; marca omitido lo de un punto que terminó sin llegar al momento.
create or replace function public.revisar_avisos_reunion()
returns int
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select al.*, ri.title as item_title, ri.actual_start, ri.actual_end, ri.duration_sec, ri.removed_at,
           m.name as meeting_name, m.current_item_id,
           case al.anchor
             when 'antes_fin' then ri.actual_start + make_interval(secs => ri.duration_sec) - make_interval(mins => al.minutes)
             else ri.actual_start + make_interval(mins => al.minutes)
           end as toca
      from public.meeting_alerts al
      join public.meetings m on m.id = al.meeting_id and m.status = 'en_vivo'
      join public.run_items ri on ri.id = al.run_item_id
     where al.sent_at is null
     for update of al skip locked
  loop
    if r.removed_at is not null or (r.actual_end is not null and r.current_item_id is distinct from r.run_item_id) then
      update public.meeting_alerts set sent_at = now(), skipped = true where id = r.id;
    elsif r.current_item_id = r.run_item_id and r.actual_start is not null and r.toca <= now() then
      perform public.avisar_asignados(r.meeting_id, r.ministry_ids, false, 'aviso_auto', r.message, r.meeting_name || ' · ' || r.item_title);
      update public.meeting_alerts set sent_at = now() where id = r.id;
      insert into public.meeting_live_changes (meeting_id, run_item_id, kind, item_title, data)
      values (r.meeting_id, r.run_item_id, 'aviso_auto', r.message, jsonb_build_object('ministerios', r.ministry_ids));
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.revisar_avisos_reunion() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('avisos-reunion') where exists (select 1 from cron.job where jobname = 'avisos-reunion');
    perform cron.schedule('avisos-reunion', '* * * * *', 'select public.revisar_avisos_reunion()');
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_alerts') then
    alter publication supabase_realtime add table public.meeting_alerts;
  end if;
end $$;

-- ── 8. Estadísticas de atrasos e informes con Claude ────────────────────
create or replace function public.estadisticas_atrasos(p_desde date, p_hasta date)
returns table (categoria text, veces int, minutos int, reuniones int)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(c.reason_category, 'sin_motivo'), count(*)::int, sum(c.minutes)::int, count(distinct c.meeting_id)::int
    from public.meeting_live_changes c
    join public.meetings m on m.id = c.meeting_id
   where public.puede_ver_estadisticas()
     and c.kind in ('atraso', 'duracion') and c.minutes > 0
     and m.meeting_date between p_desde and p_hasta
   group by 1
   order by 3 desc;
$$;
grant execute on function public.estadisticas_atrasos(date, date) to authenticated;

-- Los motivos uno por uno, para la lista y para el análisis.
create or replace function public.motivos_atraso(p_desde date, p_hasta date)
returns table (fecha date, reunion text, tipo text, punto text, minutos int, categoria text, nota text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.meeting_date, m.name, t.name, c.item_title, c.minutes, c.reason_category, c.reason
    from public.meeting_live_changes c
    join public.meetings m on m.id = c.meeting_id
    left join public.meeting_types t on t.id = m.meeting_type_id
   where public.puede_ver_estadisticas()
     and c.kind in ('atraso', 'duracion') and c.minutes > 0
     and m.meeting_date between p_desde and p_hasta
   order by m.meeting_date desc, c.created_at desc
   limit 1000;
$$;
grant execute on function public.motivos_atraso(date, date) to authenticated;

create table if not exists public.delay_reports (
  id          uuid primary key default gen_random_uuid(),
  desde       date not null,
  hasta       date not null,
  content     text not null,
  model       text not null,
  created_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.delay_reports enable row level security;
drop policy if exists "delay_reports: lectura" on public.delay_reports;
create policy "delay_reports: lectura" on public.delay_reports for select to authenticated
  using ((select public.puede_ver_estadisticas()));
drop policy if exists "delay_reports: crear" on public.delay_reports;
create policy "delay_reports: crear" on public.delay_reports for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.puede_ver_estadisticas()));
grant select, insert on public.delay_reports to authenticated;

-- ── 9. Reporte: con el motivo de cada ajuste y sin cada "Siguiente" ─────
-- (Los saltos de más de un punto y hacia atrás sí aparecen.)
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
               'quien', pr.full_name, 'categoria', c.reason_category, 'motivo', c.reason)
             order by c.created_at)
        from public.meeting_live_changes c
        left join public.profiles pr on pr.id = c.created_by
       where c.meeting_id = p_meeting_id
         and not (c.kind = 'avanzar' and c.minutes = 1)), '[]')
  )
  from m, plan;
$$;

