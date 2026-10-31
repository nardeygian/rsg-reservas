import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// Cliente del servidor con la sesión del usuario: RLS decide.
export async function clienteServir(): Promise<SupabaseClient<Database>> {
  return createClient();
}
