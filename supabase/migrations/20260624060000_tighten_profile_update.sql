-- =====================================================================
-- RSG Reservas — limitar columnas que el usuario puede actualizar
-- =====================================================================
-- La policy `editar mi perfil` permite UPDATE sobre cualquier columna
-- de la fila del usuario. Sin restricción, un líder podría hacer
-- `update profiles set role = 'super_admin' where id = auth.uid()` vía
-- la API y auto-promoverse. Cerramos con grants a nivel de columna:
-- `authenticated` solo puede tocar las columnas seguras del perfil.
--
-- Promociones de rol se hacen vía SQL por un super_admin (o un futuro
-- panel admin que use service_role).

revoke update on profiles from authenticated;

grant update (full_name, ministry_id, calendar_feed_token, slack_user_id, requested_role)
  on profiles to authenticated;
