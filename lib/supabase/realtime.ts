import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Suscribe un canal de Realtime con el token del usuario y devuelve la
// limpieza para el useEffect.
//
// El cliente del navegador lee la sesión de las cookies de forma asíncrona.
// Si el canal se une antes, entra como anon: Realtime revisa los filtros con
// los permisos de anon, los rechaza ("invalid column for filter") y no llega
// ningún evento, aunque el canal diga SUBSCRIBED.
export function suscribirConSesion<C extends SupabaseClient>(
  sb: C,
  armar: (sb: C) => RealtimeChannel,
): () => void {
  let canal: RealtimeChannel | null = null;
  let cancelado = false;
  (async () => {
    const { data } = await sb.auth.getSession();
    if (cancelado) return;
    if (data.session) await sb.realtime.setAuth(data.session.access_token);
    if (cancelado) return;
    canal = armar(sb).subscribe();
  })();
  return () => {
    cancelado = true;
    if (canal) sb.removeChannel(canal);
  };
}
