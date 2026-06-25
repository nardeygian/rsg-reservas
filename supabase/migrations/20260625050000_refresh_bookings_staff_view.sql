-- =====================================================================
-- RSG Reservas — refrescar bookings_staff para incluir columnas externas
-- =====================================================================
-- Postgres no actualiza la lista de columnas de un `select b.*` cuando
-- se le agregan columnas a la tabla origen. Hay que DROP + CREATE.
--
-- Las columnas que faltaban: is_external, client_name, client_email,
-- client_phone, client_token, total_cents. Sin estas, la consulta del
-- staff en /aprobaciones devuelve nulls para externas → la UI las
-- mostraba sin cliente ni link al comprobante.

drop view if exists bookings_staff;

create view bookings_staff
with (security_invoker = false) as
select b.*
from bookings b
where b.is_recurrence_template = false
  and (
    current_role_is(array['pastor_sede','admin_casa','super_admin'])
    or (
      current_role_is(array['studio_admin'])
      and b.space_id = (select id from spaces where slug = 'estudio')
    )
  );

grant select on bookings_staff to authenticated;
