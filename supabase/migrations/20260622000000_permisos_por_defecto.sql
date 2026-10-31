-- =====================================================================
-- Permisos por defecto de la Data API (como los tiene producción)
-- =====================================================================
-- Producción es un proyecto anterior al cambio de Supabase que dejó de dar
-- permisos automáticos a anon/authenticated/service_role sobre lo nuevo en
-- public. Las migraciones siguientes cuentan con esos permisos y solo
-- revocan lo que no quieren (ver bookings, profiles, notifications…).
--
-- Esta migración, la primera de todas, devuelve ese comportamiento para
-- que una base nueva (local, pruebas, staging) quede igual a producción.
-- En producción no cambia nada: ya los tiene. Como su fecha es anterior a
-- las ya aplicadas, allí se aplica con `supabase db push --include-all`.
-- =====================================================================

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
