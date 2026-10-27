-- =====================================================================
-- Etapa 5 · Servir — reglas de acceso (RLS)
-- =====================================================================
-- Reglas del plan (sección 2):
-- * Servidor: solo ve las reuniones donde tiene una asignación, su
--   asignación y su propio checklist.
-- * Líder de departamento o de área: ve todas las reuniones con su orden,
--   canciones y el equipo completo; asigna y notifica solo a su gente; no
--   ve los checklists de otros departamentos.
-- * Planeación, pastores de sede, fundadores y super admin: ven todo.
-- Toda política usa has_permission(); nada depende de esconder botones.
-- =====================================================================

-- ── Funciones de apoyo ──────────────────────────────────────────────────

-- ¿Tiene el permiso con alcance global (no solo en un departamento)?
create or replace function public.has_global_permission(p_permission text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.permission_scopes(p_permission) s where s.scope_type is null);
$$;

-- ¿Puede asignar/gestionar en este departamento o área?
create or replace function public.can_assign(p_ministry_id uuid, p_area_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('servir.asignar', 'departamento', p_ministry_id::text)
      or (p_area_id is not null and public.has_permission('servir.asignar', 'area', p_area_id::text));
$$;

-- ¿Puede ver esta reunión?
create or replace function public.can_see_meeting(p_meeting_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('servir.ver_reuniones')
      or public.has_permission('servir.ver_todo')
      or exists (
        select 1 from public.assignments a
         where a.meeting_id = p_meeting_id and a.person_id = public.current_person_id()
      );
$$;

-- ¿Puede ver las estadísticas y la asistencia de esta persona?
create or replace function public.can_see_person_stats(p_person_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_person_id = public.current_person_id()
      or public.has_permission('servir.ver_todo')
      or public.has_global_permission('servir.estadisticas')
      or exists (
        select 1 from public.team_members tm
         where tm.person_id = p_person_id and tm.active
           and (public.has_permission('servir.estadisticas', 'departamento', tm.ministry_id::text)
                or (tm.area_id is not null and public.has_permission('servir.estadisticas', 'area', tm.area_id::text)))
      )
      or exists (
        select 1 from public.people p
         where p.id = p_person_id and p.discipleship_group_id is not null
           and public.has_permission('servir.estadisticas', 'discipulado', p.discipleship_group_id)
      );
$$;

-- ── Activar RLS ─────────────────────────────────────────────────────────
alter table public.discipleship_groups enable row level security;
alter table public.people              enable row level security;
alter table public.areas               enable row level security;
alter table public.team_members        enable row level security;
alter table public.positions           enable row level security;
alter table public.person_positions    enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.meeting_types       enable row level security;
alter table public.meeting_templates   enable row level security;
alter table public.meetings            enable row level security;
alter table public.meeting_changes     enable row level security;
alter table public.songs               enable row level security;
alter table public.run_items           enable row level security;
alter table public.assignments         enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.attendance          enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.broadcasts          enable row level security;
alter table public.notifications       enable row level security;
alter table public.reminders           enable row level security;  -- sin políticas: solo el despachador (service_role)

-- ── Discipulados ────────────────────────────────────────────────────────
drop policy if exists "discipleship_groups: lectura" on public.discipleship_groups;
create policy "discipleship_groups: lectura" on public.discipleship_groups for select to authenticated
  using ((select auth.uid()) = any (leader_user_ids)
         or (select public.has_permission('servir.ver_reuniones'))
         or (select public.has_permission('servir.estadisticas')));
drop policy if exists "discipleship_groups: escritura super_admin" on public.discipleship_groups;
create policy "discipleship_groups: escritura super_admin" on public.discipleship_groups for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- ── Personas ────────────────────────────────────────────────────────────
drop policy if exists "people: lectura" on public.people;
create policy "people: lectura" on public.people for select to authenticated
  using (profile_id = (select auth.uid())
         or (select public.has_permission('servir.ver_reuniones'))
         or (select public.has_permission('servir.ver_todo'))
         or (discipleship_group_id is not null
             and public.has_permission('servir.estadisticas', 'discipulado', discipleship_group_id)));
-- Los líderes agregan personas a su equipo; Planeación a cualquiera.
drop policy if exists "people: crear" on public.people;
create policy "people: crear" on public.people for insert to authenticated
  with check ((select public.has_permission('servir.asignar')) or (select public.has_permission('servir.planear')));
drop policy if exists "people: editar" on public.people;
create policy "people: editar" on public.people for update to authenticated
  using (profile_id = (select auth.uid())
         or (select public.has_permission('servir.planear'))
         or exists (select 1 from public.team_members tm
                     where tm.person_id = people.id and public.can_assign(tm.ministry_id, tm.area_id)));

-- ── Áreas y posiciones (catálogo: lectura para todos los autenticados) ──
drop policy if exists "areas: lectura" on public.areas;
create policy "areas: lectura" on public.areas for select to authenticated using (true);
drop policy if exists "areas: escritura" on public.areas;
create policy "areas: escritura" on public.areas for all to authenticated
  using (public.has_permission('servir.asignar', 'departamento', ministry_id::text) or (select public.has_permission('servir.planear')))
  with check (public.has_permission('servir.asignar', 'departamento', ministry_id::text) or (select public.has_permission('servir.planear')));

drop policy if exists "positions: lectura" on public.positions;
create policy "positions: lectura" on public.positions for select to authenticated using (true);
drop policy if exists "positions: escritura" on public.positions;
create policy "positions: escritura" on public.positions for all to authenticated
  using (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')))
  with check (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')));

-- ── Equipos ─────────────────────────────────────────────────────────────
drop policy if exists "team_members: lectura" on public.team_members;
create policy "team_members: lectura" on public.team_members for select to authenticated
  using (person_id = (select public.current_person_id())
         or (select public.has_permission('servir.ver_reuniones'))
         or (select public.has_permission('servir.ver_todo')));
drop policy if exists "team_members: escritura" on public.team_members;
create policy "team_members: escritura" on public.team_members for all to authenticated
  using (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')))
  with check (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')));

drop policy if exists "person_positions: lectura" on public.person_positions;
create policy "person_positions: lectura" on public.person_positions for select to authenticated
  using (person_id = (select public.current_person_id())
         or (select public.has_permission('servir.ver_reuniones'))
         or (select public.has_permission('servir.ver_todo')));
drop policy if exists "person_positions: escritura" on public.person_positions;
create policy "person_positions: escritura" on public.person_positions for all to authenticated
  using (exists (select 1 from public.positions p where p.id = position_id and public.can_assign(p.ministry_id, p.area_id))
         or (select public.has_permission('servir.planear')))
  with check (exists (select 1 from public.positions p where p.id = position_id and public.can_assign(p.ministry_id, p.area_id))
              or (select public.has_permission('servir.planear')));

-- ── Fechas en que no puede servir ───────────────────────────────────────
drop policy if exists "availability_blocks: lectura" on public.availability_blocks;
create policy "availability_blocks: lectura" on public.availability_blocks for select to authenticated
  using (person_id = (select public.current_person_id())
         or (select public.has_permission('servir.asignar'))
         or (select public.has_permission('servir.ver_todo')));
drop policy if exists "availability_blocks: escritura" on public.availability_blocks;
create policy "availability_blocks: escritura" on public.availability_blocks for all to authenticated
  using (person_id = (select public.current_person_id())
         or exists (select 1 from public.team_members tm
                     where tm.person_id = availability_blocks.person_id and public.can_assign(tm.ministry_id, tm.area_id))
         or (select public.has_permission('servir.planear')))
  with check (person_id = (select public.current_person_id())
              or exists (select 1 from public.team_members tm
                          where tm.person_id = availability_blocks.person_id and public.can_assign(tm.ministry_id, tm.area_id))
              or (select public.has_permission('servir.planear')));

-- ── Tipos de reunión y plantillas ───────────────────────────────────────
drop policy if exists "meeting_types: lectura" on public.meeting_types;
create policy "meeting_types: lectura" on public.meeting_types for select to authenticated using (true);
drop policy if exists "meeting_types: escritura" on public.meeting_types;
create policy "meeting_types: escritura" on public.meeting_types for all to authenticated
  using ((select public.has_global_permission('servir.plantillas'))
         or (ministry_id is not null and public.has_permission('servir.plantillas', 'ministerio', ministry_id::text)))
  with check ((select public.has_global_permission('servir.plantillas'))
              or (ministry_id is not null and public.has_permission('servir.plantillas', 'ministerio', ministry_id::text)));

drop policy if exists "meeting_templates: lectura" on public.meeting_templates;
create policy "meeting_templates: lectura" on public.meeting_templates for select to authenticated
  using ((select public.has_permission('servir.ver_reuniones')) or (select public.has_permission('servir.ver_todo')));
drop policy if exists "meeting_templates: escritura" on public.meeting_templates;
create policy "meeting_templates: escritura" on public.meeting_templates for all to authenticated
  using ((select public.has_global_permission('servir.plantillas'))
         or exists (select 1 from public.meeting_types t
                     where t.id = meeting_type_id and t.ministry_id is not null
                       and public.has_permission('servir.plantillas', 'ministerio', t.ministry_id::text)))
  with check ((select public.has_global_permission('servir.plantillas'))
              or exists (select 1 from public.meeting_types t
                          where t.id = meeting_type_id and t.ministry_id is not null
                            and public.has_permission('servir.plantillas', 'ministerio', t.ministry_id::text)));

-- ── Reuniones ───────────────────────────────────────────────────────────
drop policy if exists "meetings: lectura" on public.meetings;
create policy "meetings: lectura" on public.meetings for select to authenticated
  using (public.can_see_meeting(id));
drop policy if exists "meetings: crear" on public.meetings;
create policy "meetings: crear" on public.meetings for insert to authenticated
  with check ((select public.has_permission('servir.planear')));
-- Planeación edita; quien conduce en vivo (servir.vivo) avanza el orden.
drop policy if exists "meetings: editar" on public.meetings;
create policy "meetings: editar" on public.meetings for update to authenticated
  using ((select public.has_permission('servir.planear')) or (select public.has_permission('servir.vivo')))
  with check ((select public.has_permission('servir.planear')) or (select public.has_permission('servir.vivo')));
drop policy if exists "meetings: borrar" on public.meetings;
create policy "meetings: borrar" on public.meetings for delete to authenticated
  using ((select public.has_permission('servir.planear')));

drop policy if exists "meeting_changes: lectura" on public.meeting_changes;
create policy "meeting_changes: lectura" on public.meeting_changes for select to authenticated
  using (public.can_see_meeting(meeting_id));
drop policy if exists "meeting_changes: crear" on public.meeting_changes;
create policy "meeting_changes: crear" on public.meeting_changes for insert to authenticated
  with check ((select public.has_permission('servir.planear')));

-- ── Orden de la reunión ─────────────────────────────────────────────────
drop policy if exists "run_items: lectura" on public.run_items;
create policy "run_items: lectura" on public.run_items for select to authenticated
  using (public.can_see_meeting(meeting_id));
drop policy if exists "run_items: escritura" on public.run_items;
create policy "run_items: escritura" on public.run_items for all to authenticated
  using ((select public.has_permission('servir.planear')) or (select public.has_permission('servir.vivo')))
  with check ((select public.has_permission('servir.planear')) or (select public.has_permission('servir.vivo')));

-- ── Canciones ───────────────────────────────────────────────────────────
drop policy if exists "songs: lectura" on public.songs;
create policy "songs: lectura" on public.songs for select to authenticated using (true);
drop policy if exists "songs: escritura" on public.songs;
create policy "songs: escritura" on public.songs for all to authenticated
  using ((select public.has_permission('canciones.editar')))
  with check ((select public.has_permission('canciones.editar')));

drop policy if exists "songs bucket: lectura" on storage.objects;
create policy "songs bucket: lectura" on storage.objects for select to authenticated
  using (bucket_id = 'songs');
drop policy if exists "songs bucket: escritura" on storage.objects;
create policy "songs bucket: escritura" on storage.objects for all to authenticated
  using (bucket_id = 'songs' and (select public.has_permission('canciones.editar')))
  with check (bucket_id = 'songs' and (select public.has_permission('canciones.editar')));

-- ── Asignaciones ────────────────────────────────────────────────────────
-- Los líderes ven el equipo completo de cada reunión (decisión de Gian);
-- el servidor, solo las suyas. Aceptar/rechazar va por respond_assignment().
drop policy if exists "assignments: lectura" on public.assignments;
create policy "assignments: lectura" on public.assignments for select to authenticated
  using (person_id = (select public.current_person_id())
         or (select public.has_permission('servir.ver_reuniones'))
         or (select public.has_permission('servir.ver_todo')));
drop policy if exists "assignments: crear" on public.assignments;
create policy "assignments: crear" on public.assignments for insert to authenticated
  with check (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')));
drop policy if exists "assignments: editar" on public.assignments;
create policy "assignments: editar" on public.assignments for update to authenticated
  using (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')))
  with check (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')));
drop policy if exists "assignments: borrar" on public.assignments;
create policy "assignments: borrar" on public.assignments for delete to authenticated
  using (public.can_assign(ministry_id, area_id) or (select public.has_permission('servir.planear')));

-- ── Checklist ───────────────────────────────────────────────────────────
drop policy if exists "checklist_templates: lectura" on public.checklist_templates;
create policy "checklist_templates: lectura" on public.checklist_templates for select to authenticated using (true);
drop policy if exists "checklist_templates: escritura" on public.checklist_templates;
create policy "checklist_templates: escritura" on public.checklist_templates for all to authenticated
  using (exists (select 1 from public.positions p where p.id = position_id and public.can_assign(p.ministry_id, p.area_id))
         or (select public.has_permission('servir.planear')))
  with check (exists (select 1 from public.positions p where p.id = position_id and public.can_assign(p.ministry_id, p.area_id))
              or (select public.has_permission('servir.planear')));

-- El checklist de cada servidor: él, su líder (solo su departamento o área)
-- y quien ve todo. Marcar va por toggle_checklist_item().
drop policy if exists "checklist_items: lectura" on public.checklist_items;
create policy "checklist_items: lectura" on public.checklist_items for select to authenticated
  using (exists (select 1 from public.assignments a
                  where a.id = assignment_id
                    and (a.person_id = public.current_person_id()
                         or public.can_assign(a.ministry_id, a.area_id)))
         or (select public.has_permission('servir.ver_todo')));

-- ── Asistencia ──────────────────────────────────────────────────────────
drop policy if exists "attendance: lectura" on public.attendance;
create policy "attendance: lectura" on public.attendance for select to authenticated
  using (public.can_see_person_stats(person_id)
         or exists (select 1 from public.meetings m
                     where m.id = meeting_id and m.ministry_id is not null
                       and public.has_permission('servir.estadisticas', 'ministerio', m.ministry_id::text)));
drop policy if exists "attendance: escritura" on public.attendance;
create policy "attendance: escritura" on public.attendance for all to authenticated
  using ((select public.has_permission('servir.asistencia')))
  with check ((select public.has_permission('servir.asistencia')));

-- ── Notificaciones ──────────────────────────────────────────────────────
drop policy if exists "push_subscriptions: propias" on public.push_subscriptions;
create policy "push_subscriptions: propias" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "notifications: propias" on public.notifications;
create policy "notifications: propias" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
-- Solo se marca como leída; las crea el despachador.
drop policy if exists "notifications: marcar leida" on public.notifications;
create policy "notifications: marcar leida" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Envíos: 'todos' solo con permiso global (pastores de sede, fundadores,
-- super admin, Planeación); departamento/área solo dentro del alcance;
-- reunión, quien planea.
drop policy if exists "broadcasts: lectura" on public.broadcasts;
create policy "broadcasts: lectura" on public.broadcasts for select to authenticated
  using (author_id = (select auth.uid()) or (select public.has_permission('servir.ver_todo')));
drop policy if exists "broadcasts: crear" on public.broadcasts;
create policy "broadcasts: crear" on public.broadcasts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      (audience = 'todos' and (select public.has_global_permission('notificar.enviar')))
      or (audience = 'departamento' and public.has_permission('notificar.enviar', 'departamento', scope_id))
      or (audience = 'area' and public.has_permission('notificar.enviar', 'area', scope_id))
      or (audience = 'reunion' and (select public.has_permission('servir.planear')))
    )
  );

-- ── Acceso de la API ────────────────────────────────────────────────────
-- Las tablas nuevas no se exponen solas: se dan permisos solo a usuarios
-- autenticados (nunca a anon). Qué filas ve o cambia cada quien lo deciden
-- las políticas de arriba. reminders queda solo para el despachador.
grant select, insert, update, delete on
  public.discipleship_groups, public.people, public.areas, public.team_members,
  public.positions, public.person_positions, public.availability_blocks,
  public.meeting_types, public.meeting_templates, public.meetings, public.meeting_changes,
  public.songs, public.run_items, public.assignments, public.checklist_templates,
  public.attendance, public.push_subscriptions, public.broadcasts
  to authenticated;
grant select on public.checklist_items to authenticated;      -- marcar: toggle_checklist_item()
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.role_permissions, public.user_permissions, public.permission_log to authenticated;
grant insert, update, delete on public.user_permissions to authenticated;   -- la política exige super_admin

revoke all on
  public.discipleship_groups, public.people, public.areas, public.team_members,
  public.positions, public.person_positions, public.availability_blocks,
  public.meeting_types, public.meeting_templates, public.meetings, public.meeting_changes,
  public.songs, public.run_items, public.assignments, public.checklist_templates,
  public.checklist_items, public.attendance, public.push_subscriptions, public.broadcasts,
  public.notifications, public.reminders, public.role_permissions, public.user_permissions,
  public.permission_log
  from anon;
revoke all on public.reminders from authenticated;

-- El servidor (sincronización con Asana, despachador, migraciones de datos)
-- usa service_role, que salta RLS pero igual necesita permisos de tabla.
grant all on
  public.discipleship_groups, public.people, public.areas, public.team_members,
  public.positions, public.person_positions, public.availability_blocks,
  public.meeting_types, public.meeting_templates, public.meetings, public.meeting_changes,
  public.songs, public.run_items, public.assignments, public.checklist_templates,
  public.checklist_items, public.attendance, public.push_subscriptions, public.broadcasts,
  public.notifications, public.reminders, public.role_permissions, public.user_permissions,
  public.permission_log
  to service_role;

-- Funciones de permisos: solo para usuarios autenticados
revoke execute on function public.has_permission(text, text, text) from anon, public;
revoke execute on function public.has_global_permission(text) from anon, public;
revoke execute on function public.permission_scopes(text) from anon, public;
revoke execute on function public.my_role_scopes() from anon, public;
revoke execute on function public.respond_assignment(uuid, boolean, text) from anon, public;
revoke execute on function public.toggle_checklist_item(uuid, boolean) from anon, public;
grant execute on function public.has_permission(text, text, text), public.has_global_permission(text),
  public.permission_scopes(text), public.my_role_scopes(), public.is_super_admin(), public.current_person_id(),
  public.can_assign(uuid, uuid), public.can_see_meeting(uuid), public.can_see_person_stats(uuid)
  to authenticated;
