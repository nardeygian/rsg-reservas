-- =====================================================================
-- Etapa 5 · Servir — decisiones de Gian sobre cuentas (28 oct 2026)
-- =====================================================================
-- 1. Quien entra con Google o Apple sin invitación (o se registra con una
--    invitación) recibe el rol básico 'servidor', no 'leader'. El registro
--    por correo de hoy (líderes que piden un rol) sigue igual.
-- 2. El servidor escoge a qué departamento pertenece. El líder de ese
--    departamento, un pastor de sede o un super admin aprueba o rechaza
--    (team_join_requests). Al aprobar, la persona queda en el equipo.
-- 3. "Eliminar mi cuenta" ya no se bloquea por reservas: la persona confirma
--    y se borran también las reservas a su nombre. El historial de reservas
--    de otros queda, sin su nombre; si lideraba un ministerio, queda sin líder.
--
-- Un 'servidor' no puede crear reservas: la política de inserción de
-- bookings solo acepta leader, pastor_sede, admin_casa y super_admin.
-- Migración aditiva e idempotente.
-- =====================================================================

-- ── 1. Rol 'servidor' ───────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'leader', 'mentor', 'pastor_ministerio', 'pastor_sede', 'admin_casa',
    'studio_admin', 'super_admin', 'planeacion', 'fundador', 'servidor'
  ));

-- raw_app_meta_data.provider lo pone Supabase Auth (no lo controla el
-- usuario). 'via' = 'invitacion' viene del registro por invitación; como
-- solo puede bajar privilegios, no importa que el usuario lo controle.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp as $$
declare
  v_servidor boolean :=
    coalesce(new.raw_app_meta_data ->> 'provider', '') in ('google', 'apple')
    or coalesce(new.raw_user_meta_data ->> 'via', '') = 'invitacion';
begin
  insert into public.profiles (id, full_name, role, requested_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    case when v_servidor then 'servidor' else 'leader' end,
    case when v_servidor then null else nullif(new.raw_user_meta_data ->> 'requested_role', '') end
  );
  return new;
end;
$$;

-- El super admin puede dar los roles nuevos desde /admin.
create or replace function public.promote_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  begin
    if not current_role_is(array['super_admin']) then
      raise exception 'solo super_admin puede promover roles';
    end if;

    if new_role not in (
      'leader', 'mentor', 'pastor_ministerio', 'pastor_sede',
      'admin_casa', 'studio_admin', 'super_admin', 'planeacion', 'fundador', 'servidor'
    ) then
      raise exception 'rol inválido: %', new_role;
    end if;

    update public.profiles
      set role = new_role
      where id = target_user_id;
  end;
$function$;

-- ── 2. Solicitudes para unirse a un departamento ────────────────────────

create table if not exists public.team_join_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  ministry_id   uuid not null references public.ministries(id) on delete cascade,
  message       text,
  status        text not null default 'pendiente'
                  check (status in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  person_id     uuid references public.people(id) on delete set null,   -- al aprobar
  created_at    timestamptz not null default now()
);

-- Una sola solicitud pendiente por persona y departamento.
create unique index if not exists team_join_requests_pendiente_unq
  on public.team_join_requests (profile_id, ministry_id) where status = 'pendiente';
create index if not exists team_join_requests_ministry_idx
  on public.team_join_requests (ministry_id) where status = 'pendiente';

alter table public.team_join_requests enable row level security;

-- ¿Puede aprobar solicitudes de este departamento? Su líder de
-- departamento, un pastor de sede, un fundador o un super admin.
-- (Planeación no: no tiene servir.asignar.)
create or replace function public.can_approve_join(p_ministry_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_global_permission('servir.asignar')
      or public.has_permission('servir.asignar', 'departamento', p_ministry_id::text);
$$;

drop policy if exists "team_join_requests: lectura" on public.team_join_requests;
create policy "team_join_requests: lectura" on public.team_join_requests for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_approve_join(ministry_id));

-- Nadie escribe directo: todo pasa por las funciones de abajo.
revoke all on public.team_join_requests from anon, authenticated;
grant select on public.team_join_requests to authenticated;
grant all on public.team_join_requests to service_role;

-- El usuario actual pide unirse a un departamento.
create or replace function public.solicitar_unirse(p_ministry_id uuid, p_message text default null)
returns uuid
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_dep public.ministries%rowtype;
  v_nombre text;
  v_nueva boolean;
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  select * into v_dep from public.ministries where id = p_ministry_id and type = 'departamento';
  if not found then
    raise exception 'departamento_invalido' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_members tm join public.people p on p.id = tm.person_id
              where p.profile_id = v_uid and tm.ministry_id = p_ministry_id and tm.active) then
    raise exception 'ya_es_miembro' using errcode = 'P0001';
  end if;

  insert into public.team_join_requests (profile_id, ministry_id, message)
  values (v_uid, p_ministry_id, nullif(left(trim(p_message), 500), ''))
  on conflict (profile_id, ministry_id) where status = 'pendiente'
  do update set message = excluded.message
  returning id, (xmax = 0) into v_id, v_nueva;

  -- Aviso a los líderes del departamento (llega a su bandeja y por push),
  -- solo la primera vez: pedir otra vez solo cambia el mensaje.
  if not v_nueva then
    return v_id;
  end if;
  select full_name into v_nombre from public.profiles where id = v_uid;
  insert into public.notifications (user_id, kind, title, body, link)
  select distinct ur.user_id, 'solicitud_equipo',
         'Solicitud para unirse a ' || v_dep.name,
         coalesce(v_nombre, 'Alguien') || ' quiere servir en ' || v_dep.name || '.',
         '/servir/equipo?dep=' || v_dep.id || '&vista=solicitudes'
    from public.user_roles ur
   where ur.role = 'lider_departamento' and ur.ministry_id = p_ministry_id and ur.user_id <> v_uid;

  return v_id;
end;
$$;

create or replace function public.cancelar_solicitud(p_request_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  update public.team_join_requests
     set status = 'cancelada', decided_at = now(), decided_by = auth.uid()
   where id = p_request_id and profile_id = auth.uid() and status = 'pendiente';
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Aprobar o rechazar. Al aprobar: la cuenta queda unida a una persona (la
-- que ya tenga, o una nueva con su nombre y correo) y entra al equipo.
create or replace function public.responder_solicitud(p_request_id uuid, p_aprobar boolean, p_nota text default null)
returns uuid
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.team_join_requests%rowtype;
  v_person uuid;
  v_dep text;
begin
  select * into v_req from public.team_join_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pendiente' then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
  if not public.can_approve_join(v_req.ministry_id) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;

  select name into v_dep from public.ministries where id = v_req.ministry_id;

  if p_aprobar then
    select id into v_person from public.people where profile_id = v_req.profile_id;
    if v_person is null then
      insert into public.people (full_name, email, profile_id)
      select pr.full_name, u.email, pr.id
        from public.profiles pr left join auth.users u on u.id = pr.id
       where pr.id = v_req.profile_id
      returning id into v_person;
    end if;

    update public.team_members set active = true
     where person_id = v_person and ministry_id = v_req.ministry_id and area_id is null;
    if not found then
      insert into public.team_members (person_id, ministry_id) values (v_person, v_req.ministry_id);
    end if;
  end if;

  update public.team_join_requests
     set status = case when p_aprobar then 'aprobada' else 'rechazada' end,
         decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(left(trim(p_nota), 500), ''),
         person_id = v_person
   where id = v_req.id;

  insert into public.notifications (user_id, kind, title, body, link)
  values (v_req.profile_id, 'solicitud_equipo',
          case when p_aprobar then 'Ya eres parte de ' || v_dep else 'Tu solicitud a ' || v_dep || ' no fue aprobada' end,
          case when p_aprobar then 'Tu líder ya puede asignarte en las reuniones.'
               else coalesce(nullif(trim(p_nota), ''), 'Puedes hablar con el líder del departamento.') end,
          '/servir/mis-servicios');

  return v_person;
end;
$$;

revoke all on function public.can_approve_join(uuid)                     from public, anon;
revoke all on function public.solicitar_unirse(uuid, text)               from public, anon;
revoke all on function public.cancelar_solicitud(uuid)                   from public, anon;
revoke all on function public.responder_solicitud(uuid, boolean, text)   from public, anon;
grant execute on function public.can_approve_join(uuid)                   to authenticated;
grant execute on function public.solicitar_unirse(uuid, text)             to authenticated;
grant execute on function public.cancelar_solicitud(uuid)                 to authenticated;
grant execute on function public.responder_solicitud(uuid, boolean, text) to authenticated;

-- ── 3. Eliminar mi cuenta con sus reservas ──────────────────────────────

-- Lo que se borrará, para mostrarlo en la pregunta de confirmación.
create or replace function public.cuenta_resumen_eliminacion(p_user_id uuid)
returns table (reservas int, reservas_futuras int, ministerios_que_lidera int)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select (select count(*)::int from public.bookings b where b.created_by = p_user_id and b.parent_booking_id is null),
         (select count(*)::int from public.bookings b where b.created_by = p_user_id and b.parent_booking_id is null
            and b.ends_at > now() and b.status not in ('cancelled', 'rejected')),
         (select count(*)::int from public.ministries m where m.lead_user_id = p_user_id);
$$;

-- Ya no bloquea por reservas: solo queda como apoyo por compatibilidad
-- (las llaves sin "on delete" se limpian en eliminar_datos_personales).
create or replace function public.cuenta_bloqueos_eliminacion(p_user_id uuid)
returns text[]
language sql stable security definer
set search_path = public, pg_temp
as $$
  select '{}'::text[];
$$;

-- Borra los datos personales que no se van en cascada con auth.users:
-- * sus reservas (con sus ítems, enlaces, bitácora e instancias hijas);
-- * su nombre en el historial y en los pagos de reservas de otros;
-- * su liderazgo de ministerios;
-- * correo, teléfono y cuenta unida en su registro de persona (el nombre y
--   la historia de servicio quedan para la iglesia).
create or replace function public.eliminar_datos_personales(p_user_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.bookings where created_by = p_user_id and parent_booking_id is not null;
  delete from public.bookings where created_by = p_user_id;
  update public.bookings set payment_marked_by = null where payment_marked_by = p_user_id;
  update public.booking_audit set actor_id = null where actor_id = p_user_id;
  update public.ministries set lead_user_id = null where lead_user_id = p_user_id;

  update public.people
     set email = null, phone = null, profile_id = null, updated_at = now()
   where profile_id = p_user_id;
end;
$$;

revoke all on function public.cuenta_resumen_eliminacion(uuid)  from public, anon, authenticated;
revoke all on function public.cuenta_bloqueos_eliminacion(uuid) from public, anon, authenticated;
revoke all on function public.eliminar_datos_personales(uuid)   from public, anon, authenticated;
grant execute on function public.cuenta_resumen_eliminacion(uuid)  to service_role;
grant execute on function public.cuenta_bloqueos_eliminacion(uuid) to service_role;
grant execute on function public.eliminar_datos_personales(uuid)   to service_role;
