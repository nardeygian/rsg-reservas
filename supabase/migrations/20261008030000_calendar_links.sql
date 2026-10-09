-- Enlace entre eventos de Asana (Calendario RSG) y reservas del portal
-- Permite a Planeación, pastores de ministerio/sede y super_admin enlazar reuniones con espacios

create table if not exists public.calendar_links (
  id          uuid   primary key default gen_random_uuid(),
  asana_gid   text   not null unique,
  booking_id  uuid   not null references public.bookings(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists calendar_links_booking_id_idx on public.calendar_links (booking_id);

alter table public.calendar_links enable row level security;

-- Lectura: cualquier usuario autenticado
create policy "calendar_links: lectura autenticada"
  on public.calendar_links for select to authenticated
  using (true);

-- Escritura: pastores de ministerio/sede, super_admin, o lider_departamento de Planeación
create policy "calendar_links: escritura planeación y pastores"
  on public.calendar_links for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and role in ('pastor_sede', 'pastor_ministerio', 'super_admin')
    )
    or exists (
      select 1 from public.user_roles ur
      join public.ministries m on m.id = ur.ministry_id
      where ur.user_id = (select auth.uid())
        and ur.role = 'lider_departamento'
        and m.name = 'Planeación'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and role in ('pastor_sede', 'pastor_ministerio', 'super_admin')
    )
    or exists (
      select 1 from public.user_roles ur
      join public.ministries m on m.id = ur.ministry_id
      where ur.user_id = (select auth.uid())
        and ur.role = 'lider_departamento'
        and m.name = 'Planeación'
    )
  );
