// Edge Function `notificador`: el único despachador de notificaciones.
//
// 1. notificador_procesar(): recordatorios vencidos y envíos programados
//    pasan a `notifications` (bandeja).
// 2. notificador_por_enviar(): toma las notificaciones sin push y las manda
//    a cada dispositivo de la persona según su plataforma (web → VAPID,
//    android/ios → FCM). Las suscripciones vencidas se borran.
//
// La llama la base en cuanto se crea un aviso o un envío (trigger con
// pg_net, 20261030100000), pg_cron cada minuto como respaldo y el portal
// justo después de un envío inmediato. Se protege con el encabezado
// x-notificador-secret, no con JWT (config.toml: verify_jwt = false).
//
// Secretos (supabase secrets set / supabase/functions/.env en local):
//   NOTIFICADOR_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
//   FCM_SERVICE_ACCOUNT (opcional, para la app nativa).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.
//
// Correo de respaldo: pendiente (sección 6 del plan). Iría aquí, para las
// notificaciones cuyo usuario no tiene ningún dispositivo.

import { createClient } from "npm:@supabase/supabase-js@2.108.0";
import { enviarWebPush, type ResultadoEnvio, type Vapid } from "./webpush.ts";
import { cuentaFcm, enviarFcm } from "./fcm.ts";

type Pendiente = { id: string; user_id: string; kind: string; title: string; body: string | null; link: string | null };
type Dispositivo = {
  id: string; user_id: string; platform: "web" | "android" | "ios";
  endpoint: string | null; p256dh: string | null; auth: string | null; token: string | null;
};

const LOTE = 200;
const MAX_LOTES = 5;

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("NOTIFICADOR_SECRET");
  if (!secreto || !iguales(req.headers.get("x-notificador-secret") ?? "", secreto)) {
    return json({ error: "No autorizado" }, 401);
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: procesado, error: errProcesar } = await sb.rpc("notificador_procesar");
  if (errProcesar) {
    console.error("[notificador] procesar:", errProcesar.message);
    return json({ error: errProcesar.message }, 500);
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapid: Vapid | null = vapidPublic && vapidPrivate
    ? { publicKey: vapidPublic, privateKey: vapidPrivate, subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@resurgencia.com" }
    : null;
  const fcm = cuentaFcm();

  const push = { notificaciones: 0, enviados: 0, fallidos: 0, sin_dispositivo: 0, vencidas: 0 };

  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const { data: pendientes, error } = await sb.rpc("notificador_por_enviar", { p_limit: LOTE });
    if (error) {
      console.error("[notificador] por_enviar:", error.message);
      break;
    }
    const lista = (pendientes ?? []) as Pendiente[];
    if (lista.length === 0) break;
    push.notificaciones += lista.length;

    const usuarios = [...new Set(lista.map((n) => n.user_id))];
    const { data: dispositivos } = await sb
      .from("push_subscriptions")
      .select("id, user_id, platform, endpoint, p256dh, auth, token")
      .in("user_id", usuarios);
    const porUsuario = new Map<string, Dispositivo[]>();
    for (const d of (dispositivos ?? []) as Dispositivo[]) {
      porUsuario.set(d.user_id, [...(porUsuario.get(d.user_id) ?? []), d]);
    }

    const vencidas = new Set<string>();
    const vistos = new Set<string>();
    await Promise.all(lista.map(async (n) => {
      const suyos = porUsuario.get(n.user_id) ?? [];
      if (suyos.length === 0) { push.sin_dispositivo++; return; }

      await Promise.all(suyos.map(async (d) => {
        let r: ResultadoEnvio | null = null;
        try {
          if (d.platform === "web" && vapid && d.endpoint && d.p256dh && d.auth) {
            r = await enviarWebPush(
              { endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth },
              { id: n.id, title: n.title, body: n.body, link: n.link, tag: n.kind },
              vapid,
            );
          } else if (d.platform !== "web" && fcm && d.token) {
            r = await enviarFcm(fcm, d.token, n);
          }
        } catch (e) {
          r = { ok: false, status: 0, vencida: false, detalle: String(e) };
        }
        if (!r) return; // canal sin configurar
        if (r.ok) { push.enviados++; vistos.add(d.id); return; }
        push.fallidos++;
        if (r.vencida) vencidas.add(d.id);
        else console.error(`[notificador] push ${d.platform} ${r.status}: ${r.detalle}`);
      }));
    }));

    if (vencidas.size) {
      push.vencidas += vencidas.size;
      await sb.from("push_subscriptions").delete().in("id", [...vencidas]);
    }
    if (vistos.size) {
      await sb.from("push_subscriptions").update({ last_seen_at: new Date().toISOString() }).in("id", [...vistos]);
    }
    if (lista.length < LOTE) break;
  }

  return json({ procesado, push, canales: { web: !!vapid, fcm: !!fcm } });
});
