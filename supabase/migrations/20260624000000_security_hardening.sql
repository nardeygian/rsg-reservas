-- =====================================================================
-- RSG Reservas — endurecimiento de seguridad
-- =====================================================================
-- Cierra hallazgos del linter de Supabase después del esquema inicial:
--   1. Fija search_path en funciones (anti-inyección via search_path).
--   2. Habilita RLS en organizations, spaces y ministries.
--   3. Revoca EXECUTE de funciones trigger que no deben llamarse por RPC.

-- =====================================================================
-- 1. search_path explícito en funciones
-- =====================================================================
alter function set_updated_at() set search_path = public, pg_temp;
alter function set_booking_time_range() set search_path = public, pg_temp;
alter function current_role_is(text[]) set search_path = public, pg_temp;

-- =====================================================================
-- 2. RLS en tablas de referencia
-- =====================================================================
-- Lectura abierta a usuarios autenticados (necesario para selectores de
-- espacio/ministerio en la UI); escritura solo para super_admin.

alter table organizations enable row level security;
alter table spaces enable row level security;
alter table ministries enable row level security;

create policy "leer organizations autenticados"
  on organizations for select
  to authenticated
  using (true);

create policy "gestionar organizations super_admin"
  on organizations for all
  to authenticated
  using (current_role_is(array['super_admin']))
  with check (current_role_is(array['super_admin']));

create policy "leer spaces autenticados"
  on spaces for select
  to authenticated
  using (true);

create policy "gestionar spaces super_admin"
  on spaces for all
  to authenticated
  using (current_role_is(array['super_admin']))
  with check (current_role_is(array['super_admin']));

create policy "leer ministries autenticados"
  on ministries for select
  to authenticated
  using (true);

create policy "gestionar ministries super_admin"
  on ministries for all
  to authenticated
  using (current_role_is(array['super_admin']))
  with check (current_role_is(array['super_admin']));

-- =====================================================================
-- 3. Funciones trigger no deben ser RPC públicas
-- =====================================================================
-- handle_new_auth_user y log_booking_changes solo se invocan desde triggers.
-- current_role_is sí se llama desde policies (necesario para authenticated),
-- pero anon nunca debería invocarla — siempre tendría auth.uid() = null.

revoke execute on function handle_new_auth_user() from anon, authenticated, public;
revoke execute on function log_booking_changes() from anon, authenticated, public;
revoke execute on function current_role_is(text[]) from anon, public;
