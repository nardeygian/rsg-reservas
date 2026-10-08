-- Renombrar 'mentor' → 'lider_discipulado' en user_roles
-- Primero migrar datos existentes, luego actualizar el constraint.

update public.user_roles set role = 'lider_discipulado' where role = 'mentor';

alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('lider_departamento', 'pastor_ministerio', 'lider_discipulado'));
