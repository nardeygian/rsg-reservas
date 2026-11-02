-- =====================================================================
-- Etapa 5 · Servir — quién borra reuniones
-- =====================================================================
-- Decisión de Gian (31 oct):
-- * Una reunión que ya pasó (fecha anterior a hoy, o en vivo o cerrada)
--   solo la borra el super admin: ya tiene asistencia y cuenta en las
--   estadísticas.
-- * Una que todavía no pasa la borran también Planeación y el pastor de
--   sede (servir.planear global: Planeación, pastor de sede, fundador y
--   super admin).
-- Se borran en cascada su orden, equipo asignado, asistencia e historial;
-- el trigger meetings_sync_reservas_borrar libera sus reservas de espacios.
-- La fecha de hoy es la de la organización (zona de las reuniones).
-- =====================================================================

create or replace function public.reunion_ya_paso(p_meeting_date date, p_status text)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select p_status in ('en_vivo', 'cerrada')
      or p_meeting_date < (now() at time zone 'America/Bogota')::date;
$$;

grant execute on function public.reunion_ya_paso(date, text) to authenticated;

drop policy if exists "meetings: borrar" on public.meetings;
create policy "meetings: borrar" on public.meetings for delete to authenticated
  using (
    (select public.is_super_admin())
    or (not public.reunion_ya_paso(meeting_date, status)
        and (select public.has_global_permission('servir.planear')))
  );
