import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizarTx, type TxFiscal } from "./fiscal-logic";

// PostgREST corta cada respuesta en ~1000 filas: se pide por páginas.
const PAGINA = 1000;
const MAX_PAGINAS = 200;

/**
 * Lee las donaciones con la sesión de la persona (nunca con service_role).
 * La función de la base verifica el rol y solo devuelve campos fiscales.
 * Devuelve null si la base le niega el acceso.
 */
export async function leerTransaccionesFiscales(): Promise<TxFiscal[] | null> {
  const supabase = await createClient();
  const out: TxFiscal[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    // La función no está en los tipos generados del esquema principal todavía.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .rpc("donaciones_fiscales")
      .order("fecha", { ascending: false })
      .order("id", { ascending: true })
      .range(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (error) {
      if (error.code === "42501") return null;
      throw new Error(`No se pudieron leer las donaciones: ${error.message}`);
    }
    const filas = (data ?? []) as TxFiscal[];
    out.push(...filas.map(normalizarTx));
    if (filas.length < PAGINA) break;
  }
  return out;
}
