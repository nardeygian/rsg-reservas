-- =====================================================================
-- RSG Reservas — exponer parent_booking_id en bookings_calendar
-- =====================================================================
-- Para que la UI sepa cuándo una reserva es parte de una serie semanal
-- sin necesidad de SELECT directo sobre `bookings` (los líderes no la
-- tienen). El UUID del template no expone info sensible por sí solo.

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
    else b.title
  end as title,
  b.parent_booking_id
from bookings b
join spaces s on s.id = b.space_id
left join ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;
