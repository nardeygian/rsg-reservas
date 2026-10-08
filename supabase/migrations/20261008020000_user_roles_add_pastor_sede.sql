-- Agregar 'pastor_sede' como rol adicional válido en user_roles

alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('lider_departamento', 'pastor_ministerio', 'pastor_sede', 'lider_discipulado'));
