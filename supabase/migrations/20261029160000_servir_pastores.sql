-- =====================================================================
-- Etapa 5 · Servir — pastores en los roles generales
-- =====================================================================
-- Un pastor (fundador, de sede o de ministerio) no suele estar en un
-- departamento, pero Planeación lo asigna a predicar o a un rol general
-- (VIO, Escenario, Predicador). Para eso necesita una ficha en `people` y
-- aparecer entre los candidatos de los roles generales.
--
-- Migración aditiva e idempotente.
-- =====================================================================

create or replace function public.es_pastor(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles
                  where id = p_user_id and role in ('fundador', 'pastor_sede', 'pastor_ministerio'))
      or exists (select 1 from public.user_roles
                  where user_id = p_user_id and role in ('fundador', 'pastor_sede', 'pastor_ministerio'));
$$;

-- La pantalla Mis servicios pregunta por la persona que entra.
create or replace function public.soy_pastor()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select public.es_pastor(auth.uid()); $$;

-- Crea la ficha del pastor si no la tiene.
create or replace function public.asegurar_persona_pastor(p_user_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_pastor(p_user_id) or exists (select 1 from public.people where profile_id = p_user_id) then
    return;
  end if;
  insert into public.people (full_name, email, profile_id)
  select coalesce(nullif(trim(p.full_name), ''), u.email, 'Pastor'), u.email, p.id
    from public.profiles p left join auth.users u on u.id = p.id
   where p.id = p_user_id
  on conflict (profile_id) do nothing;
end;
$$;

create or replace function public.pastor_persona_trigger()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'profiles' then
    perform public.asegurar_persona_pastor(new.id);
  else
    perform public.asegurar_persona_pastor(new.user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_pastor_persona on public.profiles;
create trigger profiles_pastor_persona after insert or update of role on public.profiles
  for each row execute function public.pastor_persona_trigger();

drop trigger if exists user_roles_pastor_persona on public.user_roles;
create trigger user_roles_pastor_persona after insert or update of role on public.user_roles
  for each row execute function public.pastor_persona_trigger();

-- Pastores que ya existen.
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.asegurar_persona_pastor(r.id);
  end loop;
end $$;

-- Candidatos extra de los roles generales: las fichas de los pastores.
-- Solo para quien planea (Planeación, pastor de sede, super admin).
create or replace function public.pastores_asignables()
returns table (id uuid, full_name text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select pe.id, pe.full_name
    from public.people pe
   where public.has_permission('servir.planear')
     and pe.active
     and pe.profile_id is not null
     and public.es_pastor(pe.profile_id)
   order by pe.full_name;
$$;

revoke all on function public.es_pastor(uuid)                from public, anon, authenticated;
revoke all on function public.asegurar_persona_pastor(uuid)  from public, anon, authenticated;
revoke all on function public.pastor_persona_trigger()       from public, anon, authenticated;
revoke all on function public.pastores_asignables()          from public, anon;
revoke all on function public.soy_pastor()                   from public, anon;
grant execute on function public.soy_pastor()           to authenticated;
grant execute on function public.pastores_asignables()  to authenticated;
