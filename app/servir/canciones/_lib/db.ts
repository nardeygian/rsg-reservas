import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// El cliente del servidor, con la sesión del usuario: RLS decide.
export type ServirClient = SupabaseClient<Database>;

export async function servirClient(): Promise<ServirClient> {
  return createClient();
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
