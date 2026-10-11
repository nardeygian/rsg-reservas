-- RSG Reservas — acceso a reservas para pastor_ministerio
-- Un pastor de ministerio puede ver el detalle completo de reservas
-- (excepto private_label) y aprobar/rechazar, igual que pastor_sede.

alter policy "leer detalle staff" on public.bookings
  using (
    (select current_role_is(array['super_admin']))
    or (
      (select current_role_is(array['pastor_sede', 'admin_casa', 'pastor_ministerio']))
      and visibility <> 'private_label'
    )
    or (
      (select current_role_is(array['studio_admin']))
      and space_id = (select id from spaces where slug = 'estudio')
    )
  );

alter policy "gestionar reservas staff" on public.bookings
  using (current_role_is(array['pastor_sede', 'admin_casa', 'super_admin', 'pastor_ministerio']));

alter policy "leer bitácora staff" on public.booking_audit
  using (current_role_is(array['pastor_sede', 'admin_casa', 'super_admin', 'pastor_ministerio']));
