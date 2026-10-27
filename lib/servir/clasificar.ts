// Clasifica una reunión (nombre + sección de Asana) en un tipo de reunión.
// Lo usan la migración de servicio_data y la sincronización con Asana, así
// que es puro: sin base de datos ni dependencias de Next.
//
// Reglas (meeting_types.asana_rules): un tipo aplica si alguna palabra clave
// aparece en el nombre y, si tiene secciones, la sección contiene alguna. Un
// tipo sin palabras clave aplica solo por sección (respaldo). Gana el primero
// en orden de `sort`. Se compara sin tildes ni mayúsculas, como svNorm.

import { svNorm, svTipo } from "../../app/servicio/_lib/sv-logic.ts";

export type ReglasAsana = { keywords?: string[]; sections?: string[] };

export type TipoParaClasificar = {
  id: string;
  name: string;
  sort: number;
  kind: "ministerio" | "servolucion" | "evento";
  asana_rules: ReglasAsana | null;
};

export function clasificarReunion<T extends TipoParaClasificar>(
  r: { nombre: string; seccion?: string | null },
  tipos: T[],
): T | null {
  const nombre = svNorm(r.nombre);
  const seccion = svNorm(r.seccion ?? "");
  const ordenados = [...tipos].sort((a, b) => a.sort - b.sort);
  for (const t of ordenados) {
    const kw = (t.asana_rules?.keywords ?? []).map(svNorm);
    const sec = (t.asana_rules?.sections ?? []).map(svNorm);
    if (kw.length === 0 && sec.length === 0) continue;
    if (kw.length > 0 && !kw.some((k) => nombre.includes(k))) continue;
    if (sec.length > 0 && !sec.some((s) => seccion.includes(s))) continue;
    return t;
  }
  return null;
}

// meetings.kind: la Servolución sale de svTipo (regla de conteo que no cambia);
// entre ministerio y evento decide el tipo encontrado.
export function kindDeReunion(
  r: { nombre: string; seccion?: string | null },
  tipo: TipoParaClasificar | null,
): "ministerio" | "servolucion" | "evento" {
  if (svTipo({ nombre: r.nombre, seccion: r.seccion ?? "" }) === "serv") return "servolucion";
  return tipo?.kind === "evento" ? "evento" : "ministerio";
}
