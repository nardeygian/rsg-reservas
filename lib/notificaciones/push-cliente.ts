// Suscripción web push en el navegador (solo Client Components).

export type EstadoPush =
  | "no_soportado"     // navegador sin Push API
  | "instalar_ios"     // iPhone: solo con la app web en la pantalla de inicio (iOS 16.4+)
  | "sin_configurar"   // falta NEXT_PUBLIC_VAPID_PUBLIC_KEY
  | "bloqueado"        // la persona negó el permiso
  | "inactivo"
  | "activo";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function esIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function instalada(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function llave(b64u: string): Uint8Array<ArrayBuffer> {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function nombreDispositivo(): string {
  const ua = navigator.userAgent;
  const so = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Navegador";
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return nav ? `${nav} en ${so}` : so;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return esIos() && !instalada() ? "instalar_ios" : "no_soportado";
  }
  if (!VAPID) return "sin_configurar";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "activo" : "inactivo";
}

export type DatosSuscripcion = { endpoint: string; p256dh: string; auth: string };

function datos(sub: PushSubscription): DatosSuscripcion {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" };
}

// Pide permiso (debe llamarse desde un toque) y crea la suscripción.
export async function suscribir(): Promise<DatosSuscripcion | null> {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return null;
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llave(VAPID) }));
  return datos(sub);
}

// La suscripción vigente, si existe (para volver a registrarla si cambió).
export async function suscripcionActual(): Promise<DatosSuscripcion | null> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? datos(sub) : null;
}

export async function desuscribir(): Promise<string | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
