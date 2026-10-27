import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Donacion } from "./types";
import type { SvMiembro } from "@/app/servicio/_lib/types";
import { svNorm } from "@/app/servicio/_lib/sv-logic";
import { normalizarDonacion } from "./don-logic";

// Lecturas con service_role, sin chequeo de permisos: quien las llame decide
// qué parte de los datos puede ver el usuario (ver donacionesParaLider).

// eslint-disable-next-line
export const donTable = (svc: ReturnType<typeof createServiceClient>) => (svc as any).from("donaciones_data");

export async function donReadData(): Promise<Donacion[]> {
  const service = createServiceClient();
  const { data } = await donTable(service).select("donaciones").eq("id", "main").maybeSingle();
  // Repara tildes/ñ dañadas al leer, sin reescribir los datos guardados.
  return ((data?.donaciones as Donacion[] | null) ?? []).map(normalizarDonacion);
}

/**
 * Lo único que un líder de discipulado puede ver: las donaciones de los
 * miembros de su grupo (por `di` o por nombre, igual que DiscipulosShell),
 * sin email, documento, referencia ni clave de donante.
 */
export function donacionesParaLider(donaciones: Donacion[], miembros: SvMiembro[]): Donacion[] {
  const memberIds = new Set(miembros.map((m) => m.id));
  const nameToId = new Map(miembros.map((m) => [svNorm(m.nombre), m.id]));
  return donaciones
    .filter((d) => {
      const diId = d.di ?? nameToId.get(svNorm(d.n)) ?? null;
      return diId !== null && memberIds.has(diId);
    })
    .map(({ id, f, m, n, t, o, met, di, gid }) => ({ id, f, m, n, t, o, met, di, gid, k: "" }));
}

// ── Escritura concurrente segura ────────────────────────────────────────────
// Todas las donaciones viven en una sola fila JSON. Para que dos escrituras
// simultáneas (webhook de Wompi, importación, vincular…) no se pisen, cada
// escritura solo se aplica si `updated_at` sigue igual al que se leyó; si otra
// escritura llegó primero, se vuelve a leer y se reintenta.
const MAX_INTENTOS = 6;

/** Siguiente updated_at, siempre distinto del anterior. */
export function nextUpdatedAt(prev: string | null): string {
  const now = Date.now();
  const prevMs = prev ? Date.parse(prev) : 0;
  return new Date(Math.max(now, prevMs + 1)).toISOString();
}

/**
 * Aplica `fn` a la lista actual y guarda el resultado sin perder escrituras
 * concurrentes. `fn` devuelve `donaciones: null` cuando no hay nada que guardar.
 */
export async function donMutate<T>(
  fn: (actuales: Donacion[]) => { donaciones: Donacion[] | null; result: T },
): Promise<T> {
  const service = createServiceClient();
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const { data: row, error: readErr } = await donTable(service)
      .select("donaciones, updated_at").eq("id", "main").maybeSingle();
    if (readErr) throw new Error(`No se pudieron leer las donaciones: ${readErr.message}`);

    if (!row) {
      await donTable(service).upsert({ id: "main", donaciones: [] }, { onConflict: "id", ignoreDuplicates: true });
      continue;
    }

    const { donaciones, result } = fn((row.donaciones as Donacion[] | null) ?? []);
    if (donaciones === null) return result;

    const { data: escritas, error } = await donTable(service)
      .update({ donaciones, updated_at: nextUpdatedAt(row.updated_at) })
      .eq("id", "main")
      .eq("updated_at", row.updated_at)
      .select("id");
    if (error) throw new Error(`No se pudieron guardar las donaciones: ${error.message}`);
    if ((escritas ?? []).length > 0) return result;
  }
  throw new Error("Otra escritura de donaciones está en curso; intenta de nuevo.");
}
