-- RSG Portal — roles múltiples por usuario + seed de departamentos y ministerios
-- Aprobado por Gian el 2026-10-08

-- ── 1. Seed de ministerios y departamentos ──────────────────────────────────
insert into public.ministries (name, type) values
  ('Creativos',           'departamento'),
  ('Protocolo',           'departamento'),
  ('Planeación',          'departamento'),
  ('Semillas',            'departamento'),
  ('Vida en Comunidad',   'departamento'),
  ('Casa de Formación',   'departamento'),
  ('Roadies',             'departamento'),
  ('LMRSG',               'departamento'),
  ('Hombres',             'ministerio'),
  ('Mujeres',             'ministerio'),
  ('Jóvenes',             'ministerio'),
  ('Mayores con Propósito','ministerio'),
  ('Sesiones de Vida',    'ministerio')
on conflict do nothing;

-- ── 2. Tabla de roles adicionales ───────────────────────────────────────────
-- El rol primario (para autorización de reservas) sigue en profiles.role.
-- user_roles almacena roles adicionales, cada uno opcionalmente vinculado
-- a un departamento o ministerio.

create table if not exists public.user_roles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  role        text        not null check (role in (
                'lider_departamento',
                'pastor_ministerio',
                'mentor'
              )),
  ministry_id uuid        references public.ministries(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, role, ministry_id)
);

-- Índice de búsqueda por usuario
create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
alter table public.user_roles enable row level security;

-- Cada usuario puede ver sus propios roles; super_admin ve todos
create policy "user_roles: lectura propia y super_admin"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Solo super_admin puede escribir
create policy "user_roles: escritura solo super_admin"
  on public.user_roles
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- ── 4. lead_user_id → user_roles (limpieza futura, no rompemos ahora) ───────
-- ministries.lead_user_id se mantiene por compatibilidad con código existente.
-- En el futuro se puede deprecar cuando user_roles esté bien adoptado.
