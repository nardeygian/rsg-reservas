-- =====================================================================
-- RSG Reservas — clientes externos del Estudio (privacidad reforzada)
-- =====================================================================
-- Cambios:
--
--   1. La vista pública del calendario muestra "Reserva externa" en
--      lugar de "Reserva Studio Prado" — es la etiqueta que el equipo
--      usa en voz alta.
--
--   2. Endurecemos `leer detalle staff`: pastores de sede y admin de
--      casa dejan de ver las reservas private_label (clientes externos
--      del Estudio). super_admin sigue viendo todo (dueña de la
--      plataforma) y studio_admin sigue viendo lo del Estudio.
--      Las reservas private_label solo deben revelar fecha/hora/franja
--      ocupada al resto.

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
    when b.visibility = 'private_label' then 'Reserva externa'
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

grant select on bookings_calendar to anon, authenticated;

alter policy "leer detalle staff" on public.bookings
  using (
    (select current_role_is(array['super_admin']))
    or (
      (select current_role_is(array['pastor_sede', 'admin_casa']))
      and visibility <> 'private_label'
    )
    or (
      (select current_role_is(array['studio_admin']))
      and space_id = (select id from spaces where slug = 'estudio')
    )
  );
