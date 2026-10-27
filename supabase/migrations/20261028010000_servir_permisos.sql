-- =====================================================================
-- Etapa 5 · Servir — roles nuevos y sistema de permisos
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (sección 2).
--
-- * Roles nuevos: fundador (rol principal), lider_area y servidor_planeacion
--   (roles adicionales con alcance en user_roles).
-- * user_roles gana area_id para el alcance de lider_area.
-- * role_permissions: paquete de permisos por rol.
-- * user_permissions: permisos dados o quitados a mano (una quita gana).
-- * permission_log: registro de cada cambio de permisos.
-- * has_permission(permiso, tipo_alcance, alcance) para las políticas RLS.
--
-- No cambia el comportamiento de lo que ya existe: reservas, donaciones y
-- servicio siguen usando current_role_is() como hoy.
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Roles ────────────────────────────────────────────────────────────

-- Rol principal: se suma 'fundador' (ve todo, como pastor de sede).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'leader', 'mentor', 'pastor_ministerio', 'pastor_sede', 'admin_casa',
    'studio_admin', 'super_admin', 'planeacion', 'fundador'
  ));

-- Roles adicionales con alcance.
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in (
    'lider_departamento', 'pastor_ministerio', 'pastor_sede', 'lider_discipulado',
    'lider_area', 'servidor_planeacion', 'fundador'
  ));

-- ── 2. Catálogo de permisos por rol ─────────────────────────────────────

create table if not exists public.role_permissions (
  role        text not null,
  permission  text not null,
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions: lectura autenticados" on public.role_permissions;
create policy "role_permissions: lectura autenticados"
  on public.role_permissions for select to authenticated using (true);

-- Paquetes por defecto del módulo Servir (sección 2 del plan).
insert into public.role_permissions (role, permission) values
  -- Ven todo y notifican a todos
  ('pastor_sede', 'servir.ver_todo'),        ('pastor_sede', 'servir.ver_reuniones'),
  ('pastor_sede', 'servir.planear'),         ('pastor_sede', 'servir.vivo'),
  ('pastor_sede', 'servir.asistencia'),      ('pastor_sede', 'servir.asignar'),
  ('pastor_sede', 'servir.plantillas'),      ('pastor_sede', 'servir.estadisticas'),
  ('pastor_sede', 'canciones.editar'),       ('pastor_sede', 'notificar.enviar'),
  ('fundador', 'servir.ver_todo'),           ('fundador', 'servir.ver_reuniones'),
  ('fundador', 'servir.planear'),            ('fundador', 'servir.vivo'),
  ('fundador', 'servir.asistencia'),         ('fundador', 'servir.asignar'),
  ('fundador', 'servir.plantillas'),         ('fundador', 'servir.estadisticas'),
  ('fundador', 'canciones.editar'),          ('fundador', 'notificar.enviar'),
  -- Planeación (notifica a los servidores de una reunión con servir.planear,
  -- no a departamentos ni a todos)
  ('servidor_planeacion', 'servir.ver_todo'),     ('servidor_planeacion', 'servir.ver_reuniones'),
  ('servidor_planeacion', 'servir.planear'),      ('servidor_planeacion', 'servir.vivo'),
  ('servidor_planeacion', 'servir.asistencia'),   ('servidor_planeacion', 'servir.plantillas'),
  ('servidor_planeacion', 'servir.estadisticas'), ('servidor_planeacion', 'canciones.editar'),
  ('planeacion', 'servir.ver_todo'),         ('planeacion', 'servir.ver_reuniones'),
  ('planeacion', 'servir.planear'),          ('planeacion', 'servir.vivo'),
  ('planeacion', 'servir.asistencia'),       ('planeacion', 'servir.plantillas'),
  ('planeacion', 'servir.estadisticas'),     ('planeacion', 'canciones.editar'),
  -- Pastor de ministerio: plantillas y estadísticas de su ministerio
  ('pastor_ministerio', 'servir.ver_reuniones'),
  ('pastor_ministerio', 'servir.plantillas'),
  ('pastor_ministerio', 'servir.estadisticas'),
  -- Líderes de departamento y de área: ven todas las reuniones; asignan,
  -- notifican y miden solo a su gente (el alcance lo da user_roles)
  ('lider_departamento', 'servir.ver_reuniones'), ('lider_departamento', 'servir.asignar'),
  ('lider_departamento', 'servir.estadisticas'),  ('lider_departamento', 'notificar.enviar'),
  ('lider_area', 'servir.ver_reuniones'),         ('lider_area', 'servir.asignar'),
  ('lider_area', 'servir.estadisticas'),          ('lider_area', 'notificar.enviar'),
  -- Líder de discipulado: estadísticas de su discipulado
  ('lider_discipulado', 'servir.estadisticas')
on conflict do nothing;

-- ── 3. Permisos dados o quitados a mano ─────────────────────────────────

create table if not exists public.user_permissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  permission  text not null,
  effect      text not null check (effect in ('grant', 'deny')),
  scope_type  text check (scope_type in ('departamento', 'ministerio', 'area', 'discipulado')),
  scope_id    text,
  granted_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((scope_type is null) = (scope_id is null))
);

create unique index if not exists user_permissions_unq
  on public.user_permissions (user_id, permission, effect, coalesce(scope_type, ''), coalesce(scope_id, ''));
create index if not exists user_permissions_user_idx on public.user_permissions (user_id);

alter table public.user_permissions enable row level security;

create table if not exists public.permission_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  target_id   uuid references public.profiles(id) on delete set null,
  action      text not null,          -- 'grant' | 'deny' | 'remove' | 'role_add' | 'role_remove'
  permission  text,
  role        text,
  scope_type  text,
  scope_id    text,
  created_at  timestamptz not null default now()
);

alter table public.permission_log enable row level security;

-- ── 4. Alcance de lider_area ────────────────────────────────────────────
-- (la tabla areas se crea en la migración siguiente; aquí solo la columna)
alter table public.user_roles add column if not exists area_id uuid;

-- ── 5. Funciones ────────────────────────────────────────────────────────

-- ¿Es super admin? (rol principal)
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

-- Roles efectivos del usuario actual con su alcance:
--   rol principal (profiles.role)      → alcance global (null, null)
--   user_roles con area_id             → ('area', area_id)
--   user_roles con ministry_id         → (ministries.type, ministry_id)  departamento | ministerio
--   user_roles sin alcance             → global
--   lider de un discipulado            → ('discipulado', id)  (tabla discipleship_groups)
create or replace function public.my_role_scopes()
returns table (role text, scope_type text, scope_id text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.role, null::text, null::text
    from public.profiles p
   where p.id = auth.uid()
  union all
  select ur.role,
         case when ur.area_id is not null then 'area' when ur.ministry_id is not null then m.type end,
         coalesce(ur.area_id::text, ur.ministry_id::text)
    from public.user_roles ur
    left join public.ministries m on m.id = ur.ministry_id
   where ur.user_id = auth.uid()
$$;

-- has_permission(permiso [, tipo_alcance, alcance])
-- Permisos efectivos = (roles + grants manuales) − denies manuales. Una quita gana.
-- Sin alcance: ¿tiene el permiso en algún alcance o globalmente?
-- Con alcance: ¿lo tiene globalmente o exactamente en ese alcance?
create or replace function public.has_permission(
  p_permission text,
  p_scope_type text default null,
  p_scope_id   text default null
)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin() or (
    (
      exists (
        select 1
          from public.my_role_scopes() rs
          join public.role_permissions rp on rp.role = rs.role
         where rp.permission = p_permission
           and (p_scope_type is null or rs.scope_type is null
                or (rs.scope_type = p_scope_type and rs.scope_id = p_scope_id))
      )
      or exists (
        select 1 from public.user_permissions up
         where up.user_id = auth.uid() and up.permission = p_permission and up.effect = 'grant'
           and (p_scope_type is null or up.scope_type is null
                or (up.scope_type = p_scope_type and up.scope_id = p_scope_id))
      )
    )
    and not exists (
      select 1 from public.user_permissions up
       where up.user_id = auth.uid() and up.permission = p_permission and up.effect = 'deny'
         and (up.scope_type is null
              or (p_scope_type is not null and up.scope_type = p_scope_type and up.scope_id = p_scope_id))
    )
  );
$$;

-- Alcances donde el usuario tiene un permiso. Una fila (null, null) = global.
create or replace function public.permission_scopes(p_permission text)
returns table (scope_type text, scope_id text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select null::text, null::text where public.is_super_admin()
  union
  select rs.scope_type, rs.scope_id
    from public.my_role_scopes() rs
    join public.role_permissions rp on rp.role = rs.role
   where rp.permission = p_permission
  union
  select up.scope_type, up.scope_id
    from public.user_permissions up
   where up.user_id = auth.uid() and up.permission = p_permission and up.effect = 'grant'
  except
  select up.scope_type, up.scope_id
    from public.user_permissions up
   where up.user_id = auth.uid() and up.permission = p_permission and up.effect = 'deny';
$$;

-- ── 6. RLS de permisos manuales y registro ──────────────────────────────

drop policy if exists "user_permissions: propios o super_admin" on public.user_permissions;
create policy "user_permissions: propios o super_admin"
  on public.user_permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));

drop policy if exists "user_permissions: escritura super_admin" on public.user_permissions;
create policy "user_permissions: escritura super_admin"
  on public.user_permissions for all to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

drop policy if exists "permission_log: lectura super_admin" on public.permission_log;
create policy "permission_log: lectura super_admin"
  on public.permission_log for select to authenticated
  using ((select public.is_super_admin()));
