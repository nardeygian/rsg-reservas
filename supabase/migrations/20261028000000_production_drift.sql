-- =====================================================================
-- RSG Reservas — drift de producción
-- =====================================================================
-- Documenta cambios que se aplicaron directamente en el dashboard de
-- Supabase y nunca tuvieron archivo de migración:
--   * profiles.avatar_url, profiles.panel_url
--   * promote_user_role(), sync_profile_from_oauth()
--   * trigger on_auth_user_updated en auth.users
--
-- En producción NO se ejecuta: se marca con
--   supabase migration repair --status applied 20261028000000
-- (solo cuando Gian lo autorice). En local se aplica con db reset.
-- Todas las operaciones son idempotentes.
-- =====================================================================

-- Columnas que existen en producción sin archivo previo
alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists panel_url text;

-- Función: permite a un super_admin cambiar el rol de cualquier usuario.
-- Definición exacta copiada de pg_get_functiondef en producción.
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
      'admin_casa', 'studio_admin', 'super_admin'
    ) then
      raise exception 'rol inválido: %', new_role;
    end if;

    update public.profiles
      set role = new_role
      where id = target_user_id;
  end;
$function$;

-- Función trigger: copia avatar_url de Google OAuth a profiles.
-- Definición exacta copiada de pg_get_functiondef en producción.
create or replace function public.sync_profile_from_oauth()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  begin
    update public.profiles
      set avatar_url = new.raw_user_meta_data->>'avatar_url'
    where id = new.id
      and avatar_url is null
      and new.raw_user_meta_data->>'avatar_url' is not null;
    return new;
  end;
$function$;

-- Trigger en auth.users que llama sync_profile_from_oauth.
-- DDL exacto de pg_get_triggerdef en producción; DROP IF EXISTS para idempotencia.
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row
when (
  (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  and ((new.raw_user_meta_data ->> 'avatar_url'::text) is not null)
)
execute function public.sync_profile_from_oauth();
