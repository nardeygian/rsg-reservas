import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// El cliente del servidor está tipado con types/supabase.ts, que todavía no
// trae las tablas de Servir. Este lo reusa con los tipos de la Fase A
// (lib/database.types.ts); la sesión y RLS son las mismas.
export type ServirClient = SupabaseClient<Database>;

export async function servirClient(): Promise<ServirClient> {
  return (await createClient()) as unknown as ServirClient;
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
  const [planear, plantillas, verReuniones, verTodo] = await Promise.all([
    tiene("servir.planear"),
    tiene("servir.plantillas"),
    tiene("servir.ver_reuniones"),
    tiene("servir.ver_todo"),
  ]);
  return { planear, plantillas, verTodas: verReuniones || verTodo };
}
