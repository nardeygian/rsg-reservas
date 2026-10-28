import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// Cliente del servidor tipado con el esquema de la Etapa 5 (lib/database.types.ts).
// types/supabase.ts todavía no trae las tablas de Servir; la sesión y RLS
// son las mismas.
export async function clienteServir(): Promise<SupabaseClient<Database>> {
  return (await createClient()) as unknown as SupabaseClient<Database>;
}
