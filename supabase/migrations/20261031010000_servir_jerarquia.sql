-- =====================================================================
-- Etapa 5 · Servir — jerarquía de asignaciones y estructura
-- =====================================================================
-- Decisiones de Gian (31 oct):
--
-- * Estructura (departamentos, áreas, roles y a qué departamento o área
--   pertenece cada rol): solo el super admin y el líder del departamento
--   que planea. Los demás líderes ya no crean ni renombran roles.
-- * Asignar:
--     super admin, pastor de sede, fundador  → todo (servir.asignar global)
--     líder de departamento                  → su departamento
--     líder de área                          → su área
--     departamento que planea                → solo ese departamento y los
--                                              roles generales (VIO, Escenario),
--                                              por su líder y por quienes él
--                                              autorice (servir.asignar_planeacion).
--   servir.planear ya no da permiso de asignar en otros departamentos.
-- * A un servidor solo se le asigna un rol de departamento que tenga
--   marcado (person_positions). Los roles generales siguen abiertos.
-- * Los roles generales se agrupan (positions.grupo: "VIO", "Escenario").
--
-- El departamento que planea se marca con ministries.is_planning, no por
-- su nombre. Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Columnas ─────────────────────────────────────────────────────────
alter table public.ministries add column if not exists is_planning boolean not null default false;
create unique index if not exists ministries_is_planning_unq on public.ministries (is_planning) where is_planning;

-- Marca inicial: el departamento de Planeación de la organización actual.
update public.ministries set is_planning = true
 where type = 'departamento' and name = 'Planeación'
   and not exists (select 1 from public.ministries where is_planning);

alter table public.positions add column if not exists grupo text;

-- ── 2. Funciones de permiso ─────────────────────────────────────────────
create or replace function public.ministerio_que_planea()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.ministries where is_planning limit 1;
$$;

-- Super admin o líder del departamento que planea.
create or replace function public.es_lider_planeacion()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
      or exists (select 1 from public.ministries m where m.is_planning and m.lead_user_id = auth.uid())
      or exists (
        select 1 from public.user_roles ur
          join public.ministries m on m.id = ur.ministry_id
         where ur.user_id = auth.uid() and ur.role = 'lider_departamento' and m.is_planning
      );
$$;

-- Crear y editar departamentos, áreas y roles.
create or replace function public.puede_estructura()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.es_lider_planeacion();
$$;

-- Asignar en el departamento que planea y en los roles generales.
create or replace function public.puede_asignar_planeacion()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.es_lider_planeacion() or public.has_permission('servir.asignar_planeacion');
$$;

-- ¿Puede asignar este rol (departamento/área o general)?
create or replace function public.puede_asignar_rol(p_ministry_id uuid, p_area_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when p_ministry_id is null then public.puede_asignar_planeacion()
    else public.can_assign(p_ministry_id, p_area_id)
         or (p_ministry_id = public.ministerio_que_planea() and public.puede_asignar_planeacion())
  end;
$$;

revoke all on function public.ministerio_que_planea(), public.es_lider_planeacion(),
  public.puede_estructura(), public.puede_asignar_planeacion(), public.puede_asignar_rol(uuid, uuid) from public, anon;
grant execute on function public.ministerio_que_planea(), public.es_lider_planeacion(),
  public.puede_estructura(), public.puede_asignar_planeacion(), public.puede_asignar_rol(uuid, uuid) to authenticated;

-- Pastor de sede y fundador asignan todo, también lo general.
insert into public.role_permissions (role, permission) values
  ('pastor_sede', 'servir.asignar_planeacion'),
  ('fundador', 'servir.asignar_planeacion')
on conflict do nothing;

-- ── 3. Estructura: solo super admin y líder de Planeación ───────────────
drop policy if exists "areas: escritura" on public.areas;
create policy "areas: escritura" on public.areas for all to authenticated
  using ((select public.puede_estructura()))
  with check ((select public.puede_estructura()));

drop policy if exists "positions: escritura" on public.positions;
create policy "positions: escritura" on public.positions for all to authenticated
  using ((select public.puede_estructura()))
  with check ((select public.puede_estructura()));

-- Departamentos nuevos (el super admin ya tenía su propia política).
drop policy if exists "ministries: departamentos estructura" on public.ministries;
create policy "ministries: departamentos estructura" on public.ministries for insert to authenticated
  with check (type = 'departamento' and not is_planning and (select public.puede_estructura()));
drop policy if exists "ministries: renombrar departamentos" on public.ministries;
create policy "ministries: renombrar departamentos" on public.ministries for update to authenticated
  using (type = 'departamento' and (select public.puede_estructura()))
  with check (type = 'departamento' and (select public.puede_estructura()));

-- ── 4. Equipos, roles de cada persona y checklist: según la jerarquía ───
drop policy if exists "team_members: escritura" on public.team_members;
create policy "team_members: escritura" on public.team_members for all to authenticated
  using (public.puede_asignar_rol(ministry_id, area_id))
  with check (public.puede_asignar_rol(ministry_id, area_id));

drop policy if exists "person_positions: escritura" on public.person_positions;
create policy "person_positions: escritura" on public.person_positions for all to authenticated
  using (exists (select 1 from public.positions p where p.id = position_id and public.puede_asignar_rol(p.ministry_id, p.area_id)))
  with check (exists (select 1 from public.positions p where p.id = position_id and public.puede_asignar_rol(p.ministry_id, p.area_id)));

drop policy if exists "checklist_templates: escritura" on public.checklist_templates;
create policy "checklist_templates: escritura" on public.checklist_templates for all to authenticated
  using (exists (select 1 from public.positions p where p.id = position_id and public.puede_asignar_rol(p.ministry_id, p.area_id)))
  with check (exists (select 1 from public.positions p where p.id = position_id and public.puede_asignar_rol(p.ministry_id, p.area_id)));

-- ── 5. Asignaciones ─────────────────────────────────────────────────────
drop policy if exists "assignments: crear" on public.assignments;
create policy "assignments: crear" on public.assignments for insert to authenticated
  with check (public.puede_asignar_rol(ministry_id, area_id));
drop policy if exists "assignments: editar" on public.assignments;
create policy "assignments: editar" on public.assignments for update to authenticated
  using (public.puede_asignar_rol(ministry_id, area_id))
  with check (public.puede_asignar_rol(ministry_id, area_id));
drop policy if exists "assignments: borrar" on public.assignments;
create policy "assignments: borrar" on public.assignments for delete to authenticated
  using (public.puede_asignar_rol(ministry_id, area_id));

-- El servidor debe tener el rol marcado (solo roles de departamento).
create or replace function public.assignments_exigir_rol()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.positions p where p.id = new.position_id and p.ministry_id is not null)
     and not exists (select 1 from public.person_positions pp
                      where pp.person_id = new.person_id and pp.position_id = new.position_id) then
    raise exception 'Esta persona no tiene ese rol. Márcaselo primero en Mi equipo › Miembros.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists assignments_exigir_rol on public.assignments;
create trigger assignments_exigir_rol before insert or update of person_id, position_id on public.assignments
  for each row execute function public.assignments_exigir_rol();

-- ── 6. Autorizados de Planeación ────────────────────────────────────────
-- El líder de Planeación da o quita servir.asignar_planeacion (sin alcance).
drop policy if exists "user_permissions: autorizados de planeacion (lectura)" on public.user_permissions;
create policy "user_permissions: autorizados de planeacion (lectura)" on public.user_permissions for select to authenticated
  using (permission = 'servir.asignar_planeacion' and (select public.es_lider_planeacion()));
drop policy if exists "user_permissions: autorizados de planeacion (dar)" on public.user_permissions;
create policy "user_permissions: autorizados de planeacion (dar)" on public.user_permissions for insert to authenticated
  with check (permission = 'servir.asignar_planeacion' and effect = 'grant' and scope_type is null
              and (select public.es_lider_planeacion()));
drop policy if exists "user_permissions: autorizados de planeacion (quitar)" on public.user_permissions;
create policy "user_permissions: autorizados de planeacion (quitar)" on public.user_permissions for delete to authenticated
  using (permission = 'servir.asignar_planeacion' and effect = 'grant' and (select public.es_lider_planeacion()));
