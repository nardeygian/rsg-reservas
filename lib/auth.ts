import { cache } from "react";
import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionProfile = {
  userId: string;
  email: string | null;
  profile: Profile | null;
};

// Carga la sesión + perfil del usuario actual con un solo "fetch lógico"
// por request (gracias a React cache). Usa getClaims() en lugar de
// getUser() para evitar un roundtrip a la Auth API de Supabase: el JWT
// se verifica localmente con JWKS.
export const getSessionProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;

    const userId = data.claims.sub;
    if (!userId) return null;
    const email =
      typeof data.claims.email === "string" ? data.claims.email : null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    return { userId, email, profile: profile ?? null };
  }
);
