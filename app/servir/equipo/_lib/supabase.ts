import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Igual que lib/supabase/server.ts, pero tipado con lib/database.types.ts
// (el esquema con las tablas de Servir). Siempre con la sesión del usuario:
// RLS decide qué filas ve o cambia.
export async function clienteServir() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component: la sesión la refresca el middleware.
          }
        },
      },
    },
  );
}

export type ClienteServir = Awaited<ReturnType<typeof clienteServir>>;
