-- =====================================================================
-- Etapa 5 · Servir — roles generales (VIO, Escenario)
-- =====================================================================
-- Decisión de Gian (29 oct): hay roles que no son de ningún departamento.
-- VIO dirige la reunión inicial de servidores; Escenario es quien está en
-- escenario. Los crea y los asigna Planeación (quien tiene servir.planear:
-- Planeación, pastor de sede, fundador y super admin), con su checklist, y
-- puede asignarse a cualquier servidor de cualquier departamento.
--
-- Un rol general es una fila de positions con ministry_id nulo; su
-- asignación también lleva ministry_id nulo (el trigger lo copia del rol).
-- Una persona puede tener varios roles en la misma reunión (ya era así:
-- una asignación por rol); la asistencia la cuenta como un solo servicio.
--
-- Migración aditiva e idempotente.
-- =====================================================================

alter table public.positions   alter column ministry_id drop not null;
alter table public.assignments alter column ministry_id drop not null;

-- Nombres únicos también entre los roles generales.
create unique index if not exists positions_general_name_unq
  on public.positions (name) where ministry_id is null;

-- ── Políticas: lo general solo con servir.planear ───────────────────────
-- can_assign(null, null) daría true a quien tiene servir.asignar global
-- (pastor de sede); el rol general se reserva explícitamente a Planeación.

drop policy if exists "positions: escritura" on public.positions;
create policy "positions: escritura" on public.positions for all to authenticated
  using ((ministry_id is not null and public.can_assign(ministry_id, area_id)) or (select public.has_permission('servir.planear')))
  with check ((ministry_id is not null and public.can_assign(ministry_id, area_id)) or (select public.has_permission('servir.planear')));

drop policy if exists "person_positions: escritura" on public.person_positions;
create policy "person_positions: escritura" on public.person_positions for all to authenticated
  using (exists (select 1 from public.positions p where p.id = position_id and p.ministry_id is not null and public.can_assign(p.ministry_id, p.area_id))
         or (select public.has_permission('servir.planear')))
  with check (exists (select 1 from public.positions p where p.id = position_id and p.ministry_id is not null and public.can_assign(p.ministry_id, p.area_id))
              or (select public.has_permission('servir.planear')));

drop policy if exists "checklist_templates: escritura" on public.checklist_templates;
create policy "checklist_templates: escritura" on public.checklist_templates for all to authenticated
  using (exists (select 1 from public.positions p where p.id = position_id and p.ministry_id is not null and public.can_assign(p.ministry_id, p.area_id))
         or (select public.has_permission('servir.planear')))
  with check (exists (select 1 from public.positions p where p.id = position_id and p.ministry_id is not null and public.can_assign(p.ministry_id, p.area_id))
              or (select public.has_permission('servir.planear')));

drop policy if exists "assignments: crear" on public.assignments;
create policy "assignments: crear" on public.assignments for insert to authenticated
  with check ((ministry_id is not null and public.can_assign(ministry_id, area_id)) or (select public.has_permission('servir.planear')));
drop policy if exists "assignments: editar" on public.assignments;
create policy "assignments: editar" on public.assignments for update to authenticated
  using ((ministry_id is not null and public.can_assign(ministry_id, area_id)) or (select public.has_permission('servir.planear')))
  with check ((ministry_id is not null and public.can_assign(ministry_id, area_id)) or (select public.has_permission('servir.planear')));
drop policy if exists "assignments: borrar" on public.assignments;
create policy "assignments: borrar" on public.assignments for delete to authenticated
  using ((ministry_id is not null and public.can_assign(ministry_id, area_id)) or (select public.has_permission('servir.planear')));

-- ── Asistencia: la persona con un rol general también aparece ───────────
create or replace function public.asistencia_sugerida(p_meeting_id uuid)
returns table (
  person_id        uuid,
  full_name        text,
  roles            text[],
  ministries       text[],
  assignment_status text,
  checklist_done   int,
  checklist_total  int,
  suggested        text,
  current_status   text,
  current_note     text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with asig as (
    select a.person_id,
           array_agg(distinct po.name order by po.name) as roles,
           coalesce(array_agg(distinct mi.name order by mi.name) filter (where mi.name is not null), '{}') as ministries,
           case when bool_or(a.status = 'aceptada') then 'aceptada'
                when bool_or(a.status = 'pendiente') then 'pendiente'
                else 'rechazada' end as assignment_status,
           count(ci.id) filter (where ci.done_at is not null)::int as done,
           count(ci.id)::int as total
      from public.assignments a
      join public.positions po on po.id = a.position_id
      left join public.ministries mi on mi.id = a.ministry_id
      left join public.checklist_items ci on ci.assignment_id = a.id
     where a.meeting_id = p_meeting_id and a.status <> 'cancelada'
     group by a.person_id
  ),
  gente as (
    select person_id from asig
    union
    select at.person_id from public.attendance at where at.meeting_id = p_meeting_id
  )
  select g.person_id, p.full_name,
         coalesce(asig.roles, at.roles, '{}'), coalesce(asig.ministries, '{}'),
         asig.assignment_status,
         coalesce(asig.done, 0), coalesce(asig.total, 0),
         case when asig.assignment_status = 'aceptada' and asig.total > 0 and asig.done = asig.total then 'asistio'
              when asig.assignment_status = 'rechazada' then 'ausente'
              else null end,
         at.status, at.note
    from gente g
    join public.people p on p.id = g.person_id
    left join asig on asig.person_id = g.person_id
    left join public.attendance at on at.meeting_id = p_meeting_id and at.person_id = g.person_id
   where public.can_see_meeting(p_meeting_id)
     and public.can_confirm_attendance(p_meeting_id, g.person_id)
   order by p.full_name;
$$;
