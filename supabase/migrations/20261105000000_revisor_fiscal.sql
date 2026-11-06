-- =====================================================================
-- RSG — Rol "revisor_fiscal" (Revisora fiscal) y lectura fiscal de donaciones
-- =====================================================================
-- La revisora fiscal solo ve donaciones como transacciones: fecha, monto,
-- donante, documento, email, concepto, origen, medio de pago y referencia.
-- Nunca ve datos de discipulado (di, gid, sg, mv, ext) ni otros módulos.
--
-- Las donaciones viven en una sola fila JSONB (donaciones_data), así que RLS
-- no puede filtrar campos. En lugar de abrir esa tabla, se expone una función
-- security definer que:
--   1. verifica el rol en la base (revisor_fiscal, super_admin, pastor_sede),
--   2. desanida el JSONB y devuelve SOLO las columnas fiscales.
-- donaciones_data sigue cerrada para la revisora (su política no la incluye).
--
-- No existe un dato de "cuenta de destino" en las transacciones; cuando exista
-- se agrega como columna nueva aquí.
--
-- Migración aditiva: no cambia datos.

-- ── 1. Rol válido en profiles ─────────────────────────────────────────────
-- Se agrega al CHECK que ya exista (sus valores varían entre entornos), sin
-- reescribir la lista a mano.
do $$
declare
  vals text[];
begin
  select array_agg(m[1])
    into vals
    from pg_constraint c,
         regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') as m
   where c.conname = 'profiles_role_check'
     and c.conrelid = 'public.profiles'::regclass;

  if vals is null then
    raise exception 'No se encontró profiles_role_check';
  end if;

  if not ('revisor_fiscal' = any (vals)) then
    alter table public.profiles drop constraint profiles_role_check;
    execute format(
      'alter table public.profiles add constraint profiles_role_check check (role = any (%L::text[]))',
      vals || array['revisor_fiscal']
    );
  end if;
end $$;

-- ── 2. Lectura fiscal de donaciones ───────────────────────────────────────
create or replace function public.donaciones_fiscales()
returns table (
  id            text,
  fecha         timestamptz,
  monto         numeric,
  donante       text,
  donante_clave text,
  documento     text,
  email         text,
  concepto      text,
  origen        text,
  metodo_pago   text,
  referencia    text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (select current_role_is(array['revisor_fiscal', 'super_admin', 'pastor_sede'])) then
    raise exception 'Sin acceso a la revisoría de donaciones' using errcode = '42501';
  end if;

  return query
    select
      x->>'id',
      (x->>'f')::timestamptz,
      coalesce((x->>'m')::numeric, 0),
      coalesce(x->>'n', ''),
      nullif(x->>'k', ''),
      nullif(x->>'doc', ''),
      nullif(x->>'e', ''),
      nullif(x->>'t', ''),
      nullif(x->>'o', ''),
      nullif(x->>'met', ''),
      nullif(x->>'ref', '')
    from public.donaciones_data d
    cross join lateral jsonb_array_elements(d.donaciones) as x
    where d.id = 'main'
    order by (x->>'f')::timestamptz desc;
end;
$$;

revoke all on function public.donaciones_fiscales() from public, anon;
grant execute on function public.donaciones_fiscales() to authenticated;

comment on function public.donaciones_fiscales() is
  'Donaciones como transacciones fiscales, sin datos de discipulado. Solo revisor_fiscal, super_admin y pastor_sede.';
