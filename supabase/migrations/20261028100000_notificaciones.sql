-- =====================================================================
-- Etapa 5 · Servir — B4 Notificaciones
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (secciones 6 y 6.1).
--
-- Un solo despachador: toda notificación se inserta en `notifications`
-- (bandeja) y la Edge Function `notificador` manda el push de las que
-- tengan `pushed_at` nulo. Quien genera avisos (recordatorios, envíos,
-- asignaciones, cambios de reunión) solo inserta filas; nunca llama al push.
--
-- `pg_cron` llama a `notificador` cada 5 minutos (Vercel Hobby solo permite
-- crons diarios). La URL y el secreto viven en Vault, nunca en el código:
--   select vault.create_secret('<url>/functions/v1/notificador', 'notificador_url');
--   select vault.create_secret('<NOTIFICADOR_SECRET>', 'notificador_secret');
-- Sin esos secretos el cron no hace nada.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ── Bandeja ─────────────────────────────────────────────────────────────
alter table public.notifications add column if not exists pushed_at timestamptz;
create index if not exists notifications_push_idx on public.notifications (created_at) where pushed_at is null;
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- La bandeja se actualiza sola (RLS de notifications aplica a Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ── Textos ──────────────────────────────────────────────────────────────
-- "domingo 9 de noviembre, 9:00 a. m." en hora de Bogotá.
create or replace function public.notif_cuando(p_ts timestamptz)
returns text
language sql stable
set search_path = public, pg_temp
as $$
  select (array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])[extract(dow from l)::int + 1]
         || ' ' || extract(day from l)::int || ' de '
         || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from l)::int]
         || ', ' || ((extract(hour from l)::int + 11) % 12 + 1) || ':' || to_char(l, 'MI')
         || case when extract(hour from l) < 12 then ' a. m.' else ' p. m.' end
    from (select p_ts at time zone 'America/Bogota' as l) t;
$$;

-- ── Destinatarios de un envío ───────────────────────────────────────────
-- Cuentas (profiles) de los servidores de la audiencia. Quien no tiene
-- cuenta no recibe nada (queda para el correo de respaldo).
create or replace function public.broadcast_recipients(p_audience text, p_scope_id text)
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select distinct p.profile_id
    from public.team_members tm
    join public.people p on p.id = tm.person_id
   where p.profile_id is not null and p.active and tm.active
     and (p_audience = 'todos'
          or (p_audience = 'departamento' and tm.ministry_id::text = p_scope_id)
          or (p_audience = 'area' and tm.area_id::text = p_scope_id))
  union
  select distinct p.profile_id
    from public.assignments a
    join public.people p on p.id = a.person_id
   where p_audience = 'reunion' and a.meeting_id::text = p_scope_id
     and a.status in ('pendiente', 'aceptada') and p.profile_id is not null;
$$;

-- ── Avisos automáticos ──────────────────────────────────────────────────
-- Asignación nueva → al servidor. Rechazo → a quien asignó.
create or replace function public.assignments_notify()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select pe.profile_id, pe.full_name, po.name as posicion, m.name as reunion,
         public.meeting_start(m) as inicio, m.status as estado_reunion
    into v
    from public.people pe, public.positions po, public.meetings m
   where pe.id = new.person_id and po.id = new.position_id and m.id = new.meeting_id;

  if new.status = 'pendiente' and (tg_op = 'INSERT' or old.status is distinct from 'pendiente')
     and v.profile_id is not null and v.estado_reunion <> 'cancelada' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v.profile_id, 'asignacion', 'Te asignaron ' || v.posicion,
            v.reunion || ', ' || public.notif_cuando(v.inicio) || '. Acepta o rechaza con un toque.',
            '/servir/mis-servicios');
  end if;

  if tg_op = 'UPDATE' and new.status = 'rechazada' and old.status is distinct from 'rechazada'
     and new.assigned_by is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.assigned_by, 'rechazo', v.full_name || ' no puede servir',
            v.posicion || ' · ' || v.reunion || ', ' || public.notif_cuando(v.inicio)
              || coalesce('. Motivo: ' || new.decline_reason, '') || '. Asigna a alguien más.',
            '/servir/equipo');
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify after insert or update of status on public.assignments
  for each row execute function public.assignments_notify();

-- Reunión reprogramada, cancelada o restaurada → a sus asignados.
create or replace function public.meeting_changes_notify()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.meetings;
  v_title text;
  v_body text;
begin
  select * into v_m from public.meetings where id = new.meeting_id;

  if new.change = 'reprogramada' then
    v_title := v_m.name || ' cambió de fecha';
    v_body := 'Ahora es el ' || public.notif_cuando(
      coalesce(new.new_starts_at, (new.new_date + time '09:00') at time zone 'America/Bogota', public.meeting_start(v_m))) || '.';
  elsif new.change = 'cancelada' then
    v_title := v_m.name || ' se canceló';
    v_body := 'La reunión del ' || public.notif_cuando(public.meeting_start(v_m)) || ' no va.';
  else
    v_title := v_m.name || ' vuelve a estar en pie';
    v_body := 'Es el ' || public.notif_cuando(public.meeting_start(v_m)) || '.';
  end if;
  v_body := v_body || coalesce(' ' || nullif(trim(new.reason), ''), '');

  insert into public.notifications (user_id, kind, title, body, link)
  select distinct p.profile_id, 'cambio_reunion', v_title, v_body, '/servir/mis-servicios'
    from public.assignments a
    join public.people p on p.id = a.person_id
   where a.meeting_id = new.meeting_id
     and a.status in ('pendiente', 'aceptada')
     and p.profile_id is not null
     and p.profile_id is distinct from new.actor_id;

  return new;
end;
$$;

drop trigger if exists meeting_changes_notify on public.meeting_changes;
create trigger meeting_changes_notify after insert on public.meeting_changes
  for each row execute function public.meeting_changes_notify();

-- ── Despachador ─────────────────────────────────────────────────────────
-- Convierte recordatorios vencidos y envíos programados en notificaciones.
-- Concurrencia: cada fila se toma con SKIP LOCKED y se marca enviada en la
-- misma transacción, así dos corridas a la vez no duplican nada.
create or replace function public.notificador_procesar()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  b record;
  v_rem int := 0;
  v_env int := 0;
  v_count int;
begin
  for r in
    select rm.id, rm.kind, a.status, m.status as estado_reunion, m.name as reunion,
           public.meeting_start(m) as inicio, po.name as posicion, pe.profile_id
      from public.reminders rm
      join public.assignments a on a.id = rm.assignment_id
      join public.meetings m on m.id = a.meeting_id
      join public.positions po on po.id = a.position_id
      join public.people pe on pe.id = a.person_id
     where rm.sent_at is null and rm.send_at <= now()
     order by rm.send_at
     for update of rm skip locked
  loop
    update public.reminders set sent_at = now() where id = r.id;

    -- Se descarta (queda marcado) si ya no aplica.
    continue when r.profile_id is null or r.estado_reunion = 'cancelada' or r.inicio <= now();
    continue when r.kind = 'sin_respuesta' and r.status <> 'pendiente';
    continue when r.kind in ('manana', 'dos_horas') and r.status <> 'aceptada';
    -- Si "mañana" llega tarde, el de "dos horas" ya lo cubre.
    continue when r.kind = 'manana' and r.inicio < now() + interval '3 hours';

    insert into public.notifications (user_id, kind, title, body, link)
    values (
      r.profile_id,
      'recordatorio',
      case r.kind
        when 'sin_respuesta' then 'Tienes una asignación sin responder'
        when 'manana' then 'Mañana sirves'
        else 'Empezamos en 2 horas'
      end,
      r.posicion || ' · ' || r.reunion || ', ' || public.notif_cuando(r.inicio) || '. '
        || case r.kind
             when 'sin_respuesta' then 'Acepta o rechaza en la app.'
             when 'manana' then 'Revisa tu checklist de preparación.'
             else 'Te esperamos.'
           end,
      '/servir/mis-servicios'
    );
    v_rem := v_rem + 1;
  end loop;

  for b in
    select * from public.broadcasts
     where sent_at is null and scheduled_for <= now()
     order by scheduled_for
     for update skip locked
  loop
    insert into public.notifications (user_id, kind, title, body, link, broadcast_id)
    select u, 'envio', b.title, b.body, b.link, b.id
      from public.broadcast_recipients(b.audience, b.scope_id) u;
    get diagnostics v_count = row_count;
    update public.broadcasts set sent_at = now(), recipients_count = v_count where id = b.id;
    v_env := v_env + 1;
  end loop;

  return jsonb_build_object('recordatorios', v_rem, 'envios', v_env);
end;
$$;

-- Toma las notificaciones que faltan por push y las marca. Las de más de un
-- día sin push se dan por perdidas (siguen en la bandeja).
create or replace function public.notificador_por_enviar(p_limit int default 200)
returns table (id uuid, user_id uuid, kind text, title text, body text, link text)
language sql security definer
set search_path = public, pg_temp
as $$
  update public.notifications set pushed_at = now()
   where pushed_at is null and created_at <= now() - interval '1 day';

  update public.notifications n set pushed_at = now()
   where n.id in (
     select x.id from public.notifications x
      where x.pushed_at is null
      order by x.created_at
      limit p_limit
      for update skip locked)
  returning n.id, n.user_id, n.kind, n.title, n.body, n.link;
$$;

-- Lo llama pg_cron. Solo hace la llamada HTTP si hay algo pendiente.
create or replace function public.notificador_disparar()
returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.reminders where sent_at is null and send_at <= now())
     and not exists (select 1 from public.broadcasts where sent_at is null and scheduled_for <= now())
     and not exists (select 1 from public.notifications where pushed_at is null) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notificador_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notificador_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;

  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notificador-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

do $$
begin
  perform cron.unschedule('notificador') where exists (select 1 from cron.job where jobname = 'notificador');
  perform cron.schedule('notificador', '*/5 * * * *', 'select public.notificador_disparar()');
end $$;

-- ── Dispositivos ────────────────────────────────────────────────────────
-- Registra (o reasigna) un dispositivo a quien inició sesión. Si el mismo
-- navegador o teléfono lo usaba otra cuenta, pasa a la cuenta actual.
create or replace function public.register_push_device(
  p_platform    text,
  p_endpoint    text default null,
  p_p256dh      text default null,
  p_auth        text default null,
  p_token       text default null,
  p_device      text default null,
  p_app_version text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para activar las notificaciones' using errcode = '42501';
  end if;
  if p_platform = 'web' and (p_endpoint is null or p_p256dh is null or p_auth is null) then
    raise exception 'Suscripción web incompleta' using errcode = '22023';
  end if;

  delete from public.push_subscriptions
   where (p_endpoint is not null and endpoint = p_endpoint)
      or (p_token is not null and token = p_token);

  insert into public.push_subscriptions (user_id, platform, endpoint, token, p256dh, auth, device, app_version)
  values (auth.uid(), p_platform,
          case when p_platform = 'web' then p_endpoint end,
          case when p_platform <> 'web' then p_token end,
          p_p256dh, p_auth, left(p_device, 200), left(p_app_version, 40))
  returning id into v_id;
  return v_id;
end;
$$;

-- ── Audiencias ──────────────────────────────────────────────────────────
-- Un líder de departamento también puede escribirle a un área de su
-- departamento. El resto de la política queda igual que en la Fase A.
drop policy if exists "broadcasts: crear" on public.broadcasts;
create policy "broadcasts: crear" on public.broadcasts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and sent_at is null and recipients_count is null
    and (
      (audience = 'todos' and (select public.has_global_permission('notificar.enviar')))
      or (audience = 'departamento' and public.has_permission('notificar.enviar', 'departamento', scope_id))
      or (audience = 'area' and (
            public.has_permission('notificar.enviar', 'area', scope_id)
            or exists (select 1 from public.areas a
                        where a.id::text = scope_id
                          and public.has_permission('notificar.enviar', 'departamento', a.ministry_id::text))))
      or (audience = 'reunion' and (select public.has_permission('servir.planear')))
    )
  );

-- Audiencias que puede usar quien pregunta (para armar el formulario; la
-- política de arriba es la que manda).
create or replace function public.my_broadcast_audiences()
returns table (audience text, scope_id text, label text)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select 'todos'::text, null::text, 'Todos los servidores'::text
   where public.has_global_permission('notificar.enviar')
  union all
  select 'departamento', m.id::text, m.name
    from public.ministries m
   where m.type = 'departamento' and public.has_permission('notificar.enviar', 'departamento', m.id::text)
  union all
  select 'area', a.id::text, m.name || ' · ' || a.name
    from public.areas a join public.ministries m on m.id = a.ministry_id
   where public.has_permission('notificar.enviar', 'area', a.id::text)
      or public.has_permission('notificar.enviar', 'departamento', a.ministry_id::text)
  union all
  select 'reunion', mt.id::text, mt.name || ' · ' || to_char(mt.meeting_date, 'DD/MM')
    from public.meetings mt
   where public.has_permission('servir.planear')
     and mt.status in ('borrador', 'publicada', 'en_vivo')
     and mt.meeting_date between current_date and current_date + 45
  order by 1, 3;
$$;

-- ── Acceso ──────────────────────────────────────────────────────────────
revoke all on function public.broadcast_recipients(text, text) from public, anon, authenticated;
revoke all on function public.notificador_procesar() from public, anon, authenticated;
revoke all on function public.notificador_por_enviar(int) from public, anon, authenticated;
revoke all on function public.notificador_disparar() from public, anon, authenticated;
revoke all on function public.register_push_device(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.my_broadcast_audiences() from public, anon;
revoke all on function public.assignments_notify() from public, anon, authenticated;
revoke all on function public.meeting_changes_notify() from public, anon, authenticated;

grant execute on function public.broadcast_recipients(text, text),
                          public.notificador_procesar(),
                          public.notificador_por_enviar(int) to service_role;
grant execute on function public.register_push_device(text, text, text, text, text, text, text),
                          public.my_broadcast_audiences(),
                          public.notif_cuando(timestamptz) to authenticated;
