-- =====================================================================
-- RSG Reservas — cancelación por el creador + cierre de hueco RLS
-- =====================================================================
-- 1. La policy `editar mi reserva pendiente` no tenía WITH CHECK, así que
--    el creador podía hacer self-update de `status` (incluyendo
--    'approved'). Lo cerramos: el creador sí edita la reserva mientras
--    está pendiente, pero el nuevo registro debe seguir siendo suyo y
--    en estado 'requested'.
-- 2. Nueva policy para cancelar: el creador puede mover su reserva a
--    'cancelled' desde 'requested' o 'approved'. Cualquier otra
--    transición de status la sigue manejando el staff vía la policy
--    `gestionar reservas staff`.

alter policy "editar mi reserva pendiente" on bookings
  with check (created_by = auth.uid() and status = 'requested');

create policy "cancelar mi reserva"
  on bookings for update
  using (created_by = auth.uid() and status in ('requested','approved'))
  with check (created_by = auth.uid() and status = 'cancelled');
