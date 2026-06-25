-- =====================================================================
-- RSG Reservas — esquema inicial
-- =====================================================================
-- Crea todo el esquema base:
--   * Extensiones
--   * Tablas: organizations, spaces, ministries, profiles, bookings, booking_audit
--   * Exclusion constraint anti-solapamiento
--   * Triggers (updated_at, time_range con buffers, profile auto-creación, bitácora)
--   * Row Level Security + función auxiliar current_role_is
--   * Policies por tabla
--   * Vistas bookings_calendar (pública) y bookings_staff (RLS-respetada)
--   * Revoke + grants para que el cliente nunca consulte bookings directo
-- Referencia: docs/02-modelo-de-datos.md y docs/03-roles-y-visibilidad.md.

-- =====================================================================
-- Extensiones
-- =====================================================================
create extension if not exists "btree_gist";

-- =====================================================================
-- Tablas
-- =====================================================================

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('church','external')),
  created_at timestamptz not null default now()
);

create table spaces (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,
  capacity                int,
  status                  text not null default 'active'
                            check (status in ('active','disabled','external')),
  managed_by_org_id       uuid references organizations(id),
  booking_policy          text not null default 'self_serve'
                            check (booking_policy in ('self_serve','needs_approval')),
  allows_shared_occupancy boolean not null default false,
  setup_buffer_minutes    int not null default 0,
  teardown_buffer_minutes int not null default 0,
  notes                   text,
  created_at              timestamptz not null default now()
);

create table ministries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null check (type in ('departamento','ministerio')),
  lead_user_id  uuid,
  created_at    timestamptz not null default now()
);

create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null,
  role                 text not null default 'leader'
                         check (role in ('leader','pastor_sede','admin_casa','studio_admin','super_admin')),
  ministry_id          uuid references ministries(id),
  calendar_feed_token  uuid not null unique default gen_random_uuid(),
  slack_user_id        text,        -- formato U0123ABCD; necesario para DMs de Slack
  created_at           timestamptz not null default now()
);

alter table ministries
  add constraint ministries_lead_user_id_fkey
  foreign key (lead_user_id) references profiles(id);

create table bookings (
  id                       uuid primary key default gen_random_uuid(),
  space_id                 uuid not null references spaces(id),
  owner_org_id             uuid not null references organizations(id),
  created_by               uuid not null references profiles(id),
  ministry_id              uuid references ministries(id),
  title                    text,
  use_type                 text not null
                             check (use_type in (
                               'reunion_departamento','reunion_ministerio',
                               'consejeria','discipulado','evento',
                               'externo','studio_negocio','otro')),
  visibility               text not null default 'full'
                             check (visibility in ('full','limited','private_label')),
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  time_range               tstzrange,
  status                   text not null default 'requested'
                             check (status in ('requested','approved','rejected','cancelled')),
  shared_occupancy_allowed boolean not null default false,
  montaje_lock             boolean not null default false,
  expected_attendance      int,
  requirements             jsonb not null default '{}'::jsonb,
  payment_status           text not null default 'not_applicable'
                             check (payment_status in ('not_applicable','pending','paid')),
  payment_marked_by        uuid references profiles(id),
  payment_receipt_url      text,
  recurrence_rule          text,
  is_recurrence_template   boolean not null default false,
  parent_booking_id        uuid references bookings(id) on delete cascade,
  internal_notes           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table booking_audit (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  actor_id    uuid references profiles(id),
  action      text not null,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Exclusion constraint anti-solapamiento
-- =====================================================================
alter table bookings add constraint bookings_no_overlap
exclude using gist (
  space_id with =,
  time_range with &&
) where (
  status in ('requested','approved')
  and shared_occupancy_allowed = false
  and is_recurrence_template = false
);

-- =====================================================================
-- Triggers
-- =====================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bookings_updated_at
before update on bookings
for each row execute function set_updated_at();

-- time_range incluye buffers del espacio para que la exclusion constraint los aplique
create or replace function set_booking_time_range()
returns trigger as $$
declare
  setup_min int := 0;
  teardown_min int := 0;
begin
  select coalesce(setup_buffer_minutes, 0), coalesce(teardown_buffer_minutes, 0)
    into setup_min, teardown_min
    from spaces where id = new.space_id;
  new.time_range := tstzrange(
    new.starts_at - make_interval(mins => setup_min),
    new.ends_at + make_interval(mins => teardown_min),
    '[)'
  );
  return new;
end;
$$ language plpgsql;

create trigger bookings_time_range
before insert or update of starts_at, ends_at, space_id on bookings
for each row execute function set_booking_time_range();

-- Auto-creación de profile al registrarse en Auth
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'leader'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();

-- Bitácora automática de cambios en bookings
create or replace function log_booking_changes()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  action_label text;
begin
  if tg_op = 'INSERT' then
    action_label := 'created';
  elsif new.status is distinct from old.status then
    action_label := 'status_' || new.status;
  elsif new.payment_status is distinct from old.payment_status then
    action_label := 'payment_' || new.payment_status;
  else
    action_label := 'updated';
  end if;

  insert into public.booking_audit (booking_id, actor_id, action, changes)
  values (
    new.id,
    auth.uid(),
    action_label,
    case
      when tg_op = 'INSERT' then to_jsonb(new)
      else jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    end
  );
  return new;
end;
$$;

create trigger bookings_audit
after insert or update on bookings
for each row execute function log_booking_changes();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles enable row level security;
alter table bookings enable row level security;
alter table booking_audit enable row level security;

-- security definer corre como el owner (postgres en Supabase), que tiene BYPASSRLS,
-- así que la subquery a profiles no recurse las policies de profiles.
create or replace function current_role_is(roles text[])
returns boolean
language sql
security definer
stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = any(roles)
  );
$$;

-- profiles
create policy "ver mi perfil"
  on profiles for select
  using (id = auth.uid() or current_role_is(array['pastor_sede','admin_casa','super_admin']));

create policy "editar mi perfil"
  on profiles for update
  using (id = auth.uid());

-- bookings
create policy "leer detalle staff"
  on bookings for select
  using (
    current_role_is(array['pastor_sede','admin_casa','super_admin'])
    or (
      current_role_is(array['studio_admin'])
      and space_id = (select id from spaces where slug = 'estudio')
    )
  );

create policy "crear reserva propia"
  on bookings for insert
  with check (
    created_by = auth.uid()
    and (
      current_role_is(array['leader','pastor_sede','admin_casa','super_admin'])
      or (
        current_role_is(array['studio_admin'])
        and space_id = (select id from spaces where slug = 'estudio')
      )
    )
  );

create policy "editar mi reserva pendiente"
  on bookings for update
  using (created_by = auth.uid() and status = 'requested');

create policy "gestionar reservas staff"
  on bookings for update
  using (current_role_is(array['pastor_sede','admin_casa','super_admin']));

-- booking_audit (escritura solo via trigger security definer; aquí solo SELECT)
create policy "leer bitácora staff"
  on booking_audit for select
  using (current_role_is(array['pastor_sede','admin_casa','super_admin']));

-- =====================================================================
-- Vistas
-- =====================================================================

-- bookings_calendar: pública, columnas seguras, corre como su owner
create or replace view bookings_calendar
with (security_invoker = false) as
select
  b.id,
  b.space_id,
  s.name as space_name,
  b.starts_at,
  b.ends_at,
  b.status,
  case
    when b.visibility = 'private_label' then 'Reserva Studio Prado'
    else coalesce(m.name, 'RSG')
  end as display_owner,
  case
    when b.visibility = 'private_label' then null
    else b.use_type
  end as use_type,
  case when b.montaje_lock then true else false end as has_montaje_lock
from bookings b
join spaces s on s.id = b.space_id
left join ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;

-- bookings_staff: detalle completo, respeta RLS del invocador
create or replace view bookings_staff
with (security_invoker = true) as
select * from bookings
where is_recurrence_template = false;

-- =====================================================================
-- Revoke acceso directo + grants vía vistas
-- =====================================================================
revoke select on bookings from anon, authenticated;

grant select on bookings_calendar to anon, authenticated;
grant select on bookings_staff to authenticated;
