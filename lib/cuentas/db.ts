import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// El cliente del servidor está tipado con types/supabase.ts, que no trae
// las tablas de Servir ni las de Cuentas. Estos lo reusan con los tipos de
// lib/database.types.ts; la sesión y RLS son las mismas.
export type CuentasClient = SupabaseClient<Database>;

export async function cuentasClient(): Promise<CuentasClient> {
  return (await createClient()) as unknown as CuentasClient;
}

// service_role: solo para "Eliminar mi cuenta" (marcado así en el contrato).
export function cuentasServiceClient(): CuentasClient {
  return createServiceClient() as unknown as CuentasClient;
}

// Origen de esta petición (para las URL de retorno de OAuth y de los
// enlaces). Supabase solo acepta las que están en su lista de URL
// permitidas, así que un Host falso no lleva a ningún lado.
export async function origenSitio(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.SITE_URL ?? "https://rsg-reservas.vercel.app";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

// Solo rutas internas: "//evil.com" o "/\evil.com" saldrían del sitio.
export function rutaSegura(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}

export const RUTA_INVITACION = "/auth/invitacion/";

export function enlaceInvitacion(origen: string, token: string): string {
  return `${origen}${RUTA_INVITACION}${encodeURIComponent(token)}`;
}
