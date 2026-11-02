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
export async function permisos(supabase: ServirClient) {
  const tiene = async (p: string) => {
    const { data } = await supabase.rpc("has_permission", { p_permission: p });
    return data === true;
  };
  const [planear, plantillas, verReuniones, verTodo, importar] = await Promise.all([
    tiene("servir.planear"),
    tiene("servir.plantillas"),
    tiene("servir.ver_reuniones"),
    tiene("servir.ver_todo"),
    tiene("servir.importar"),
  ]);
  return { planear, plantillas, verTodas: verReuniones || verTodo, importar: importar && planear };
}
