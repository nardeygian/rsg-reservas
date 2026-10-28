// Canal de la app nativa (Android e iOS): Firebase Cloud Messaging HTTP v1,
// que en iPhone entrega por APNs. Se activa con el secreto FCM_SERVICE_ACCOUNT
// (el JSON de la cuenta de servicio de Firebase). Sin él, este canal se salta.
//
// Pendiente de probar con la app de Capacitor (frente E1): hoy no hay
// dispositivos android/ios registrados.

import { b64uEncode, type ResultadoEnvio } from "./webpush.ts";

type CuentaServicio = { project_id: string; client_email: string; private_key: string };

const enc = new TextEncoder();
let cache: { token: string; vence: number } | null = null;

export function cuentaFcm(): CuentaServicio | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CuentaServicio;
  } catch {
    console.error("[notificador] FCM_SERVICE_ACCOUNT no es JSON válido");
    return null;
  }
}

async function tokenAcceso(cuenta: CuentaServicio): Promise<string> {
  if (cache && cache.vence > Date.now() + 60_000) return cache.token;

  const pem = cuenta.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);

  const ahora = Math.floor(Date.now() / 1000);
  const header = b64uEncode(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64uEncode(enc.encode(JSON.stringify({
    iss: cuenta.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  })));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`)));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64uEncode(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`FCM: no se pudo obtener token (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: data.access_token, vence: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function enviarFcm(
  cuenta: CuentaServicio,
  token: string,
  m: { id: string; title: string; body: string | null; link: string | null; kind: string },
): Promise<ResultadoEnvio> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await tokenAcceso(cuenta)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title, body: m.body ?? "" },
        data: { id: m.id, link: m.link ?? "/tu/notificaciones", kind: m.kind },
        android: { priority: "high", notification: { tag: m.kind } },
        apns: { payload: { aps: { sound: "default", "thread-id": m.kind } } },
      },
    }),
  });
  if (res.ok) return { ok: true };
  const detalle = (await res.text()).slice(0, 300);
  // UNREGISTERED / 404: el token ya no sirve (desinstaló la app).
  return { ok: false, status: res.status, vencida: res.status === 404 || detalle.includes("UNREGISTERED"), detalle };
}
