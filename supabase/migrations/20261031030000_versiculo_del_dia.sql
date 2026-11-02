-- =====================================================================
-- Inicio — versículo del día
-- =====================================================================
-- Pedido de Gian (31 oct): en el Inicio, en lugar de lo recaudado del mes,
-- un versículo distinto cada día, el mismo para todos. Textos de los
-- Evangelios, el resto del Nuevo Testamento, Salmos y Proverbios (NVI).
--
-- * daily_verses: la lista. La cita va aparte del texto para poder cambiar
--   de dónde sale el texto sin tocar la lista.
-- * versiculo_del_dia(): recorre la lista en orden según la fecha de hoy
--   en la zona de la organización; no repite hasta terminarla.
-- * Leer: cualquier usuario con sesión. Editar: solo el super admin.
-- Los datos van en supabase/semillas/versiculos_nvi.sql.
-- Migración aditiva e idempotente.
-- =====================================================================

create table if not exists public.daily_verses (
  id           uuid primary key default gen_random_uuid(),
  sort         int not null unique,
  reference    text not null,
  text         text not null,
  translation  text not null default 'NVI',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.daily_verses enable row level security;

drop policy if exists "daily_verses: lectura" on public.daily_verses;
create policy "daily_verses: lectura" on public.daily_verses for select to authenticated using (true);
drop policy if exists "daily_verses: escritura super_admin" on public.daily_verses;
create policy "daily_verses: escritura super_admin" on public.daily_verses for all to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

grant select on public.daily_verses to authenticated;

-- Mismo versículo para todos en el mismo día local.
create or replace function public.versiculo_del_dia()
returns table (reference text, text text, translation text)
language sql stable
set search_path = public, pg_temp
as $$
  with activos as (
    select v.reference, v.text, v.translation,
           row_number() over (order by v.sort) - 1 as n,
           count(*) over () as total
      from public.daily_verses v
     where v.active
  )
  select a.reference, a.text, a.translation
    from activos a
   where a.n = ((((now() at time zone 'America/Bogota')::date - date '2026-01-01') % a.total) + a.total) % a.total;
$$;

revoke all on function public.versiculo_del_dia() from public, anon;
grant execute on function public.versiculo_del_dia() to authenticated;
