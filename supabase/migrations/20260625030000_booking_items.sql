-- =====================================================================
-- RSG Reservas — items por reserva (fase 2)
-- =====================================================================
-- Una reserva interna puede pedir sillas, micrófonos, sonido, etc. Cada
-- línea es (booking_id, item_id, quantity). El precio se snapshot-ea al
-- momento de reservar para reportes futuros, aunque internamente no
-- cobremos nada.
--
-- items_available(_starts, _ends, _exclude_booking) devuelve la cantidad
-- libre de cada item activo en un rango de tiempo, considerando TODAS las
-- reservas activas que se solapan (incluida la propia si se pasa el
-- _exclude_booking).

create table booking_items (
  booking_id                uuid not null references bookings(id) on delete cascade,
  item_id                   uuid not null references rentable_items(id) on delete restrict,
  quantity                  int  not null check (quantity > 0),
  unit_price_cents_snapshot int  not null check (unit_price_cents_snapshot >= 0),
  primary key (booking_id, item_id)
);

create index booking_items_item_id_idx on booking_items(item_id);

alter table booking_items enable row level security;

-- Staff lee todo; el creador solo puede leer/modificar las líneas de su propia reserva.
create policy "leer booking_items"
  on booking_items for select
  to authenticated
  using (
    current_role_is(array['pastor_sede','admin_casa','super_admin'])
    or exists (
      select 1 from bookings b
      where b.id = booking_id and b.created_by = auth.uid()
    )
  );

create policy "modificar booking_items"
  on booking_items for all
  to authenticated
  using (
    current_role_is(array['pastor_sede','admin_casa','super_admin'])
    or exists (
      select 1 from bookings b
      where b.id = booking_id and b.created_by = auth.uid()
    )
  )
  with check (
    current_role_is(array['pastor_sede','admin_casa','super_admin'])
    or exists (
      select 1 from bookings b
      where b.id = booking_id and b.created_by = auth.uid()
    )
  );

-- =====================================================================
-- items_available: cuánto queda de cada item en un rango
-- =====================================================================
create or replace function items_available(
  _starts timestamptz,
  _ends   timestamptz,
  _exclude_booking uuid default null
)
returns table (item_id uuid, name text, available int)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    ri.id,
    ri.name,
    ri.total_quantity - coalesce((
      select sum(bi.quantity)::int
      from booking_items bi
      join bookings b on b.id = bi.booking_id
      where bi.item_id = ri.id
        and b.status in ('requested','approved')
        and b.is_recurrence_template = false
        and b.time_range && tstzrange(_starts, _ends, '[)')
        and (_exclude_booking is null or b.id != _exclude_booking)
    ), 0) as available
  from rentable_items ri
  where ri.active = true
  order by ri.name;
$$;

grant execute on function items_available(timestamptz, timestamptz, uuid) to authenticated;
revoke execute on function items_available(timestamptz, timestamptz, uuid) from anon, public;
