-- =====================================================================
-- RSG Reservas — captura de rol solicitado al registro
-- =====================================================================
-- Permite al usuario indicar al registrarse si se ve como líder de
-- departamento, pastor de ministerio o pastor de sede. El rol efectivo
-- (`profiles.role`) sigue siendo 'leader' hasta que un super_admin lo
-- promueva manualmente — esto solo guarda la intención.

alter table profiles
  add column requested_role text
    check (requested_role in ('lider_departamento','pastor_ministerio','pastor_sede'));

-- El trigger lee `requested_role` de raw_user_meta_data cuando el cliente
-- llama supabase.auth.signUp({ options: { data: { requested_role, full_name } } }).
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, role, requested_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'leader',
    nullif(new.raw_user_meta_data->>'requested_role', '')
  );
  return new;
end;
$$;
