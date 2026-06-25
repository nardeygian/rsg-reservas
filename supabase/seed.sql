-- =====================================================================
-- Datos semilla RSG Reservas
-- =====================================================================
-- Se ejecutan después de las migraciones (con `supabase db reset` en local,
-- o pegando este SQL en el editor del panel de Supabase para el remoto).

insert into organizations (name, type) values
  ('RSG', 'church'),
  ('Studio Prado', 'external');

insert into spaces (name, slug, status, booking_policy, allows_shared_occupancy)
values
  ('Auditorio', 'auditorio', 'active', 'needs_approval', false),
  ('Lobby', 'lobby', 'active', 'self_serve', false),
  ('Salón 38', 'salon-38', 'active', 'self_serve', false),
  ('Salón 45', 'salon-45', 'disabled', 'needs_approval', false),
  ('Estudio', 'estudio', 'external', 'needs_approval', true);

-- Vincula el Estudio a su organización gestora.
update spaces
   set managed_by_org_id = (select id from organizations where name = 'Studio Prado')
 where slug = 'estudio';

-- TODO: cargar departamentos y ministerios reales de RSG.
-- Ejemplo del formato esperado:
-- insert into ministries (name, type) values
--   ('Niños', 'ministerio'),
--   ('Jóvenes', 'ministerio'),
--   ('Comunicaciones', 'departamento'),
--   ('Adoración', 'ministerio');
