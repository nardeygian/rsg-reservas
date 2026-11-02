-- =====================================================================
-- Etapa 5 · Servir — asistentes por reunión
-- =====================================================================
-- Pedido de Gian (1 nov): un domingo tiene dos reuniones seguidas (pueden
-- ser más) y Protocolo lleva el número de asistentes de cada una.
--
-- * Punto nuevo en el orden, kind 'jornada' ("Inicio de reunión"): marca
--   dónde empieza cada reunión del día. Un orden sin marcadores es una
--   sola reunión. Lo que va antes del primer marcador (llegadas, montaje)
--   cuenta como parte de la primera.
-- * meeting_headcounts: un número por reunión (jornada_item_id) o uno solo
--   (jornada_item_id nulo) si el orden no tiene marcadores.
-- * Registra: el servidor asignado en la reunión a un rol "Líder" del
--   departamento que lleva el conteo (servir_ajustes.ministerio_protocolo_id,
--   por defecto Protocolo). Respaldo: quien conduce (servir.vivo) y el
--   super admin.
-- * Al pasar de una reunión a la siguiente (o al cerrar), se avisa al
--   Líder de Protocolo que registre la que terminó, si aún no tiene número.
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Marcador en el orden ─────────────────────────────────────────────
alter table public.run_items drop constraint if exists run_items_kind_check;
alter table public.run_items add constraint run_items_kind_check
  check (kind in ('cancion', 'predica', 'oracion', 'anuncio', 'encabezado', 'jornada', 'otro'));
alter table public.checklist_templates drop constraint if exists checklist_templates_run_item_kind_check;
alter table public.checklist_templates add constraint checklist_templates_run_item_kind_check
  check (run_item_kind in ('cancion', 'predica', 'oracion', 'anuncio', 'encabezado', 'jornada', 'otro'));

alter table public.servir_ajustes add column if not exists ministerio_protocolo_id uuid references public.ministries(id) on delete set null;
update public.servir_ajustes
   set ministerio_protocolo_id = (select id from public.ministries where name = 'Protocolo' and type = 'departamento' limit 1)
 where ministerio_protocolo_id is null;

-- ── 2. Conteos ──────────────────────────────────────────────────────────
create table if not exists public.meeting_headcounts (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references public.meetings(id) on delete cascade,
  jornada_item_id  uuid references public.run_items(id) on delete cascade,
  count            int not null check (count between 0 and 100000),
  recorded_by      uuid references public.profiles(id) on delete set null,
  recorded_at      timestamptz not null default now()
);
create unique index if not exists meeting_headcounts_unq
  on public.meeting_headcounts (meeting_id, coalesce(jornada_item_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.meeting_headcounts enable row level security;
drop policy if exists "meeting_headcounts: lectura" on public.meeting_headcounts;
create policy "meeting_headcounts: lectura" on public.meeting_headcounts for select to authenticated
  using (public.can_see_meeting(meeting_id));
revoke insert, update, delete on public.meeting_headcounts from anon, authenticated;
grant select on public.meeting_headcounts to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_headcounts') then
    alter publication supabase_realtime add table public.meeting_headcounts;
  end if;
end $$;

-- ── 3. Reuniones del día y a cuál pertenece cada punto ──────────────────
-- Una fila por marcador, en orden; si no hay marcadores, una sola fila con
-- item nulo ("Reunión").
create or replace function public.jornadas_reunion(p_meeting_id uuid)
returns table (jornada_item_id uuid, titulo text, n int, sort int, count int, registrado_por text, registrado_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with marcas as (
    select ri.id, ri.title, ri.sort, row_number() over (order by ri.sort, ri.created_at)::int as n
      from public.run_items ri
     where ri.meeting_id = p_meeting_id and ri.kind = 'jornada' and ri.removed_at is null
  ),
  filas as (
    select id, title, n, sort from marcas
    union all
    select null, 'Reunión', 1, 0 where not exists (select 1 from marcas)
  )
  select f.id, f.title, f.n, f.sort, h.count, pr.full_name, h.recorded_at
    from filas f
    left join public.meeting_headcounts h
      on h.meeting_id = p_meeting_id and h.jornada_item_id is not distinct from f.id
    left join public.profiles pr on pr.id = h.recorded_by
   where public.can_see_meeting(p_meeting_id)
   order by f.n;
$$;
grant execute on function public.jornadas_reunion(uuid) to authenticated;

-- Marcador al que pertenece un punto: el último antes (o en) su posición;
-- lo de antes del primer marcador cuenta como de la primera reunión.
create or replace function public.jornada_de_item(p_item_id uuid)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  with it as (select meeting_id, sort from public.run_items where id = p_item_id)
  select coalesce(
    (select m.id from public.run_items m, it
      where m.meeting_id = it.meeting_id and m.kind = 'jornada' and m.removed_at is null and m.sort <= it.sort
      order by m.sort desc limit 1),
    (select m.id from public.run_items m, it
      where m.meeting_id = it.meeting_id and m.kind = 'jornada' and m.removed_at is null
      order by m.sort limit 1));
$$;

-- ── 4. ¿Puede registrar? ────────────────────────────────────────────────
create or replace function public.puede_registrar_asistentes(p_meeting_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  with prot as (select ministerio_protocolo_id as id from public.servir_ajustes where id)
  select public.is_super_admin()
      or public.has_permission('servir.vivo')
      or exists (select 1 from public.assignments a
                   join public.positions po on po.id = a.position_id, prot
                  where a.meeting_id = p_meeting_id
                    and a.person_id = public.current_person_id()
                    and a.status in ('pendiente', 'aceptada')
                    and po.ministry_id = prot.id
                    and po.name ilike 'l_der%');
$$;
grant execute on function public.puede_registrar_asistentes(uuid) to authenticated;

create or replace function public.registrar_asistentes(p_meeting_id uuid, p_jornada_item_id uuid, p_count int)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_con_marcas boolean;
begin
  if not public.puede_registrar_asistentes(p_meeting_id) then
    raise exception 'sin_permiso' using errcode = '42501', hint = 'Registra el líder de Protocolo de esta reunión.';
  end if;
  if p_count is null or p_count < 0 or p_count > 100000 then
    raise exception 'conteo_invalido' using errcode = '22023', hint = 'Escribe un número válido de asistentes.';
  end if;
  select exists (select 1 from public.run_items where meeting_id = p_meeting_id and kind = 'jornada' and removed_at is null)
    into v_con_marcas;
  if v_con_marcas and (p_jornada_item_id is null or not exists (
       select 1 from public.run_items where id = p_jornada_item_id and meeting_id = p_meeting_id and kind = 'jornada')) then
    raise exception 'jornada_invalida' using errcode = '22023', hint = 'Escoge a qué reunión corresponde.';
  end if;
  if not v_con_marcas then
    p_jornada_item_id := null;
  end if;

  update public.meeting_headcounts set count = p_count, recorded_by = auth.uid(), recorded_at = now()
   where meeting_id = p_meeting_id and jornada_item_id is not distinct from p_jornada_item_id;
  if not found then
    insert into public.meeting_headcounts (meeting_id, jornada_item_id, count, recorded_by)
    values (p_meeting_id, p_jornada_item_id, p_count, auth.uid());
  end if;
end;
$$;
grant execute on function public.registrar_asistentes(uuid, uuid, int) to authenticated;

-- ── 5. Aviso al Líder de Protocolo ──────────────────────────────────────
create or replace function public.avisar_conteo(p_meeting_id uuid, p_jornada_item_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_titulo text;
begin
  if exists (select 1 from public.meeting_headcounts
              where meeting_id = p_meeting_id and jornada_item_id is not distinct from p_jornada_item_id) then
    return;   -- ya tiene número
  end if;
  select * into v_m from public.meetings where id = p_meeting_id;
  select title into v_titulo from public.run_items where id = p_jornada_item_id;

  insert into public.notifications (user_id, kind, title, body, link)
  select distinct pe.profile_id, 'conteo_asistentes', 'Registra los asistentes',
         coalesce(v_titulo, v_m.name) || ' · ' || v_m.name || ': escribe cuántas personas asistieron.',
         '/servir/' || p_meeting_id || '/vivo'
    from public.assignments a
    join public.people pe on pe.id = a.person_id
    join public.positions po on po.id = a.position_id
   where a.meeting_id = p_meeting_id and a.status in ('pendiente', 'aceptada') and pe.profile_id is not null
     and po.ministry_id = (select ministerio_protocolo_id from public.servir_ajustes where id)
     and po.name ilike 'l_der%';
  begin
    perform public.notificador_disparar();
  exception when others then
    null;
  end;
end;
$$;
revoke all on function public.avisar_conteo(uuid, uuid) from public, anon, authenticated;

-- Al pasar a un punto de una reunión posterior, o al cerrar, se pide el
-- número de la que terminó.
create or replace function public.meetings_pedir_conteo()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_antes uuid;
  v_despues uuid;
  r record;
begin
  if new.status = 'en_vivo' and old.current_item_id is distinct from new.current_item_id and old.current_item_id is not null then
    v_antes := public.jornada_de_item(old.current_item_id);
    v_despues := case when new.current_item_id is null then null else public.jornada_de_item(new.current_item_id) end;
    if v_antes is not null and v_antes is distinct from v_despues
       and (v_despues is null or (select sort from public.run_items where id = v_despues) > (select sort from public.run_items where id = v_antes)) then
      perform public.avisar_conteo(new.id, v_antes);
    end if;
  elsif new.status = 'cerrada' and old.status is distinct from 'cerrada' then
    for r in select jornada_item_id from public.jornadas_reunion(new.id) where count is null loop
      perform public.avisar_conteo(new.id, r.jornada_item_id);
    end loop;
  end if;
  return null;
exception when others then
  raise warning '[asistentes] no se pudo pedir el conteo: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists meetings_pedir_conteo on public.meetings;
create trigger meetings_pedir_conteo after update of current_item_id, status on public.meetings
  for each row execute function public.meetings_pedir_conteo();

-- ── 6. Estadísticas ─────────────────────────────────────────────────────
create or replace function public.asistentes_reuniones(p_desde date, p_hasta date)
returns table (meeting_id uuid, fecha date, reunion text, tipo text, meeting_type_id uuid, jornada text, n int, asistentes int)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.id, m.meeting_date, m.name, t.name, m.meeting_type_id,
         coalesce(ri.title, 'Reunión'),
         coalesce((select count(*)::int from public.run_items x
                    where x.meeting_id = m.id and x.kind = 'jornada' and x.removed_at is null and x.sort <= ri.sort), 1),
         h.count
    from public.meeting_headcounts h
    join public.meetings m on m.id = h.meeting_id
    left join public.meeting_types t on t.id = m.meeting_type_id
    left join public.run_items ri on ri.id = h.jornada_item_id
   where public.puede_ver_estadisticas()
     and m.meeting_date between p_desde and p_hasta
   order by m.meeting_date desc, 7;
$$;
grant execute on function public.asistentes_reuniones(date, date) to authenticated;
