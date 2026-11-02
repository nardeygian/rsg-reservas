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

// Informe de atrasos escrito por Claude para el periodo. Queda guardado en
// delay_reports (RLS: quien puede ver estadísticas) para no pagarlo cada vez.
export async function analizarAtrasosConClaude(desde: string, hasta: string): Promise<Resultado<{ id: string }>> {
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha.test(desde) || !fecha.test(hasta) || desde > hasta) return { ok: false, error: "El periodo no es válido." };
  const { analizarAtrasos, ErrorAnalisis, MODELO_ANALISIS } = await import("@/lib/servir/analisis-atrasos");
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "El análisis con Claude no está configurado (falta la clave de la API)." };

  const db = await createClient();
  const { data: puede } = await db.rpc("puede_ver_estadisticas");
  if (puede !== true) return { ok: false, error: "No tienes permiso para ver estadísticas." };
  const { data: motivos, error } = await db.rpc("motivos_atraso", { p_desde: desde, p_hasta: hasta });
  if (error) return { ok: false, error: "No se pudieron leer los motivos." };
  if (!motivos?.length) return { ok: false, error: "No hay atrasos registrados en este periodo." };

  let r: { texto: string; modelo: string };
  try {
    r = await analizarAtrasos(motivos, { desde, hasta });
  } catch (e) {
    if (e instanceof ErrorAnalisis) return { ok: false, error: e.message };
    console.error("[servir/estadisticas] análisis", e);
    return { ok: false, error: "No se pudo hacer el análisis. Intenta de nuevo." };
  }
  const { data: informe, error: e2 } = await db.from("delay_reports")
    .insert({ desde, hasta, content: r.texto, model: r.modelo ?? MODELO_ANALISIS })
    .select("id").single();
  if (e2 || !informe) return { ok: false, error: "El análisis salió, pero no se pudo guardar." };
  revalidatePath("/servir/estadisticas");
  return { ok: true, data: { id: informe.id } };
}
