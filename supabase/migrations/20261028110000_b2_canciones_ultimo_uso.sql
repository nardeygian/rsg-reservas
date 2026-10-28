-- =====================================================================
-- B2 · Canciones: songs.last_used_on se mantiene solo.
--
-- last_used_on = la fecha más reciente de una reunión (no borrador ni
-- cancelada) que lleva la canción en su orden. Puede ser futura: así
-- Planeación ve que ya está programada. Se recalcula cuando cambia el
-- orden (run_items) o la fecha/estado de una reunión.
--
-- security definer: quien arma el orden (servir.planear) no siempre tiene
-- canciones.editar, y la fecha de uso no es un dato que deba poder editar.
-- =====================================================================

create or replace function public.refresh_song_last_used(p_song_ids uuid[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.songs s
     set last_used_on = (
       select max(m.meeting_date)
         from public.run_items ri
         join public.meetings m on m.id = ri.meeting_id
        where ri.song_id = s.id
          and m.status not in ('borrador', 'cancelada')
     )
   where s.id = any (p_song_ids)
     and s.last_used_on is distinct from (
       select max(m.meeting_date)
         from public.run_items ri
         join public.meetings m on m.id = ri.meeting_id
        where ri.song_id = s.id
          and m.status not in ('borrador', 'cancelada')
     );
$$;

revoke execute on function public.refresh_song_last_used(uuid[]) from public, anon, authenticated;

create or replace function public.run_items_refresh_song_last_used()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ids uuid[] := '{}';
begin
  if tg_op in ('INSERT', 'UPDATE') and new.song_id is not null then
    ids := ids || new.song_id;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.song_id is not null then
    ids := ids || old.song_id;
  end if;
  if cardinality(ids) > 0 then
    perform public.refresh_song_last_used(ids);
  end if;
  return null;
end;
$$;

drop trigger if exists run_items_song_last_used on public.run_items;
create trigger run_items_song_last_used
  after insert or delete or update of song_id, meeting_id on public.run_items
  for each row execute function public.run_items_refresh_song_last_used();

create or replace function public.meetings_refresh_song_last_used()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.refresh_song_last_used(array(
    select distinct ri.song_id from public.run_items ri
     where ri.meeting_id = new.id and ri.song_id is not null
  ));
  return null;
end;
$$;

drop trigger if exists meetings_song_last_used on public.meetings;
create trigger meetings_song_last_used
  after update of status, meeting_date on public.meetings
  for each row
  when (old.status is distinct from new.status or old.meeting_date is distinct from new.meeting_date)
  execute function public.meetings_refresh_song_last_used();

revoke execute on function public.run_items_refresh_song_last_used() from public, anon, authenticated;
revoke execute on function public.meetings_refresh_song_last_used() from public, anon, authenticated;

-- Llenar lo que ya existe.
select public.refresh_song_last_used(array(select id from public.songs));
