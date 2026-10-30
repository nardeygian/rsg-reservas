-- =====================================================================
-- Etapa 5 · Servir — notificaciones al instante
-- =====================================================================
-- Pedido de Gian (30 oct 2026): los avisos inmediatos deben llegar casi al
-- instante. En pruebas, un envío de un pastor a todos tardó de 5 a 7
-- minutos.
--
-- Causa: el despachador (Edge Function `notificador`) lo llamaba pg_cron
-- cada 5 minutos. El portal también lo llama después de un envío, pero
-- solo si Vercel tiene NOTIFICADOR_URL y NOTIFICADOR_SECRET. Y los avisos
-- automáticos (asignaciones, cambios de fecha, solicitudes, reservas)
-- dependían siempre de pg_cron.
--
-- Arreglo:
-- * Cada vez que se crea un aviso o un envío, la propia base llama al
--   despachador con pg_net. La llamada sale en cuanto la transacción
--   confirma (pg_net la encola dentro de la misma transacción), así que el
--   push llega en uno o dos segundos y no depende de la configuración de
--   la app.
-- * Una sola llamada por transacción: un envío a toda la iglesia crea
--   cientos de avisos en una sentencia y no dispara cientos de llamadas.
-- * pg_cron queda como red de seguridad cada minuto (recordatorios
--   programados, envíos para más tarde y cualquier llamada que falle).
-- Migración aditiva e idempotente.
-- =====================================================================

create or replace function public.notificador_despachar_ya()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Ya se pidió en esta transacción: el despachador tomará todo lo nuevo.
  if current_setting('notificador.pedido', true) = '1' then
    return null;
  end if;
  perform set_config('notificador.pedido', '1', true);
  perform public.notificador_disparar();
  return null;
exception when others then
  -- Nunca frenar la acción del usuario por el push: pg_cron lo recoge.
  raise warning '[notificador] no se pudo pedir el despacho: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.notificador_despachar_ya() from public, anon, authenticated;

drop trigger if exists notifications_despachar_ya on public.notifications;
create trigger notifications_despachar_ya
after insert on public.notifications
for each statement execute function public.notificador_despachar_ya();

drop trigger if exists broadcasts_despachar_ya on public.broadcasts;
create trigger broadcasts_despachar_ya
after insert on public.broadcasts
for each statement execute function public.notificador_despachar_ya();

-- Red de seguridad: cada minuto en vez de cada 5.
do $$
begin
  perform cron.unschedule('notificador') where exists (select 1 from cron.job where jobname = 'notificador');
  perform cron.schedule('notificador', '* * * * *', 'select public.notificador_disparar()');
end $$;
