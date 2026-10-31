"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/servir/contratos";
import { createClient } from "@/lib/supabase/server";

// Planeación ajusta los umbrales del semáforo. RLS de servir_ajustes solo
// deja actualizar a quien tiene servir.planear global.
export async function guardarAjustes(input: {
  sobrecargado_desde: number; alejandose_hasta: number; inactivo_semanas: number; ventana_dias: number;
}): Promise<Resultado> {
  const n = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!n(input.sobrecargado_desde, 1, 30) || !n(input.alejandose_hasta, 0, 29) || !n(input.inactivo_semanas, 1, 52) || !n(input.ventana_dias, 7, 120)) {
    return { ok: false, error: "Revisa los números." };
  }
  if (input.alejandose_hasta >= input.sobrecargado_desde) {
    return { ok: false, error: "“Alejándose” debe ser menor que “sobrecargado”." };
  }
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  const { data, error } = await db.from("servir_ajustes")
    .update({ ...input, updated_by: claims?.claims.sub ?? null })
    .eq("id", true).select("id");
  if (error) {
    console.error("[servir/estadisticas] ajustes", error.message);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
  if (!data?.length) return { ok: false, error: "No tienes permiso para cambiar los umbrales." };
  revalidatePath("/servir/estadisticas");
  return { ok: true, data: undefined };
}
