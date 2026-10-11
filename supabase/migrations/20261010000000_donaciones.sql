create table if not exists public.donaciones_data (
  id          text primary key default 'main',
  donaciones  jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.donaciones_data enable row level security;
