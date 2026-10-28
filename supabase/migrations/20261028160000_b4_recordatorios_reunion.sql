-- =====================================================================
-- Etapa 5 · Servir — B4: los recordatorios siguen a la reunión
-- =====================================================================
-- reminders.send_at se calcula al crear o aceptar la asignación
-- (assignments_after_change). Si después la reunión cambia de fecha u hora,
-- se cancela o se restaura, este trigger los pone al día:
--
-- * Cancelada: se borran los recordatorios pendientes.
-- * Reprogramada o restaurada: se recalculan con la misma fórmula
--   (sin_respuesta = least(ahora + 48 h, inicio − 24 h); manana = inicio − 24 h;
--   dos_horas = inicio − 2 h) para las asignaciones pendientes y aceptadas.
--   - Un pendiente se mueve a su nueva hora.
--   - Uno ya enviado se vuelve a armar solo si su nueva hora es futura (la
--     reunión se movió lo bastante como para que el aviso vuelva a tener
--     sentido).
--   - Si la nueva hora ya pasó, se descarta (queda marcado como enviado):
--     no se mandan avisos viejos de golpe. La persona ya recibe el aviso de
--     "cambió de fecha" (meeting_changes_notify) con la hora nueva.
-- =====================================================================

create or replace function public.meetings_reminders_sync()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := public.meeting_start(new);
begin
  if new.status = 'cancelada' then
    if old.status is distinct from 'cancelada' then
      delete from public.reminders r
       using public.assignments a
       where a.id = r.assignment_id and a.meeting_id = new.id and r.sent_at is null;
    end if;
    return new;
  end if;

  if old.status is distinct from 'cancelada' and v_start is not distinct from public.meeting_start(old) then
    return new;
  end if;

  insert into public.reminders (assignment_id, kind, send_at, sent_at)
  select a.id, k.kind, k.send_at, case when k.send_at <= now() then now() end
    from public.assignments a
    cross join lateral (
      select 'sin_respuesta'::text as kind, least(now() + interval '48 hours', v_start - interval '24 hours') as send_at
       where a.status = 'pendiente'
      union all
      select 'manana', v_start - interval '24 hours' where a.status = 'aceptada'
      union all
      select 'dos_horas', v_start - interval '2 hours' where a.status = 'aceptada'
    ) k
   where a.meeting_id = new.id
  on conflict (assignment_id, kind) do update
     set send_at = excluded.send_at,
         sent_at = excluded.sent_at
   where public.reminders.sent_at is null or excluded.sent_at is null;

  return new;
end;
$$;

drop trigger if exists meetings_reminders_sync on public.meetings;
create trigger meetings_reminders_sync after update of meeting_date, starts_at, status on public.meetings
  for each row execute function public.meetings_reminders_sync();

revoke all on function public.meetings_reminders_sync() from public, anon, authenticated;
