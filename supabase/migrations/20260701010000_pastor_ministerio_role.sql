-- =====================================================================
-- RSG Reservas — nuevo rol "pastor_ministerio"
-- =====================================================================
-- Alias del líder con nombre propio: pastor de ministerio tiene los
-- mismos accesos que un líder de departamento (no es staff con detalle,
-- no aprueba, no ve private_label). Vive como valor separado en
-- profiles.role para que el usuario se identifique con su rol real.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'leader',
    'mentor',
    'pastor_ministerio',
    'pastor_sede',
    'admin_casa',
    'studio_admin',
    'super_admin'
  ));

alter policy "crear reserva propia" on public.bookings
  with check (
    created_by = (select auth.uid())
    and (
      (select current_role_is(array[
        'leader', 'mentor', 'pastor_ministerio', 'pastor_sede', 'admin_casa', 'super_admin'
      ]))
      or (
        (select current_role_is(array['studio_admin']))
        and space_id = (select id from spaces where slug = 'estudio')
      )
    )
  );
