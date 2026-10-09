-- Módulo Servicio: almacena reuniones, servidores y registros de listas.
-- Espejo de pago/datos/panel/servicio.json del panel PHP.
-- NOTA: Ejecutar en el dashboard de Supabase o con `supabase db push` (requiere permiso de Gian).

create table if not exists public.servicio_data (
  id      text primary key default 'main',
  data    jsonb not null default
            '{"reuniones":{},"servidores":{},"registros":{},"sync":0,"sync_error":""}',
  updated_at timestamptz not null default now()
);

-- Solo el service_role puede acceder; anon/authed no tienen acceso.
alter table public.servicio_data enable row level security;
