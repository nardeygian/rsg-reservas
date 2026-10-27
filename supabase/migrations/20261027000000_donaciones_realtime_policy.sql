-- RSG Reservas — Realtime de donaciones para administración
-- donaciones_data tenía RLS sin políticas, así que Realtime (que respeta RLS)
-- no le entregaba ningún evento al navegador y DonacionesRealtime nunca se
-- disparaba. Solo super_admin y pastor_sede, que ya ven todo el módulo,
-- pueden leer la fila; para el resto sigue cerrada.
-- Migración aditiva: no cambia datos ni la forma de la tabla.

grant select on public.donaciones_data to authenticated;

create policy "leer donaciones admin" on public.donaciones_data
  for select
  to authenticated
  using ((select current_role_is(array['super_admin', 'pastor_sede'])));
