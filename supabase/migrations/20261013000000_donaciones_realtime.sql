-- Habilita Realtime para la tabla donaciones_data.
-- Necesario para que los clientes reciban actualizaciones en tiempo real
-- cuando se importan nuevas donaciones desde el panel PHP de Hostinger.
alter publication supabase_realtime add table public.donaciones_data;
