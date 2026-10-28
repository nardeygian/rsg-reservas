-- =====================================================================
-- Etapa 5 · Servir — B5 Cuentas: invitaciones y eliminación de cuenta
-- =====================================================================
-- Plan: docs/portal/etapa-5-servir.md (6.1 y decisiones 1 y 10).
--
-- * account_invitations: un líder con servir.asignar en el alcance de la
--   persona la invita (correo o enlace para WhatsApp). Solo se guarda el
--   hash del token; el token en claro sale una sola vez al crearla.
--   De un solo uso, con vencimiento (7 días) y revocable.
-- * aceptar_invitacion(token): une la cuenta que inició sesión con la
--   persona (people.profile_id). No depende del correo, porque Apple puede
--   ocultarlo.
-- * account_provider_tokens: token de actualización de Apple para poder
--   revocarlo al eliminar la cuenta (App Store 5.1.1(v)). Solo service_role.
-- * cuenta_bloqueos_eliminacion / eliminar_datos_personales: apoyo para
--   "Eliminar mi cuenta" (service_role).
--
-- Migración aditiva e idempotente. Nada de esto cambia el login actual.
-- =====================================================================

-- ── 1. Invitaciones ─────────────────────────────────────────────────────

create table if not exists public.account_invitations (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.people(id) on delete cascade,
  token_hash   text not null unique,
  email        text,                                   -- null = enlace para compartir
  invited_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  revoked_at   timestamptz,
  check (expires_at > created_at)
);

create index if not exists account_invitations_person_idx on public.account_invitations (person_id);

alter table public.account_invitations enable row level security;

-- ¿Puede invitar a esta persona? servir.asignar global, o en el
-- departamento/área de alguno de sus equipos activos.
create or replace function public.can_invite_person(p_person_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_global_permission('servir.asignar')
      or exists (
        select 1 from public.team_members tm
         where tm.person_id = p_person_id and tm.active
           and public.can_assign(tm.ministry_id, tm.area_id)
      );
$$;

-- Lectura: quien puede invitar a esa persona ve sus invitaciones (sin
-- token: solo hay hash). Escritura solo por las funciones de abajo.
drop policy if exists "account_invitations: lectura" on public.account_invitations;
create policy "account_invitations: lectura" on public.account_invitations for select to authenticated
  using ((select public.can_invite_person(person_id)));

revoke insert, update, delete on public.account_invitations from anon, authenticated;
grant select on public.account_invitations to authenticated;

create or replace function public.invitation_token_hash(p_token text)
returns text
language sql immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Crea una invitación y devuelve el token en claro (única vez que existe).
-- Revoca las pendientes anteriores de la misma persona: un enlace vivo a la vez.
create or replace function public.crear_invitacion(p_person_id uuid, p_email text default null)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql volatile security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text;
  v_id uuid;
  v_exp timestamptz;
  v_email text := nullif(lower(trim(p_email)), '');
begin
  if auth.uid() is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;
  if not public.can_invite_person(p_person_id) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if exists (select 1 from public.people where id = p_person_id and profile_id is not null) then
    raise exception 'ya_tiene_cuenta' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo_invalido' using errcode = '22023';
  end if;

  update public.account_invitations ai
     set revoked_at = now()
   where ai.person_id = p_person_id and ai.accepted_at is null and ai.revoked_at is null;

  -- 24 bytes aleatorios en base64url (32 caracteres).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');

  insert into public.account_invitations (person_id, token_hash, email, invited_by)
  values (p_person_id, public.invitation_token_hash(v_token), v_email, auth.uid())
  returning id, account_invitations.expires_at into v_id, v_exp;

  return query select v_id, v_token, v_exp;
end;
$$;

create or replace function public.revocar_invitacion(p_invitation_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  update public.account_invitations ai
     set revoked_at = now()
   where ai.id = p_invitation_id and ai.accepted_at is null and ai.revoked_at is null
     and public.can_invite_person(ai.person_id);
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Lo mínimo para mostrar la página de la invitación, también sin sesión:
-- primer nombre de la persona, nombre de quien invita y estado. Sin el
-- token correcto no devuelve nada. es_mia: la persona ya es la cuenta actual.
drop function if exists public.ver_invitacion(text);
create function public.ver_invitacion(p_token text)
returns table (first_name text, invited_by_name text, status text, expires_at timestamptz, es_mia boolean)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select split_part(trim(p.full_name), ' ', 1),
         pr.full_name,
         case
           when ai.accepted_at is not null then 'aceptada'
           when ai.revoked_at  is not null then 'revocada'
           when ai.expires_at <= now()     then 'vencida'
           when p.profile_id is not null   then 'ya_tiene_cuenta'
           else 'pendiente'
         end,
         ai.expires_at,
         coalesce(auth.uid() is not null and p.profile_id = auth.uid(), false)
    from public.account_invitations ai
    join public.people p on p.id = ai.person_id
    left join public.profiles pr on pr.id = ai.invited_by
   where ai.token_hash = public.invitation_token_hash(p_token);
$$;

-- Une la cuenta actual con la persona de la invitación.
create or replace function public.aceptar_invitacion(p_token text)
returns uuid
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.account_invitations%rowtype;
  v_person public.people%rowtype;
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = '42501';
  end if;

  select * into v_inv from public.account_invitations
   where token_hash = public.invitation_token_hash(p_token)
   for update;
  if not found then
    raise exception 'no_encontrada' using errcode = 'P0002';
  end if;

  select * into v_person from public.people where id = v_inv.person_id for update;

  -- Reabrir el mismo enlace con la misma cuenta ya unida: idempotente.
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = v_uid and v_person.profile_id = v_uid then
      return v_person.id;
    end if;
    raise exception 'ya_usada' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'revocada' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'vencida' using errcode = 'P0001';
  end if;
  if v_person.profile_id is not null and v_person.profile_id <> v_uid then
    raise exception 'persona_con_otra_cuenta' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.people where profile_id = v_uid and id <> v_person.id) then
    raise exception 'cuenta_con_otra_persona' using errcode = 'P0001';
  end if;

  update public.people
     set profile_id = v_uid,
         email = coalesce(email, v_inv.email),
         updated_at = now()
   where id = v_person.id;

  update public.account_invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  return v_person.id;
end;
$$;

revoke all on function public.crear_invitacion(uuid, text)  from public, anon;
revoke all on function public.revocar_invitacion(uuid)      from public, anon;
revoke all on function public.aceptar_invitacion(text)      from public, anon;
revoke all on function public.can_invite_person(uuid)       from public, anon;
grant execute on function public.crear_invitacion(uuid, text) to authenticated;
grant execute on function public.revocar_invitacion(uuid)     to authenticated;
grant execute on function public.aceptar_invitacion(text)     to authenticated;
grant execute on function public.can_invite_person(uuid)      to authenticated;
grant execute on function public.ver_invitacion(text)         to anon, authenticated;

-- ── 2. Token de Apple para revocarlo al eliminar la cuenta ──────────────

create table if not exists public.account_provider_tokens (
  user_id        uuid not null references auth.users(id) on delete cascade,
  provider       text not null check (provider in ('apple')),
  refresh_token  text not null,
  updated_at     timestamptz not null default now(),
  primary key (user_id, provider)
);

-- RLS sin políticas: nadie fuera de service_role lo lee ni lo escribe.
alter table public.account_provider_tokens enable row level security;
revoke all on public.account_provider_tokens from anon, authenticated;
grant select, insert, update, delete on public.account_provider_tokens to service_role;

-- ── 3. Eliminar mi cuenta (service_role) ────────────────────────────────

-- Lo que impide borrar al usuario sin perder historia de Reservas
-- (llaves sin "on delete"). Reservas no se toca en esta etapa.
create or replace function public.cuenta_bloqueos_eliminacion(p_user_id uuid)
returns text[]
language sql stable security definer
set search_path = public, pg_temp
as $$
  select array_remove(array[
    case when exists (select 1 from public.bookings where created_by = p_user_id or payment_marked_by = p_user_id)
         then 'reservas' end,
    case when exists (select 1 from public.booking_audit where actor_id = p_user_id)
         then 'historial_reservas' end,
    case when exists (select 1 from public.ministries where lead_user_id = p_user_id)
         then 'lider_de_ministerio' end
  ], null);
$$;

-- Borra los datos personales que no se van en cascada con auth.users:
-- correo y teléfono en su registro de persona. El nombre y la historia de
-- servicio quedan (son registro de la iglesia), sin cuenta unida.
create or replace function public.eliminar_datos_personales(p_user_id uuid)
returns void
language sql volatile security definer
set search_path = public, pg_temp
as $$
  update public.people
     set email = null, phone = null, profile_id = null, updated_at = now()
   where profile_id = p_user_id;
$$;

revoke all on function public.cuenta_bloqueos_eliminacion(uuid) from public, anon, authenticated;
revoke all on function public.eliminar_datos_personales(uuid)   from public, anon, authenticated;
grant execute on function public.cuenta_bloqueos_eliminacion(uuid) to service_role;
grant execute on function public.eliminar_datos_personales(uuid)   to service_role;
