import { cache } from "react";
import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";

// ── Nav capabilities ─────────────────────────────────────────────────────────

export type ServicioAccess  = "none" | "read" | "edit";
export type DonacionesAccess = "none" | "full" | "filtered";

export type NavCaps = {
  inicio:          boolean;
  calendario:      boolean;
  reservas:        boolean;
  servir:          boolean;
  servicio:        ServicioAccess;
  donaciones:      DonacionesAccess;
  discipulos:      boolean;
  admin:           boolean;
  disciGrupoId:    string | null; // grupo_id del líder de discipulado
  ministerioNombre: string | null; // nombre del ministerio del pastor (para filtrar servicio)
};

type ExtraRow = { role: string; ministries?: { name: string } | null };

export function computeNavCaps(
  role: string,
  extraRows: ExtraRow[],
  disciGrupoId: string | null = null,
  ministerioNombre: string | null = null,
): NavCaps {
  const extra = extraRows.map(r => r.role);
  const all   = [role, ...extra];
  const has   = (...r: string[]) => r.some(x => all.includes(x));

  const isSuper  = role === "super_admin";
  const isPSede  = has("pastor_sede");
  const isPMin   = has("pastor_ministerio");
  const isLD     = has("lider_discipulado");
  const isLDept  = has("lider_departamento");
  const isPlan   = role === "planeacion" ||
    extraRows.some(r => r.role === "lider_departamento" &&
      (r.ministries as { name: string } | null)?.name === "Planeación");
  const isStudio = role === "studio_admin";
  // Rol básico de quien entra con Google o Apple sin invitación: sirve,
  // pero no reserva espacios (la base tampoco lo deja).
  const isServidor = role === "servidor" && extra.length === 0;

  return {
    inicio:          true,
    calendario:      !isStudio,
    reservas:        !isPlan && !isServidor,
    servir:          !isStudio,
    servicio:        (isSuper || isPSede || isPlan) ? "edit"
                   : (isLD    || isLDept || isPMin) ? "read"
                   : "none",
    donaciones:      (isSuper || isPSede) ? "full"
                   : isLD                 ? "filtered"
                   : "none",
    discipulos:      isSuper || isPSede || isLD,
    admin:           isSuper,
    disciGrupoId,
    ministerioNombre,
  };
}

export const getUserCaps = cache(async (): Promise<NavCaps | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const userId = data.claims.sub;
  if (!userId) return null;

  const [profileRes, extraRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("user_roles").select("role, ministries(name)").eq("user_id", userId),
  ]);

  const role      = profileRes.data?.role ?? "leader";
  const extraRows = (extraRes.data ?? []) as ExtraRow[];
  const hasLD     = extraRows.some(r => r.role === "lider_discipulado");
  const hasPMin   = role === "pastor_ministerio" || extraRows.some(r => r.role === "pastor_ministerio");

  // grupo_id for lider_discipulado lives in servicio_data
  let disciGrupoId: string | null = null;
  if (hasLD) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svTable = (supabase as any).from("servicio_data");
    const { data: svRow } = await svTable.select("data").eq("id", "main").maybeSingle();
    const grupos = (svRow?.data?.grupos ?? {}) as Record<string, { lider_user_ids?: string[]; lider_user_id?: string }>;
    for (const [gid, g] of Object.entries(grupos)) {
      const ids = g.lider_user_ids ?? (g.lider_user_id ? [g.lider_user_id] : []);
      if (ids.includes(userId)) { disciGrupoId = gid; break; }
    }
  }

  // ministry name for pastor_ministerio (from extra role)
  const ministerioNombre = hasPMin
    ? (extraRows.find(r => r.role === "pastor_ministerio")?.ministries as { name: string } | null)?.name ?? null
    : null;

  return computeNavCaps(role, extraRows, disciGrupoId, ministerioNombre);
});

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
