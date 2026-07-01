-- =====================================================================
-- RSG Reservas — nuevo rol "mentor"
-- =====================================================================
-- Los mentores pueden reservar en todos los espacios pero con un
-- catálogo de use_type reducido (discipulado, consejería, otro). El
-- filtro visual se aplica en el form; aquí solo aseguramos que:
--   1. El rol pueda vivir en profiles.role y en profiles.requested_role.
--   2. La policy de INSERT los deje crear reservas propias.
--
-- Las mismas restricciones de visibilidad que un líder aplican
-- automáticamente porque el mentor no está en STAFF_ROLES ni en las
-- policies de "leer detalle staff" o "gestionar reservas staff".

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('leader', 'mentor', 'pastor_sede', 'admin_casa', 'studio_admin', 'super_admin'));

alter table public.profiles drop constraint profiles_requested_role_check;
alter table public.profiles add constraint profiles_requested_role_check
  check (requested_role in ('lider_departamento', 'pastor_ministerio', 'pastor_sede', 'mentor'));

alter policy "crear reserva propia" on public.bookings
  with check (
    created_by = (select auth.uid())
    and (
      (select current_role_is(array['leader', 'mentor', 'pastor_sede', 'admin_casa', 'super_admin']))
      or (
        (select current_role_is(array['studio_admin']))
        and space_id = (select id from spaces where slug = 'estudio')
      )
    )
  );
