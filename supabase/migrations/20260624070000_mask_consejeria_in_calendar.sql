-- =====================================================================
-- RSG Reservas — enmascarar consejería en bookings_calendar
-- =====================================================================
-- La consejería es información pastoral sensible. Aunque la vista pública
-- nunca expone created_by ni revela directamente quién apartó, el nombre
-- del ministerio (display_owner) y el title pueden delatar a la persona.
-- Para roles no-staff, los enmascaramos: aparece "Consejería privada"
-- sin más detalle. La franja y el espacio siguen visibles (el calendario
-- los necesita para evitar dobles reservas).
--
-- Staff (pastor/admin/super_admin) sigue viendo todo a través de
-- bookings_staff, que tiene el detalle completo.

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
    when b.use_type = 'consejeria' then 'Consejería privada'
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
  end as title
from bookings b
join spaces s on s.id = b.space_id
left join ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;
