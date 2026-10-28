import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// Igual que en reuniones/_lib/db.ts: el cliente del servidor está tipado con
// types/supabase.ts, que no trae las tablas de Servir. Este lo reusa con los
// tipos de la Fase A (lib/database.types.ts); la sesión y RLS son las mismas.
export type ServirClient = SupabaseClient<Database>;

export async function servirClient(): Promise<ServirClient> {
  return (await createClient()) as unknown as ServirClient;
}

export async function usuarioActual(supabase: ServirClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

// Para mostrar u ocultar botones. La regla real la cumple RLS.
export async function puedeEditarCanciones(supabase: ServirClient): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { p_permission: "canciones.editar" });
  return data === true;
}
