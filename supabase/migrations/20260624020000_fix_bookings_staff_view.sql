-- =====================================================================
-- RSG Reservas — corregir bookings_staff
-- =====================================================================
-- Problema: la vista anterior usaba security_invoker = true, así que la
-- consulta corría como el usuario logueado, y como `bookings` tiene
-- revoke select de authenticated (por diseño en docs/03), cualquier
-- staff intentando leer la vista recibía "permission denied for table
-- bookings". Síntoma: /aprobaciones rota, contadores en cero.
--
-- Solución: la vista corre como su owner (BYPASSRLS) y el control de
-- acceso se hace en el WHERE usando current_role_is(). Equivalente
-- semántico a las policies de RLS sobre bookings, pero aplicado dentro
-- de la vista para que el cliente nunca toque la tabla cruda.

create or replace view bookings_staff
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
