-- =====================================================================
-- RSG Reservas — bookings_calendar gana created_by y title
-- =====================================================================
-- created_by lo necesita la página de detalle para que un líder pueda
-- saber si la reserva es suya (y por ende habilitar Cancelar). Es solo
-- un UUID; no permite ver el perfil del otro porque profiles RLS sigue
-- restringiendo.
--
-- title se expone porque el calendario tampoco lo mostraba, y en el
-- detalle es razonable que cualquier rol lo vea. Para private_label del
-- Estudio se enmascara junto con el resto.

-- Postgres no permite reordenar ni renombrar columnas con CREATE OR REPLACE VIEW,
-- así que las nuevas (created_by, title) van al final.
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
  case when b.montaje_lock then true else false end as has_montaje_lock,
  b.created_by,
  case
    when b.visibility = 'private_label' then null
    else b.title
  end as title
from bookings b
join spaces s on s.id = b.space_id
left join ministries m on m.id = b.ministry_id
where b.is_recurrence_template = false;
