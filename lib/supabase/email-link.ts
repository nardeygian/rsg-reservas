import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Cliente sin estado para enviar enlaces por correo (recuperación de
// contraseña). Usa el flujo implícito a propósito: con PKCE el
// code_verifier queda en una cookie del navegador que pidió el enlace, y
// el enlace falla si se abre en otro navegador (la app de Mail en iOS, la
// PWA instalada, otro dispositivo). Con el flujo implícito el enlace trae
// los tokens en el fragmento y /auth/callback los guarda en cookies.
export function createEmailLinkClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}
