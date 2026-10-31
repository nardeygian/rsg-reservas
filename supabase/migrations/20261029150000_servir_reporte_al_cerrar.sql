-- =====================================================================
-- Etapa 5 · Servir — el reporte se genera con cualquier cierre
-- =====================================================================
-- Una reunión se cierra con "Terminar reunión" (terminar_reunion) o con
-- "Confirmar y cerrar" la asistencia (confirmar_asistencia con p_cerrar),
-- que también la deja cerrada. El reporte y su aviso se armaban solo en el
-- primer camino. Ahora los arma un trigger cuando la reunión pasa a
-- 'cerrada' sin reporte, y terminar_reunion solo cierra.
--
-- Migración aditiva e idempotente.
-- =====================================================================

-- Aviso del reporte a Planeación y a los pastores de sede.
create or replace function public.avisar_reporte_reunion(p_meeting_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_dif numeric;
  v_cambios int;
  r record;
begin
  select * into v_m from public.meetings where id = p_meeting_id;
  v_dif := (v_m.report ->> 'diferencia_fin_min')::numeric;
  select count(*) into v_cambios from public.meeting_live_changes where meeting_id = p_meeting_id;
  for r in select distinct p.id from public.profiles p
            where p.role in ('planeacion', 'pastor_sede', 'fundador')
               or exists (select 1 from public.user_roles ur
                           where ur.user_id = p.id and ur.role in ('servidor_planeacion', 'pastor_sede', 'fundador')) loop
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.id, 'reporte_reunion', 'Reporte: ' || v_m.name,
            concat_ws(' · ',
              case when v_dif is null then null
                   when v_dif > 0 then 'terminó ' || v_dif || ' min tarde'
                   when v_dif < 0 then 'terminó ' || abs(v_dif) || ' min antes'
                   else 'terminó a tiempo' end,
              case when v_cambios > 0 then v_cambios || ' cambios en vivo' end),
            '/servir/reuniones/' || p_meeting_id);
  end loop;
end;
$$;

create or replace function public.meetings_reporte_al_cerrar()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cerrada' and old.status is distinct from 'cerrada' and new.report is null then
    -- Puntos que seguían abiertos terminan con la reunión.
    update public.run_items set actual_end = coalesce(new.actual_end, now())
     where meeting_id = new.id and actual_start is not null and actual_end is null;
    update public.meetings set report = public.armar_reporte_reunion(new.id) where id = new.id;
    perform public.avisar_reporte_reunion(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists meetings_reporte_al_cerrar on public.meetings;
create trigger meetings_reporte_al_cerrar after update of status on public.meetings
  for each row execute function public.meetings_reporte_al_cerrar();

create or replace function public.terminar_reunion(p_meeting_id uuid)
returns public.meetings
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
begin
  if not public.has_permission('servir.vivo') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select * into v_m from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if v_m.status = 'cerrada' then
    return v_m;
  end if;
  if v_m.status <> 'en_vivo' then
    raise exception 'estado_invalido' using errcode = 'P0001', hint = 'La reunión no está en vivo.';
  end if;

  update public.run_items set actual_end = now()
   where meeting_id = p_meeting_id and actual_start is not null and actual_end is null;
  -- El reporte y su aviso los arma meetings_reporte_al_cerrar.
  update public.meetings
     set status = 'cerrada', current_item_id = null, actual_end = now()
   where id = p_meeting_id;
  select * into v_m from public.meetings where id = p_meeting_id;
  return v_m;
end;
$$;

revoke all on function public.avisar_reporte_reunion(uuid)   from public, anon, authenticated;
revoke all on function public.meetings_reporte_al_cerrar()   from public, anon, authenticated;

-- Reuniones que ya se cerraron sin reporte (en local, durante el QA).
update public.meetings set report = public.armar_reporte_reunion(id)
 where status = 'cerrada' and report is null and actual_start is not null;
