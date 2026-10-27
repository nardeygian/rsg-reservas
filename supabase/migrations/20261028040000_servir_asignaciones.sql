-- =====================================================================
-- Etapa 5 · Servir — asignaciones, checklist, asistencia y notificaciones
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (secciones 3, 4 y 6).
-- Las políticas RLS van en 20261028050000_servir_rls.sql.
-- =====================================================================

-- ── Asignaciones ────────────────────────────────────────────────────────
-- ministry_id / area_id se copian de la posición al asignar: así las
-- políticas filtran por departamento o área sin unir tablas.
create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references public.meetings(id) on delete cascade,
  person_id       uuid not null references public.people(id) on delete cascade,
  position_id     uuid not null references public.positions(id) on delete restrict,
  ministry_id     uuid not null references public.ministries(id) on delete restrict,
  area_id         uuid references public.areas(id) on delete set null,
  status          text not null default 'pendiente'
                    check (status in ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  responded_at    timestamptz,
  decline_reason  text,
  assigned_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (meeting_id, person_id, position_id)
);

create index if not exists assignments_meeting_idx on public.assignments (meeting_id);
create index if not exists assignments_person_idx on public.assignments (person_id);
create index if not exists assignments_ministry_idx on public.assignments (ministry_id);

-- La posición manda: ministry_id y area_id siempre coinciden con ella.
create or replace function public.assignments_sync_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select p.ministry_id, p.area_id into new.ministry_id, new.area_id
    from public.positions p where p.id = new.position_id;
  return new;
end;
$$;

drop trigger if exists assignments_sync_scope on public.assignments;
create trigger assignments_sync_scope before insert or update of position_id on public.assignments
  for each row execute function public.assignments_sync_scope();

drop trigger if exists assignments_updated_at on public.assignments;
create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

-- ── Checklist ───────────────────────────────────────────────────────────
create table if not exists public.checklist_templates (
  id             uuid primary key default gen_random_uuid(),
  position_id    uuid not null references public.positions(id) on delete cascade,
  moment         text not null check (moment in ('antes', 'durante', 'despues')),
  text           text not null,
  sort           int not null default 0,
  run_item_kind  text check (run_item_kind in ('cancion', 'predica', 'oracion', 'anuncio', 'encabezado', 'otro')),
  created_at     timestamptz not null default now()
);

create index if not exists checklist_templates_position_idx on public.checklist_templates (position_id);

create table if not exists public.checklist_items (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  moment         text not null check (moment in ('antes', 'durante', 'despues')),
  text           text not null,
  sort           int not null default 0,
  done_at        timestamptz,
  done_by        uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists checklist_items_assignment_idx on public.checklist_items (assignment_id);

-- ── Asistencia ──────────────────────────────────────────────────────────
-- Una fila por persona y reunión. Las filas heredadas de los listados en
-- PDF (source = 'legacy') no tienen asignación; roles guarda los roles de
-- texto que traía el listado.
create table if not exists public.attendance (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references public.meetings(id) on delete cascade,
  person_id      uuid not null references public.people(id) on delete cascade,
  assignment_id  uuid references public.assignments(id) on delete set null,
  status         text not null check (status in ('asistio', 'tarde', 'ausente')),
  roles          text[] not null default '{}',
  note           text,
  source         text not null default 'app' check (source in ('app', 'legacy')),
  confirmed_by   uuid references public.profiles(id) on delete set null,
  confirmed_at   timestamptz not null default now(),
  unique (meeting_id, person_id)
);

create index if not exists attendance_person_idx on public.attendance (person_id);

-- ── Notificaciones ──────────────────────────────────────────────────────
-- Un dispositivo por fila. Web usa endpoint + llaves; las apps usan token
-- (FCM, que en iPhone entrega por APNs).
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  platform      text not null check (platform in ('web', 'android', 'ios')),
  endpoint      text unique,
  token         text unique,
  p256dh        text,
  auth          text,
  device        text,
  app_version   text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  check ((platform = 'web' and endpoint is not null) or (platform <> 'web' and token is not null))
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.broadcasts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid references public.profiles(id) on delete set null,
  audience          text not null check (audience in ('todos', 'departamento', 'area', 'reunion')),
  scope_id          text,           -- ministry_id, area_id o meeting_id según audience
  title             text not null,
  body              text not null,
  link              text,
  scheduled_for     timestamptz not null default now(),
  sent_at           timestamptz,
  recipients_count  int,
  created_at        timestamptz not null default now(),
  check ((audience = 'todos') = (scope_id is null))
);

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          text not null,   -- 'asignacion' | 'recordatorio' | 'envio' | 'cambio_reunion' | ...
  title         text not null,
  body          text,
  link          text,
  broadcast_id  uuid references public.broadcasts(id) on delete set null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Recordatorios programados por asignación. Los genera la base y los envía
-- el despachador (Edge Function 'notificador', frente B4).
create table if not exists public.reminders (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  kind           text not null check (kind in ('sin_respuesta', 'manana', 'dos_horas')),
  send_at        timestamptz not null,
  sent_at        timestamptz,
  unique (assignment_id, kind)
);

create index if not exists reminders_due_idx on public.reminders (send_at) where sent_at is null;

-- ── Lógica en la base ───────────────────────────────────────────────────

-- Momento de inicio de una reunión: starts_at, o las 9:00 de su fecha en
-- Bogotá si solo tiene fecha.
create or replace function public.meeting_start(m public.meetings)
returns timestamptz
language sql stable
as $$
  select coalesce(m.starts_at, (m.meeting_date + time '09:00') at time zone 'America/Bogota');
$$;

-- Al crear o reabrir una asignación: recordatorio si no responde.
-- Al aceptarla: su checklist (desde la plantilla de la posición) y los
-- recordatorios de "mañana" y "en dos horas". Al rechazarla o cancelarla:
-- se borran los recordatorios pendientes.
create or replace function public.assignments_after_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
begin
  select public.meeting_start(m) into v_start from public.meetings m where m.id = new.meeting_id;

  if new.status = 'pendiente' then
    insert into public.reminders (assignment_id, kind, send_at)
    values (new.id, 'sin_respuesta', least(now() + interval '48 hours', v_start - interval '24 hours'))
    on conflict (assignment_id, kind) do nothing;
  end if;

  if new.status = 'aceptada' and (tg_op = 'INSERT' or old.status is distinct from 'aceptada') then
    insert into public.checklist_items (assignment_id, moment, text, sort)
    select new.id, ct.moment, ct.text, ct.sort
      from public.checklist_templates ct
     where ct.position_id = new.position_id
       and not exists (select 1 from public.checklist_items ci where ci.assignment_id = new.id);

    delete from public.reminders where assignment_id = new.id and kind = 'sin_respuesta' and sent_at is null;
    insert into public.reminders (assignment_id, kind, send_at) values
      (new.id, 'manana',    v_start - interval '24 hours'),
      (new.id, 'dos_horas', v_start - interval '2 hours')
    on conflict (assignment_id, kind) do nothing;
  end if;

  if new.status in ('rechazada', 'cancelada') then
    delete from public.reminders where assignment_id = new.id and sent_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_after_change on public.assignments;
create trigger assignments_after_change after insert or update of status on public.assignments
  for each row execute function public.assignments_after_change();

-- El servidor responde su propia asignación (aceptar o rechazar).
create or replace function public.respond_assignment(p_assignment_id uuid, p_accept boolean, p_reason text default null)
returns public.assignments
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.assignments;
begin
  update public.assignments
     set status = case when p_accept then 'aceptada' else 'rechazada' end,
         responded_at = now(),
         decline_reason = case when p_accept then null else nullif(trim(p_reason), '') end
   where id = p_assignment_id
     and person_id = public.current_person_id()
     and status in ('pendiente', 'aceptada', 'rechazada')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Asignación no encontrada o no es tuya' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- El servidor marca o desmarca un punto de su checklist. Planeación (servir.vivo)
-- también puede hacerlo por él durante la reunión.
create or replace function public.toggle_checklist_item(p_item_id uuid, p_done boolean)
returns public.checklist_items
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.checklist_items;
begin
  update public.checklist_items ci
     set done_at = case when p_done then now() end,
         done_by = case when p_done then auth.uid() end
    from public.assignments a
   where ci.id = p_item_id
     and a.id = ci.assignment_id
     and a.status = 'aceptada'
     and (a.person_id = public.current_person_id() or public.has_permission('servir.vivo'))
  returning ci.* into v_row;

  if v_row.id is null then
    raise exception 'Punto de checklist no encontrado o no es tuyo' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

grant execute on function public.respond_assignment(uuid, boolean, text) to authenticated;
grant execute on function public.toggle_checklist_item(uuid, boolean) to authenticated;
