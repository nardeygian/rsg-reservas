-- =====================================================================
-- RSG Reservas — catálogo de alquiler (fase 1 de externos)
-- =====================================================================
-- 1. Cada espacio gana hourly_rate_cents. NULL = no se alquila por la
--    plataforma (caso del Estudio, que administra Studio Prado aparte).
-- 2. Nueva tabla rentable_items para sillas, micrófonos, mesas, sonido…
--    cada uno con cantidad disponible y precio fijo por reserva.
-- 3. Policies: pastor_sede / admin_casa / super_admin gestionan ambos.

alter table spaces
  add column hourly_rate_cents int
    check (hourly_rate_cents is null or hourly_rate_cents >= 0);
comment on column spaces.hourly_rate_cents is
  'Tarifa por hora en centavos de COP para alquiler externo. NULL = no rentable por la plataforma.';

create table rentable_items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  unit_price_cents    int not null check (unit_price_cents >= 0),
  total_quantity      int not null check (total_quantity >= 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger rentable_items_updated_at
  before update on rentable_items
  for each row execute function set_updated_at();

alter table rentable_items enable row level security;

create policy "leer items autenticados"
  on rentable_items for select
  to authenticated
  using (true);

create policy "gestionar items staff"
  on rentable_items for all
  to authenticated
  using (current_role_is(array['pastor_sede','admin_casa','super_admin']))
  with check (current_role_is(array['pastor_sede','admin_casa','super_admin']));

-- Antes solo super_admin podía gestionar espacios; ahora también pastor de sede
-- y admin de casa, para que puedan ajustar tarifas.
drop policy "gestionar spaces super_admin" on spaces;
create policy "gestionar spaces staff"
  on spaces for all
  to authenticated
  using (current_role_is(array['pastor_sede','admin_casa','super_admin']))
  with check (current_role_is(array['pastor_sede','admin_casa','super_admin']));
