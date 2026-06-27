-- =====================================================================
-- RSG Reservas — optimización de RLS y índices de foreign keys
-- =====================================================================
-- Dos arreglos que reporta el advisor de Supabase:
--
--   1. RLS init plan: las policies que llaman directo a `auth.uid()` o
--      a `current_role_is()` los reevalúan por CADA fila. Envolvemos en
--      `(select ...)` para que se evalúen una sola vez por query.
--
--   2. Foreign keys sin índice: cada join sobre esas FK hace seq scan.
--      Las que se usan con frecuencia (bookings_staff view) son el
--      cuello más grueso.

-- ── 1. Reescribir policies con (select auth.uid()) ────────────────────

alter policy "editar mi perfil" on public.profiles
  using (id = (select auth.uid()));

alter policy "ver mi perfil" on public.profiles
  using (
    id = (select auth.uid())
    or (select current_role_is(array['pastor_sede','admin_casa','super_admin']))
  );

alter policy "cancelar mi reserva" on public.bookings
  using (
    created_by = (select auth.uid())
    and status = any(array['requested'::text, 'approved'::text])
  )
  with check (
    created_by = (select auth.uid())
    and status = 'cancelled'::text
  );

alter policy "crear reserva propia" on public.bookings
  with check (
    created_by = (select auth.uid())
    and (
      (select current_role_is(array['leader','pastor_sede','admin_casa','super_admin']))
      or (
        (select current_role_is(array['studio_admin']))
        and space_id = (select id from spaces where slug = 'estudio')
      )
    )
  );

alter policy "editar mi reserva pendiente" on public.bookings
  using (
    created_by = (select auth.uid())
    and status = 'requested'::text
  )
  with check (
    created_by = (select auth.uid())
    and status = 'requested'::text
  );

alter policy "leer booking_items" on public.booking_items
  using (
    (select current_role_is(array['pastor_sede','admin_casa','super_admin']))
    or exists (
      select 1 from bookings b
      where b.id = booking_items.booking_id
        and b.created_by = (select auth.uid())
    )
  );

alter policy "modificar booking_items" on public.booking_items
  using (
    (select current_role_is(array['pastor_sede','admin_casa','super_admin']))
    or exists (
      select 1 from bookings b
      where b.id = booking_items.booking_id
        and b.created_by = (select auth.uid())
    )
  )
  with check (
    (select current_role_is(array['pastor_sede','admin_casa','super_admin']))
    or exists (
      select 1 from bookings b
      where b.id = booking_items.booking_id
        and b.created_by = (select auth.uid())
    )
  );

-- ── 2. Índices sobre foreign keys ─────────────────────────────────────

create index if not exists booking_audit_actor_id_idx
  on public.booking_audit (actor_id);

create index if not exists booking_audit_booking_id_idx
  on public.booking_audit (booking_id);

create index if not exists bookings_created_by_idx
  on public.bookings (created_by);

create index if not exists bookings_ministry_id_idx
  on public.bookings (ministry_id);

create index if not exists bookings_owner_org_id_idx
  on public.bookings (owner_org_id);

create index if not exists bookings_parent_booking_id_idx
  on public.bookings (parent_booking_id);

create index if not exists bookings_payment_marked_by_idx
  on public.bookings (payment_marked_by);

create index if not exists ministries_lead_user_id_idx
  on public.ministries (lead_user_id);

create index if not exists profiles_ministry_id_idx
  on public.profiles (ministry_id);

create index if not exists spaces_managed_by_org_id_idx
  on public.spaces (managed_by_org_id);
