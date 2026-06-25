import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Cliente con service_role: bypassa RLS y todos los grants. Solo se usa
// en server code donde la autenticación viene de otro lado (por ejemplo
// el token del feed de suscripción). Nunca exponer al cliente.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
