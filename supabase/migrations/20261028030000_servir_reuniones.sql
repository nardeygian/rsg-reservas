-- =====================================================================
-- Etapa 5 · Servir — tipos de reunión, plantillas, reuniones, orden y canciones
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (secciones 3 y 3.1).
-- Las políticas RLS van en 20261028050000_servir_rls.sql.
-- =====================================================================

-- ── Tipos de reunión ────────────────────────────────────────────────────
create table if not exists public.meeting_types (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  ministry_id          uuid references public.ministries(id) on delete set null,
  counting             text not null default 'min' check (counting in ('min', 'serv')),
  kind                 text not null default 'ministerio' check (kind in ('ministerio', 'servolucion', 'evento')),
  color                text,
  usual_weekday        smallint check (usual_weekday between 0 and 6),   -- 0 = domingo
  usual_time           time,
  duration_min         int check (duration_min > 0),
  usual_space_id       uuid references public.spaces(id) on delete set null,
  default_template_id  uuid,          -- FK después de crear meeting_templates
  asana_rules          jsonb not null default '{}'::jsonb,  -- { "sections": [...], "keywords": [...] }
  sort                 int not null default 0,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Plantillas ──────────────────────────────────────────────────────────
-- run_sheet:          [{ kind, title, duration_sec, notes, responsible_position_id }]
-- required_positions: [{ position_id, count }]
-- checklist_extra:    [{ position_id, moment, text }]
create table if not exists public.meeting_templates (
  id                       uuid primary key default gen_random_uuid(),
  meeting_type_id          uuid references public.meeting_types(id) on delete cascade,
  name                     text not null,
  version                  int not null default 1,
  created_from_meeting_id  uuid,
  run_sheet                jsonb not null default '[]'::jsonb,
  required_positions       jsonb not null default '[]'::jsonb,
  checklist_extra          jsonb not null default '[]'::jsonb,
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.meeting_types drop constraint if exists meeting_types_default_template_fkey;
alter table public.meeting_types
  add constraint meeting_types_default_template_fkey
  foreign key (default_template_id) references public.meeting_templates(id) on delete set null;

-- ── Reuniones ───────────────────────────────────────────────────────────
-- meeting_date es la fecha en hora de Bogotá: las reglas de conteo de
-- Servicio trabajan por día. starts_at/ends_at son opcionales (las
-- reuniones heredadas solo tienen fecha).
create table if not exists public.meetings (
  id                      uuid primary key default gen_random_uuid(),
  legacy_id               text unique,               -- id en servicio_data.reuniones
  asana_gid               text unique,
  name                    text not null,
  meeting_date            date not null,
  starts_at               timestamptz,
  ends_at                 timestamptz,
  meeting_type_id         uuid references public.meeting_types(id) on delete set null,
  kind                    text not null default 'ministerio' check (kind in ('ministerio', 'servolucion', 'evento')),
  section                 text,
  ministry_id             uuid references public.ministries(id) on delete set null,
  booking_id              uuid references public.bookings(id) on delete set null,
  template_id             uuid references public.meeting_templates(id) on delete set null,
  status                  text not null default 'borrador'
                            check (status in ('borrador', 'publicada', 'en_vivo', 'cerrada', 'cancelada')),
  origin                  text not null default 'manual' check (origin in ('asana', 'manual', 'legacy')),
  outside_asana           boolean not null default false,
  current_item_id         uuid,                      -- FK después de crear run_items
  actual_start            timestamptz,
  actual_end              timestamptz,
  notes                   text,
  attendance_closed_at    timestamptz,
  attendance_closed_by    uuid references public.profiles(id) on delete set null,
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists meetings_date_idx on public.meetings (meeting_date);
create index if not exists meetings_type_idx on public.meetings (meeting_type_id);

alter table public.meeting_templates drop constraint if exists meeting_templates_created_from_fkey;
alter table public.meeting_templates
  add constraint meeting_templates_created_from_fkey
  foreign key (created_from_meeting_id) references public.meetings(id) on delete set null;

-- Historial de cambios: una reunión puede reprogramarse varias veces.
create table if not exists public.meeting_changes (
  id                  uuid primary key default gen_random_uuid(),
  meeting_id          uuid not null references public.meetings(id) on delete cascade,
  change              text not null check (change in ('reprogramada', 'cancelada', 'restaurada')),
  previous_date       date,
  new_date            date,
  previous_starts_at  timestamptz,
  new_starts_at       timestamptz,
  reason              text,
  actor_id            uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists meeting_changes_meeting_idx on public.meeting_changes (meeting_id);

-- ── Canciones ───────────────────────────────────────────────────────────
-- lyrics: texto con secciones marcadas, p. ej. "[Verso 1]\n...\n[Coro]\n..."
-- files:  [{ path, name, kind ('letra'|'acordes'|'partitura'|'audio') }] en el bucket 'songs'
create table if not exists public.songs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  artist        text,
  default_key   text,
  bpm           int check (bpm > 0),
  lyrics        text,
  ccli          text,
  tags          text[] not null default '{}',
  files         jsonb not null default '[]'::jsonb,
  last_used_on  date,
  active        boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists songs_title_idx on public.songs (lower(title));

-- ── Orden de la reunión (run sheet) ─────────────────────────────────────
create table if not exists public.run_items (
  id                       uuid primary key default gen_random_uuid(),
  meeting_id               uuid not null references public.meetings(id) on delete cascade,
  sort                     int not null,
  kind                     text not null default 'otro'
                             check (kind in ('cancion', 'predica', 'oracion', 'anuncio', 'encabezado', 'otro')),
  title                    text not null,
  duration_sec             int not null default 0 check (duration_sec >= 0),
  song_id                  uuid references public.songs(id) on delete set null,
  song_key                 text,
  notes                    text,
  responsible_position_id  uuid references public.positions(id) on delete set null,
  actual_start             timestamptz,
  actual_end               timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists run_items_meeting_idx on public.run_items (meeting_id, sort);

alter table public.meetings drop constraint if exists meetings_current_item_fkey;
alter table public.meetings
  add constraint meetings_current_item_fkey
  foreign key (current_item_id) references public.run_items(id) on delete set null;

-- ── updated_at ──────────────────────────────────────────────────────────
drop trigger if exists meeting_types_updated_at on public.meeting_types;
create trigger meeting_types_updated_at before update on public.meeting_types
  for each row execute function public.set_updated_at();
drop trigger if exists meeting_templates_updated_at on public.meeting_templates;
create trigger meeting_templates_updated_at before update on public.meeting_templates
  for each row execute function public.set_updated_at();
drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();
drop trigger if exists songs_updated_at on public.songs;
create trigger songs_updated_at before update on public.songs
  for each row execute function public.set_updated_at();

-- ── Archivos de canciones ───────────────────────────────────────────────
-- Bucket privado. Las políticas de storage van en la migración de RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('songs', 'songs', false, 20971520,
        array['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'audio/mpeg', 'audio/mp4'])
on conflict (id) do nothing;
