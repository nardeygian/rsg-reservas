-- =====================================================================
-- RSG Reservas — permitir al studio_admin aprobar y anotar reservas del Estudio
-- =====================================================================
-- Hasta ahora el studio_admin podía LEER y CREAR reservas del Estudio,
-- pero la única policy de UPDATE sobre bookings era para staff de la
-- iglesia (pastor_sede, admin_casa, super_admin). Esta migración agrega
-- una policy adicional que le permite al studio_admin actualizar
-- (aprobar/rechazar/anotar) las reservas que afectan al espacio Estudio.

create policy "gestionar reservas estudio"
on public.bookings
for update
to authenticated
using (
  current_role_is(array['studio_admin'])
  and space_id = (select id from spaces where slug = 'estudio')
)
with check (
  current_role_is(array['studio_admin'])
  and space_id = (select id from spaces where slug = 'estudio')
);
