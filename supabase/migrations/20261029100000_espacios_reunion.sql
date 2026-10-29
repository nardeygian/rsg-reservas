-- =====================================================================
-- Etapa 5 · Servir — espacios de la reunión, con montaje y desmonte
-- =====================================================================
-- Pedido y decisiones de Gian (29 oct 2026):
-- * Al crear una reunión se escogen los espacios de la sede (los mismos de
--   Reservas) y eso bloquea Reservas en esas horas.
-- * Cada reunión suma montaje antes (por defecto 2 horas) y desmonte después
--   (por defecto 1 hora). Se ajustan por reunión y quedan en las plantillas
--   y en los tipos de reunión.
-- * Bloquea solo al publicar. En borrador los espacios quedan escogidos, sin
--   reservar.
-- * Una reunión de ministerio queda aprobada directo; las demás siguen la
--   política del espacio (el Auditorio pide aprobación). Los pastores de
--   sede reciben un aviso.
-- * Si el espacio ya está ocupado en ese horario (con montaje y desmonte),
--   no se puede usar: la exclusion constraint de bookings lo impide y aquí
--   solo se traduce el error.
-- * Montaje, desmonte y espacios los cambian quienes tienen servir.planear
--   global: Planeación, pastor de sede, fundador y super admin.
--
-- Reservas sigue igual para todo lo demás: las columnas nuevas de bookings
-- aceptan nulos y, vacías, el trigger usa los minutos del espacio como hoy.
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Reservas: montaje y desmonte por reserva, y su reunión ───────────

alter table public.bookings add column if not exists setup_minutes    int check (setup_minutes between 0 and 720);
alter table public.bookings add column if not exists teardown_minutes int check (teardown_minutes between 0 and 720);
alter table public.bookings add column if not exists meeting_id uuid references public.meetings(id) on delete set null;
create index if not exists bookings_meeting_idx on public.bookings (meeting_id) where meeting_id is not null;

create or replace function public.set_booking_time_range()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  setup_min int := 0;
  teardown_min int := 0;
begin
  select coalesce(new.setup_minutes, setup_buffer_minutes, 0), coalesce(new.teardown_minutes, teardown_buffer_minutes, 0)
    into setup_min, teardown_min
    from public.spaces where id = new.space_id;
  new.time_range := tstzrange(
    new.starts_at - make_interval(mins => setup_min),
    new.ends_at + make_interval(mins => teardown_min),
    '[)'
  );
  return new;
end;
$$;

drop trigger if exists bookings_time_range on public.bookings;
create trigger bookings_time_range
before insert or update of starts_at, ends_at, space_id, setup_minutes, teardown_minutes on public.bookings
for each row execute function public.set_booking_time_range();

-- El calendario de Reservas muestra la franja ocupada con montaje y
-- desmonte (solo horas: nada de detalle). Columnas nuevas al final.
create or replace view public.bookings_calendar
with (security_invoker = false) as
select
  b.id,
  b.space_id,
  s.name as space_name,
  b.starts_at,
  b.ends_at,
  b.status,
  case
    when b.visibility = 'private_label' then 'Reserva externa'
    when b.use_type = 'consejeria' then 'Consejería'
    when b.is_external then 'Alquiler externo'
    else coalesce(m.name, 'RSG')
  end as display_owner,
  case
    when b.visibility = 'private_label' then null
    else b.use_type
  end as use_type,
  case when b.montaje_lock then true else false end as has_montaje_lock,
  b.created_by,
  case
    when b.visibility = 'private_label' then null
    when b.use_type = 'consejeria' then null
    when b.is_external then null
    else b.title
  end as title,
  b.parent_booking_id,
  lower(b.time_range) as occupied_from,
  upper(b.time_range) as occupied_until
from public.bookings b
join public.spaces s on s.id = b.space_id
left join public.ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;

grant select on public.bookings_calendar to anon, authenticated;

-- ── 2. Reunión, plantilla y tipo ────────────────────────────────────────

alter table public.meetings add column if not exists setup_minutes    int not null default 120 check (setup_minutes between 0 and 720);
alter table public.meetings add column if not exists teardown_minutes int not null default 60  check (teardown_minutes between 0 and 720);

alter table public.meeting_types add column if not exists usual_space_ids  uuid[] not null default '{}';
alter table public.meeting_types add column if not exists setup_minutes    int not null default 120 check (setup_minutes between 0 and 720);
alter table public.meeting_types add column if not exists teardown_minutes int not null default 60  check (teardown_minutes between 0 and 720);
update public.meeting_types
   set usual_space_ids = array[usual_space_id]
 where usual_space_id is not null and cardinality(usual_space_ids) = 0;

-- En la plantilla, null = usa lo del tipo de reunión.
alter table public.meeting_templates add column if not exists space_ids        uuid[];
alter table public.meeting_templates add column if not exists setup_minutes    int check (setup_minutes between 0 and 720);
alter table public.meeting_templates add column if not exists teardown_minutes int check (teardown_minutes between 0 and 720);

-- Espacios escogidos para cada reunión.
create table if not exists public.meeting_spaces (
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  space_id    uuid not null references public.spaces(id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (meeting_id, space_id)
);

alter table public.meeting_spaces enable row level security;

drop policy if exists "meeting_spaces: lectura" on public.meeting_spaces;
create policy "meeting_spaces: lectura" on public.meeting_spaces for select to authenticated
  using (public.can_see_meeting(meeting_id));
drop policy if exists "meeting_spaces: escritura" on public.meeting_spaces;
create policy "meeting_spaces: escritura" on public.meeting_spaces for all to authenticated
  using ((select public.has_global_permission('servir.planear')))
  with check ((select public.has_global_permission('servir.planear')));

revoke all on public.meeting_spaces from anon;
grant select, insert, delete on public.meeting_spaces to authenticated;
revoke update on public.meeting_spaces from authenticated;
grant all on public.meeting_spaces to service_role;

-- Montaje, desmonte y espacios: solo servir.planear global (Planeación,
-- pastor de sede, fundador, super admin). Un pastor de ministerio puede
-- editar sus plantillas, pero no estos datos.
create or replace function public.proteger_montaje()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cambio boolean;
begin
  if auth.uid() is null or public.has_global_permission('servir.planear') then
    return new;
  end if;
  if tg_table_name = 'meeting_templates' then
    v_cambio := (tg_op = 'INSERT' and (new.space_ids is not null or new.setup_minutes is not null or new.teardown_minutes is not null))
             or (tg_op = 'UPDATE' and (new.space_ids is distinct from old.space_ids
                  or new.setup_minutes is distinct from old.setup_minutes
                  or new.teardown_minutes is distinct from old.teardown_minutes));
  elsif tg_table_name = 'meeting_types' then
    v_cambio := (tg_op = 'INSERT' and (cardinality(new.usual_space_ids) > 0 or new.setup_minutes <> 120 or new.teardown_minutes <> 60))
             or (tg_op = 'UPDATE' and (new.usual_space_ids is distinct from old.usual_space_ids
                  or new.setup_minutes is distinct from old.setup_minutes
                  or new.teardown_minutes is distinct from old.teardown_minutes));
  else  -- meetings
    v_cambio := tg_op = 'UPDATE' and (new.setup_minutes is distinct from old.setup_minutes
                  or new.teardown_minutes is distinct from old.teardown_minutes);
  end if;
  if v_cambio then
    raise exception 'sin_permiso_montaje' using errcode = '42501',
      hint = 'Solo Planeación, un pastor de sede o un super admin cambian espacios, montaje y desmonte.';
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_templates_proteger_montaje on public.meeting_templates;
create trigger meeting_templates_proteger_montaje before insert or update on public.meeting_templates
  for each row execute function public.proteger_montaje();
drop trigger if exists meeting_types_proteger_montaje on public.meeting_types;
create trigger meeting_types_proteger_montaje before insert or update on public.meeting_types
  for each row execute function public.proteger_montaje();
drop trigger if exists meetings_proteger_montaje on public.meetings;
create trigger meetings_proteger_montaje before update of setup_minutes, teardown_minutes on public.meetings
  for each row execute function public.proteger_montaje();

-- ── 3. Sincronizar las reservas con la reunión ──────────────────────────

-- "dom 9 nov 7:00 a. m.–1:00 p. m." en Bogotá, para los mensajes.
create or replace function public.franja_bogota(p_desde timestamptz, p_hasta timestamptz)
returns text
language sql stable
as $$
  select to_char(p_desde at time zone 'America/Bogota', 'DD/MM HH24:MI') || '–' ||
         case when (p_desde at time zone 'America/Bogota')::date = (p_hasta at time zone 'America/Bogota')::date
              then to_char(p_hasta at time zone 'America/Bogota', 'HH24:MI')
              else to_char(p_hasta at time zone 'America/Bogota', 'DD/MM HH24:MI') end;
$$;

-- Deja las reservas de la reunión como deben estar:
-- * publicada, en vivo o cerrada, con hora de inicio y fin: una reserva
--   activa por cada espacio escogido, con las horas y el montaje de la
--   reunión; los espacios que ya no están se liberan.
-- * borrador o cancelada: todas liberadas (canceladas).
-- Una reserva que un pastor rechazó no se vuelve a pedir sola.
create or replace function public.sincronizar_reservas_reunion(p_meeting_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  m public.meetings;
  v_activa boolean;
  v_autor uuid;
  v_org uuid;
  sp record;
  v_booking public.bookings;
  v_estado text;
  v_choque record;
  v_rango tstzrange;
begin
  select * into m from public.meetings where id = p_meeting_id;
  if not found then
    return;
  end if;

  v_activa := m.status in ('publicada', 'en_vivo', 'cerrada');

  -- Liberar lo que sobra (o todo, si la reunión no está activa).
  update public.bookings b
     set status = 'cancelled'
   where b.meeting_id = m.id
     and b.status in ('requested', 'approved')
     and (not v_activa or not exists (select 1 from public.meeting_spaces ms where ms.meeting_id = m.id and ms.space_id = b.space_id));

  if not v_activa or not exists (select 1 from public.meeting_spaces where meeting_id = m.id) then
    return;
  end if;
  if m.starts_at is null or m.ends_at is null then
    raise exception 'reunion_sin_hora' using errcode = 'P0001',
      hint = 'Para reservar espacios, la reunión necesita hora de inicio y de fin.';
  end if;

  v_autor := coalesce(auth.uid(), m.created_by);
  if v_autor is null then
    raise exception 'reunion_sin_autor' using errcode = 'P0001',
      hint = 'No hay quién figure como responsable de la reserva.';
  end if;
  select id into v_org from public.organizations where type = 'church' order by (name = 'RSG') desc, created_at limit 1;

  for sp in
    select s.* from public.meeting_spaces ms join public.spaces s on s.id = ms.space_id
     where ms.meeting_id = m.id order by s.name
  loop
    if sp.status = 'disabled' then
      raise exception 'espacio_deshabilitado' using errcode = 'P0001',
        hint = format('%s está deshabilitado en Reservas.', sp.name);
    end if;

    -- Reunión de ministerio: aprobada directo. Las demás, según el espacio.
    v_estado := case when m.kind = 'ministerio' or sp.booking_policy = 'self_serve' then 'approved' else 'requested' end;

    select * into v_booking from public.bookings
     where meeting_id = m.id and space_id = sp.id
     order by (status in ('requested', 'approved')) desc, created_at desc
     limit 1;

    begin
      if v_booking.id is null then
        insert into public.bookings (
          space_id, owner_org_id, created_by, ministry_id, title, use_type, visibility,
          starts_at, ends_at, status, setup_minutes, teardown_minutes, meeting_id, internal_notes
        ) values (
          sp.id, v_org, v_autor, m.ministry_id, m.name,
          case when m.kind = 'ministerio' then 'reunion_ministerio' else 'evento' end, 'full',
          m.starts_at, m.ends_at, v_estado, m.setup_minutes, m.teardown_minutes, m.id,
          'Reserva de la reunión de Servir'
        )
        returning * into v_booking;
        perform public.avisar_reserva_reunion(v_booking, m);
      elsif v_booking.status = 'rejected' then
        null;  -- la decisión del pastor se respeta
      else
        update public.bookings
           set starts_at = m.starts_at, ends_at = m.ends_at, title = m.name, ministry_id = m.ministry_id,
               setup_minutes = m.setup_minutes, teardown_minutes = m.teardown_minutes,
               status = case when status = 'cancelled' then v_estado else status end
         where id = v_booking.id
           and (starts_at, ends_at, title, setup_minutes, teardown_minutes, status, ministry_id)
               is distinct from (m.starts_at, m.ends_at, m.name, m.setup_minutes, m.teardown_minutes,
                                 case when status = 'cancelled' then v_estado else status end, m.ministry_id);
      end if;
    exception when exclusion_violation then
      v_rango := tstzrange(m.starts_at - make_interval(mins => m.setup_minutes),
                           m.ends_at + make_interval(mins => m.teardown_minutes), '[)');
      select lower(b.time_range) as desde, upper(b.time_range) as hasta into v_choque
        from public.bookings b
       where b.space_id = sp.id and b.status in ('requested', 'approved')
         and b.shared_occupancy_allowed = false and b.is_recurrence_template = false
         and b.time_range && v_rango and b.meeting_id is distinct from m.id
       order by lower(b.time_range) limit 1;
      raise exception 'espacio_ocupado' using errcode = '23P01',
        hint = format('%s ya está ocupado de %s (con su montaje y desmonte). Escoge otro espacio u otra hora.',
                      sp.name, coalesce(public.franja_bogota(v_choque.desde, v_choque.hasta), 'esa franja'));
    end;
  end loop;
end;
$$;

-- Aviso a los pastores de sede de cada reserva que crea una reunión.
create or replace function public.avisar_reserva_reunion(b public.bookings, m public.meetings)
returns void
language sql volatile security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select distinct u.id, 'reserva_reunion',
         case when b.status = 'approved' then 'Reunión reservó ' else 'Reunión pide ' end || s.name,
         m.name || ' · ' || public.franja_bogota(lower(b.time_range), upper(b.time_range))
           || ' con montaje y desmonte' || case when b.status = 'requested' then '. Espera tu aprobación.' else '.' end,
         case when b.status = 'requested' then '/aprobaciones' else '/reservas/' || b.id end
    from public.spaces s,
         (select p.id from public.profiles p where p.role = 'pastor_sede'
          union select ur.user_id from public.user_roles ur where ur.role = 'pastor_sede') u
   where s.id = b.space_id and u.id is distinct from auth.uid();
$$;

create or replace function public.meetings_sync_reservas()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.bookings set status = 'cancelled'
     where meeting_id = old.id and status in ('requested', 'approved');
    return old;
  end if;
  perform public.sincronizar_reservas_reunion(new.id);
  return new;
end;
$$;

drop trigger if exists meetings_sync_reservas on public.meetings;
create trigger meetings_sync_reservas
after update of status, starts_at, ends_at, setup_minutes, teardown_minutes, name, ministry_id on public.meetings
for each row execute function public.meetings_sync_reservas();
drop trigger if exists meetings_sync_reservas_borrar on public.meetings;
create trigger meetings_sync_reservas_borrar
before delete on public.meetings
for each row execute function public.meetings_sync_reservas();

create or replace function public.meeting_spaces_sync_reservas()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sincronizar_reservas_reunion(coalesce(new.meeting_id, old.meeting_id));
  return null;
end;
$$;

drop trigger if exists meeting_spaces_sync_reservas on public.meeting_spaces;
create trigger meeting_spaces_sync_reservas
after insert or delete on public.meeting_spaces
for each row execute function public.meeting_spaces_sync_reservas();

-- ── 4. Disponibilidad para escoger espacios ─────────────────────────────

-- Espacios de la sede y si están libres en esa franja con montaje y
-- desmonte. No dice de quién es la otra reserva: solo la franja ocupada.
create or replace function public.disponibilidad_espacios(
  p_starts timestamptz, p_ends timestamptz,
  p_setup_minutes int default 120, p_teardown_minutes int default 60,
  p_meeting_id uuid default null
)
returns table (
  space_id        uuid,
  name            text,
  capacity        int,
  booking_policy  text,
  libre           boolean,
  ocupado_desde   timestamptz,
  ocupado_hasta   timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.capacity, s.booking_policy,
         c.desde is null, c.desde, c.hasta
    from public.spaces s
    left join lateral (
      select lower(b.time_range) as desde, upper(b.time_range) as hasta
        from public.bookings b
       where b.space_id = s.id and b.status in ('requested', 'approved')
         and b.shared_occupancy_allowed = false and b.is_recurrence_template = false
         and (p_meeting_id is null or b.meeting_id is distinct from p_meeting_id)
         and b.time_range && tstzrange(p_starts - make_interval(mins => greatest(p_setup_minutes, 0)),
                                       p_ends + make_interval(mins => greatest(p_teardown_minutes, 0)), '[)')
       order by lower(b.time_range) limit 1
    ) c on true
   where public.has_permission('servir.planear')
     and s.status = 'active'
     and p_ends > p_starts
   order by s.name;
$$;

revoke all on function public.sincronizar_reservas_reunion(uuid) from public, anon, authenticated;
revoke all on function public.avisar_reserva_reunion(public.bookings, public.meetings) from public, anon, authenticated;
revoke all on function public.meetings_sync_reservas() from public, anon, authenticated;
revoke all on function public.meeting_spaces_sync_reservas() from public, anon, authenticated;
revoke all on function public.disponibilidad_espacios(timestamptz, timestamptz, int, int, uuid) from public, anon;
grant execute on function public.disponibilidad_espacios(timestamptz, timestamptz, int, int, uuid) to authenticated;
