import { createClient } from "@/lib/supabase/server";

// El cliente del servidor, siempre con la sesión del usuario: RLS decide
// qué filas ve o cambia.
export async function clienteServir() {
  return createClient();
}

export type ClienteServir = Awaited<ReturnType<typeof clienteServir>>;
