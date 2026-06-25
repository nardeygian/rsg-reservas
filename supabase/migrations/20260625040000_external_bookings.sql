-- =====================================================================
-- RSG Reservas — reservas externas (fase 3)
-- =====================================================================
-- Permite que terceros sin cuenta reserven espacios vía link público.
-- created_by deja de ser obligatorio. Para bookings con is_external=true
-- exigimos en su lugar client_name, client_email y client_token (UUID
-- secreto que le entregamos al cliente).
--
-- Las inserciones externas las hace el server action vía service_role,
-- así que no creamos policy de insert para anon. Solo damos a anon
-- acceso a las pistas mínimas (busy_slots, items_available) para que el
-- form muestre disponibilidad sin revelar detalles.

alter table bookings alter column created_by drop not null;

alter table bookings
  add column is_external  boolean not null default false,
  add column client_name  text,
  add column client_email text,
  add column client_phone text,
  add column client_token uuid unique,
  add column total_cents  int;

-- Coherencia: o es interna con created_by, o es externa con los campos del cliente.
alter table bookings add constraint bookings_creator_or_external check (
  (is_external = false and created_by is not null)
  or (
    is_external = true
    and client_name is not null
    and client_email is not null
    and client_token is not null
  )
);

-- bookings_calendar: reservas externas se muestran como "Alquiler externo"
-- sin más detalle. La franja y el espacio sí aparecen (eso queremos —
-- ese es el sentido de mostrarlo en el calendario).
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
  b.parent_booking_id
from bookings b
join spaces s on s.id = b.space_id
left join ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;

-- busy_slots: vista mínima para el form público. Solo espacio + franja.
create or replace view busy_slots
with (security_invoker = false) as
select
  b.id,
  b.space_id,
  b.starts_at,
  b.ends_at
from bookings b
where b.status in ('requested','approved')
  and b.is_recurrence_template = false;

grant select on busy_slots to anon, authenticated;

-- Permitir que anon consulte items_available al ir armando la reserva.
grant execute on function items_available(timestamptz, timestamptz, uuid) to anon;
