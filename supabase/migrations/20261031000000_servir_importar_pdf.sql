-- =====================================================================
-- Etapa 5 · Servir — importar una reunión desde un PDF
-- =====================================================================
-- El PDF se lee con Claude en el servidor; la persona revisa lo leído y
-- confirma. Recién entonces se crea la reunión (origin 'pdf'), su orden y
-- las canciones que falten, con su propia sesión: RLS decide como siempre
-- (servir.planear para la reunión y el orden, canciones.editar para crear
-- canciones).
--
-- * servir.importar: permiso nuevo para leer PDFs (cada lectura cuesta).
-- * meetings.origin admite 'pdf'.
-- * meeting_imports: registro de cada lectura (quién, qué archivo, tokens,
--   lo que se leyó y la reunión que salió). El PDF no se guarda.
--
-- Aditiva. No se aplica a producción sin permiso de Gian.
-- =====================================================================

-- ── Permiso ─────────────────────────────────────────────────────────────
-- Los mismos roles que tienen servir.planear.
insert into public.role_permissions (role, permission) values
  ('pastor_sede', 'servir.importar'),
  ('fundador', 'servir.importar'),
  ('servidor_planeacion', 'servir.importar'),
  ('planeacion', 'servir.importar')
on conflict do nothing;

-- ── Origen 'pdf' ────────────────────────────────────────────────────────
alter table public.meetings drop constraint if exists meetings_origin_check;
alter table public.meetings
  add constraint meetings_origin_check check (origin in ('asana', 'manual', 'legacy', 'pdf'));

-- ── Registro de importaciones ───────────────────────────────────────────
create table if not exists public.meeting_imports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  file_name      text not null,
  file_sha256    text not null,
  model          text not null,
  input_tokens   int,
  output_tokens  int,
  extraction     jsonb not null,
  meeting_id     uuid references public.meetings(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists meeting_imports_user_idx on public.meeting_imports (user_id, created_at desc);
create index if not exists meeting_imports_sha_idx on public.meeting_imports (file_sha256);
create index if not exists meeting_imports_meeting_idx on public.meeting_imports (meeting_id);

alter table public.meeting_imports enable row level security;

drop policy if exists "meeting_imports: lectura" on public.meeting_imports;
create policy "meeting_imports: lectura" on public.meeting_imports for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.has_permission('servir.importar')))
    or (select public.has_permission('servir.ver_todo'))
  );

drop policy if exists "meeting_imports: crear" on public.meeting_imports;
create policy "meeting_imports: crear" on public.meeting_imports for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_permission('servir.importar')));

-- Solo para enlazar la reunión creada a su lectura.
drop policy if exists "meeting_imports: enlazar" on public.meeting_imports;
create policy "meeting_imports: enlazar" on public.meeting_imports for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('servir.importar')))
  with check (user_id = (select auth.uid()) and (select public.has_permission('servir.importar')));

revoke all on public.meeting_imports from anon;
revoke update on public.meeting_imports from authenticated;
grant select, insert on public.meeting_imports to authenticated;
grant update (meeting_id) on public.meeting_imports to authenticated;
