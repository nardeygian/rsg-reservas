-- =====================================================================
-- Etapa 5 · Servir — directorio, lo que ve el servidor y agenda propia
-- =====================================================================
-- Decisiones de Gian (29 oct), después del QA de la Fase C:
--
-- 1. Directorio: quien no es del equipo de una persona solo ve su nombre y
--    su departamento. Teléfono, correo y notas quedan para la propia
--    persona, Planeación, pastor de sede (y fundador, super admin), el
--    líder de su equipo y el líder de su discipulado.
--    RLS filtra filas, no columnas: se revoca SELECT de esas columnas a
--    authenticated y el contacto sale por contacto_personas().
--
-- 2. El servidor (rol principal 'servidor' sin roles adicionales) no ve
--    Reservas: ni espacios ni bookings_calendar. Ve el calendario de
--    reuniones de RSG (agenda_reuniones) y el detalle solo de las reuniones
--    donde está asignado (can_see_meeting, sin cambios).
--
-- 3. La agenda de reuniones vive en la app (ya no en Asana):
--    agenda_reuniones() lista las reuniones publicadas para cualquier
--    usuario, con nombre, fecha, hora y tipo; las notas solo para quien
--    puede ver la reunión.
--
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── ¿Es solo servidor? ──────────────────────────────────────────────────
-- Mismo criterio que la navegación (lib/auth.ts): rol principal 'servidor'
-- y ningún rol adicional.
create or replace function public.es_solo_servidor()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'servidor')
     and not exists (select 1 from public.user_roles where user_id = auth.uid());
$$;
revoke all on function public.es_solo_servidor() from public, anon;
grant execute on function public.es_solo_servidor() to authenticated;

-- ── 1. Directorio ───────────────────────────────────────────────────────

revoke select on public.people from authenticated;
grant select (id, full_name, profile_id, discipleship_group_id, active, created_at, updated_at)
  on public.people to authenticated;

-- ¿Puede ver el teléfono, el correo y las notas de esta persona?
create or replace function public.can_see_person_contact(p_person_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.people p
     where p.id = p_person_id
       and (p.profile_id = auth.uid()
            or public.has_permission('servir.ver_todo')
            or exists (select 1 from public.team_members tm
                        where tm.person_id = p.id and tm.active
                          and public.can_assign(tm.ministry_id, tm.area_id))
            or exists (select 1 from public.discipleship_groups g
                        where g.id = p.discipleship_group_id and auth.uid() = any (g.leader_user_ids)))
  );
$$;

-- Contacto de varias personas: solo devuelve las que se pueden ver.
create or replace function public.contacto_personas(p_ids uuid[])
returns table (id uuid, full_name text, email text, phone text, notes text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.full_name, p.email, p.phone, p.notes
    from public.people p
   where p.id = any (p_ids)
     and public.can_see_person_contact(p.id);
$$;

-- Directorio para agregar gente a un equipo: nombre y departamentos.
create or replace function public.directorio_personas()
returns table (id uuid, full_name text, departamentos text[], tiene_cuenta boolean)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.full_name,
         coalesce(array_agg(distinct m.name order by m.name) filter (where m.id is not null), '{}'),
         p.profile_id is not null
    from public.people p
    left join public.team_members tm on tm.person_id = p.id and tm.active
    left join public.ministries m on m.id = tm.ministry_id
   where p.active
     and (public.has_permission('servir.ver_reuniones') or public.has_permission('servir.ver_todo'))
   group by p.id
   order by p.full_name;
$$;

revoke all on function public.can_see_person_contact(uuid) from public, anon;
revoke all on function public.contacto_personas(uuid[])    from public, anon;
revoke all on function public.directorio_personas()        from public, anon;
grant execute on function public.can_see_person_contact(uuid) to authenticated;
grant execute on function public.contacto_personas(uuid[])    to authenticated;
grant execute on function public.directorio_personas()        to authenticated;

-- ── 2. El servidor no ve Reservas ───────────────────────────────────────

drop policy if exists "leer spaces autenticados" on public.spaces;
create policy "leer spaces autenticados" on public.spaces for select to authenticated
  using (not (select public.es_solo_servidor()));

create or replace view public.bookings_calendar with (security_invoker = false) as
 select b.id,
    b.space_id,
    s.name as space_name,
    b.starts_at,
    b.ends_at,
    b.status,
        case
            when b.visibility = 'private_label'::text then 'Reserva externa'::text
            when b.use_type = 'consejeria'::text then 'Consejería'::text
            when b.is_external then 'Alquiler externo'::text
            else coalesce(m.name, 'RSG'::text)
        end as display_owner,
        case
            when b.visibility = 'private_label'::text then null::text
            else b.use_type
        end as use_type,
        case
            when b.montaje_lock then true
            else false
        end as has_montaje_lock,
    b.created_by,
        case
            when b.visibility = 'private_label'::text then null::text
            when b.use_type = 'consejeria'::text then null::text
            when b.is_external then null::text
            else b.title
        end as title,
    b.parent_booking_id,
    lower(b.time_range) as occupied_from,
    upper(b.time_range) as occupied_until
   from bookings b
     join spaces s on s.id = b.space_id
     left join ministries m on m.id = b.ministry_id
  where b.is_recurrence_template = false
    and not public.es_solo_servidor();

-- ── 3. Agenda de reuniones ──────────────────────────────────────────────

create or replace function public.agenda_reuniones(p_desde date, p_hasta date)
returns table (
  id uuid, name text, meeting_date date, starts_at timestamptz, ends_at timestamptz,
  status text, type_name text, type_color text, notes text,
  asignado boolean, ve_detalle boolean
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.id, m.name, m.meeting_date, m.starts_at, m.ends_at, m.status,
         t.name, t.color,
         case when public.can_see_meeting(m.id) then m.notes end,
         exists (select 1 from public.assignments a
                  where a.meeting_id = m.id and a.person_id = public.current_person_id()
                    and a.status in ('pendiente', 'aceptada')),
         public.can_see_meeting(m.id)
    from public.meetings m
    left join public.meeting_types t on t.id = m.meeting_type_id
   where m.meeting_date between p_desde and p_hasta
     and m.status in ('publicada', 'en_vivo', 'cerrada')
     and auth.uid() is not null
   order by m.meeting_date, m.starts_at nulls last, m.name;
$$;
revoke all on function public.agenda_reuniones(date, date) from public, anon;
grant execute on function public.agenda_reuniones(date, date) to authenticated;
