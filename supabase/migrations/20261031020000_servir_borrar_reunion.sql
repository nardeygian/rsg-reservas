-- =====================================================================
-- Etapa 5 · Servir — borrar reuniones: solo el super admin
-- =====================================================================
-- Decisión de Gian (31 oct): cualquier reunión se puede borrar, en
-- cualquier estado (también en vivo o cerrada), pero solo el super admin.
-- Se borran en cascada su orden, equipo asignado, asistencia e historial;
-- el trigger meetings_sync_reservas_borrar libera sus reservas de espacios.
-- Planeación sigue pudiendo cancelar (queda en el historial).
-- =====================================================================

drop policy if exists "meetings: borrar" on public.meetings;
create policy "meetings: borrar" on public.meetings for delete to authenticated
  using ((select public.is_super_admin()));
