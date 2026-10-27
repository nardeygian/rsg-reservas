-- =====================================================================
-- Etapa 5 · Servir — personas, discipulados y equipos
-- =====================================================================
-- Directorio único de personas: un servidor puede ser discípulo o no, y la
-- misma persona deja de estar duplicada entre Servicio, Discipulados y Dar.
-- Los ids heredados del JSON (servicio_data) se conservan en legacy_* para
-- que la migración de datos se pueda correr varias veces.
-- Las políticas RLS van en 20261028050000_servir_rls.sql.
-- =====================================================================

-- ── Discipulados ────────────────────────────────────────────────────────
-- Conserva los ids de texto del JSON (p. ej. 'gian-camila').
create table if not exists public.discipleship_groups (
  id               text primary key,
  name             text not null,
  leader_user_ids  uuid[] not null default '{}',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Personas ────────────────────────────────────────────────────────────
create table if not exists public.people (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  phone                  text,
  email                  text,
  profile_id             uuid unique references public.profiles(id) on delete set null,
  discipleship_group_id  text references public.discipleship_groups(id) on delete set null,
  legacy_disciple_id     text unique,   -- id del discípulo en servicio_data.miembros
  legacy_servant_id      text unique,   -- id del servidor en servicio_data.servidores
  active                 boolean not null default true,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists people_group_idx on public.people (discipleship_group_id);
create index if not exists people_name_idx on public.people (lower(full_name));

-- ── Áreas dentro de un departamento ─────────────────────────────────────
create table if not exists public.areas (
  id           uuid primary key default gen_random_uuid(),
  ministry_id  uuid not null references public.ministries(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (ministry_id, name)
);

-- El alcance de lider_area (columna creada en la migración de permisos).
alter table public.user_roles drop constraint if exists user_roles_area_id_fkey;
alter table public.user_roles
  add constraint user_roles_area_id_fkey foreign key (area_id) references public.areas(id) on delete cascade;

-- ── Equipos: quién pertenece a qué departamento / área ──────────────────
create table if not exists public.team_members (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.people(id) on delete cascade,
  ministry_id  uuid not null references public.ministries(id) on delete cascade,
  area_id      uuid references public.areas(id) on delete set null,
  active       boolean not null default true,
  joined_at    timestamptz not null default now()
);

create unique index if not exists team_members_unq
  on public.team_members (person_id, ministry_id, coalesce(area_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists team_members_ministry_idx on public.team_members (ministry_id);

-- ── Posiciones: dónde se puede servir ("Guitarra eléctrica", "Luces"…) ──
create table if not exists public.positions (
  id           uuid primary key default gen_random_uuid(),
  ministry_id  uuid not null references public.ministries(id) on delete cascade,
  area_id      uuid references public.areas(id) on delete set null,
  name         text not null,
  description  text,
  sort         int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (ministry_id, name)
);

-- En qué posiciones puede servir cada persona
create table if not exists public.person_positions (
  person_id    uuid not null references public.people(id) on delete cascade,
  position_id  uuid not null references public.positions(id) on delete cascade,
  primary key (person_id, position_id)
);

-- ── Fechas en que alguien no puede servir ───────────────────────────────
create table if not exists public.availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  reason      text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists availability_blocks_person_idx on public.availability_blocks (person_id, starts_on);

-- ── updated_at automático ───────────────────────────────────────────────
-- set_updated_at() ya existe desde el esquema inicial.
drop trigger if exists people_updated_at on public.people;
create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();
drop trigger if exists discipleship_groups_updated_at on public.discipleship_groups;
create trigger discipleship_groups_updated_at before update on public.discipleship_groups
  for each row execute function public.set_updated_at();

-- ── Funciones de apoyo ──────────────────────────────────────────────────

-- La persona del usuario que está consultando (null si su cuenta aún no
-- está unida a una persona).
create or replace function public.current_person_id()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.people where profile_id = auth.uid();
$$;

-- Roles efectivos con su alcance, ahora incluyendo el liderazgo de
-- discipulados (reemplaza la versión de la migración de permisos).
create or replace function public.my_role_scopes()
returns table (role text, scope_type text, scope_id text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.role, null::text, null::text
    from public.profiles p
   where p.id = auth.uid()
  union all
  select ur.role,
         case when ur.area_id is not null then 'area' when ur.ministry_id is not null then m.type end,
         coalesce(ur.area_id::text, ur.ministry_id::text)
    from public.user_roles ur
    left join public.ministries m on m.id = ur.ministry_id
   where ur.user_id = auth.uid()
  union all
  select 'lider_discipulado', 'discipulado', g.id
    from public.discipleship_groups g
   where auth.uid() = any (g.leader_user_ids)
$$;
