// Lógica compartida (cliente y servidor) del reporte de Revisoría fiscal.
// Trabaja solo con los campos que devuelve public.donaciones_fiscales():
// nada de discipulado.

import type { Donacion } from "@/app/donaciones/_lib/types";
import { clusterDonantes, metodo, repararTexto } from "@/app/donaciones/_lib/don-logic";

/** Una fila de public.donaciones_fiscales(). */
export type TxFiscal = {
  id: string;
  fecha: string;          // ISO UTC
  monto: number;          // COP
  donante: string;
  donante_clave: string | null;
  documento: string | null;
  email: string | null;
  concepto: string | null;
  origen: string | null;
  metodo_pago: string | null;
  referencia: string | null;
};

export type FiltrosFiscales = {
  desde?: string;     // YYYY-MM-DD (hora Bogotá, incluido)
  hasta?: string;     // YYYY-MM-DD (hora Bogotá, incluido)
  metodo?: string;    // valor crudo de metodo_pago
  concepto?: string;
  origen?: string;
  q?: string;         // texto: donante, documento, email o referencia
};

export const SIN_DATO = "Sin dato";

/** Repara tildes dañadas en los textos visibles. */
export function normalizarTx(t: TxFiscal): TxFiscal {
  return {
    ...t,
    monto: Number(t.monto) || 0,
    donante: repararTexto(t.donante ?? ""),
    concepto: t.concepto ? repararTexto(t.concepto) : null,
    origen: t.origen ? repararTexto(t.origen) : null,
  };
}

export const etiquetaMetodo = (m: string | null) => (m ? metodo(m) : SIN_DATO);

// ── Fechas en Bogotá (UTC-5 fijo) ──────────────────────────────────────────

const OFF_MS = 5 * 3600e3;
const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha y hora locales de Bogotá de un ISO UTC. */
export function partesBogota(iso: string) {
  const d = new Date(Date.parse(iso) - OFF_MS);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(),
  };
}
export function diaBogota(iso: string): string {
  const p = partesBogota(iso);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}
export function horaBogota(iso: string): string {
  const p = partesBogota(iso);
  return `${pad(p.h)}:${pad(p.mi)}`;
}
export function hoyBogotaYMD(): string {
  return diaBogota(new Date().toISOString());
}

const esYMD = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Lee los filtros de una URL (?desde=…&hasta=…), descartando lo inválido. */
export function filtrosDesdeParams(p: URLSearchParams | Record<string, string | undefined>): FiltrosFiscales {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) ?? undefined : p[k]) || undefined;
  const f: FiltrosFiscales = {};
  const desde = get("desde"), hasta = get("hasta");
  if (esYMD(desde)) f.desde = desde;
  if (esYMD(hasta)) f.hasta = hasta;
  for (const k of ["metodo", "concepto", "origen", "q"] as const) {
    const v = get(k)?.slice(0, 120);
    if (v) f[k] = v;
  }
  return f;
}

export function filtrosAParams(f: FiltrosFiscales): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function aplicarFiltros(lista: TxFiscal[], f: FiltrosFiscales): TxFiscal[] {
  const q = f.q ? norm(f.q.trim()) : "";
  return lista.filter((t) => {
    const dia = diaBogota(t.fecha);
    if (f.desde && dia < f.desde) return false;
    if (f.hasta && dia > f.hasta) return false;
    if (f.metodo && (t.metodo_pago ?? SIN_DATO) !== f.metodo) return false;
    if (f.concepto && (t.concepto ?? SIN_DATO) !== f.concepto) return false;
    if (f.origen && (t.origen ?? SIN_DATO) !== f.origen) return false;
    if (q) {
      const texto = norm([t.donante, t.documento, t.email, t.referencia, t.id].filter(Boolean).join(" "));
      if (!texto.includes(q)) return false;
    }
    return true;
  });
}

/** Orden cronológico (más antigua primero), como lo pide el export. */
export const porFechaAsc = (a: TxFiscal, b: TxFiscal) => a.fecha.localeCompare(b.fecha);

// ── Agrupaciones ────────────────────────────────────────────────────────────

export type Desglose = { clave: string; etiqueta: string; total: number; n: number };

export function desglosar(lista: TxFiscal[], campo: "metodo_pago" | "concepto" | "origen"): Desglose[] {
  const map = new Map<string, Desglose>();
  for (const t of lista) {
    const clave = t[campo] ?? SIN_DATO;
    const etiqueta = campo === "metodo_pago" ? etiquetaMetodo(t[campo]) : clave;
    const d = map.get(clave) ?? { clave, etiqueta, total: 0, n: 0 };
    d.total += t.monto;
    d.n++;
    map.set(clave, d);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export type Donante = {
  clave: string;
  nombre: string;
  documentos: string[];
  emails: string[];
  total: number;
  n: number;
  primera: string;
  ultima: string;
  transacciones: TxFiscal[];
};

/**
 * Agrupa por persona con la misma regla que el módulo de Donaciones
 * (cédula, email, clave del donante y, si no hay, el nombre).
 */
export function agruparPorDonante(lista: TxFiscal[]): Donante[] {
  const porId = new Map(lista.map((t) => [t.id, t]));
  const comoDon: Donacion[] = lista.map((t) => ({
    id: t.id, f: t.fecha, m: t.monto, n: t.donante, k: t.donante_clave ?? "",
    t: t.concepto ?? "", o: t.origen ?? "", met: t.metodo_pago ?? "",
    ...(t.email ? { e: t.email } : {}),
    ...(t.documento ? { doc: t.documento } : {}),
  }));
  return clusterDonantes(comoDon).map((c, i) => {
    const txs = c.list.map((d) => porId.get(d.id)!).filter(Boolean).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const documentos = [...new Set(txs.map((t) => t.documento).filter((x): x is string => !!x))];
    const emails = [...new Set(txs.map((t) => t.email?.toLowerCase()).filter((x): x is string => !!x))];
    return {
      clave: (documentos[0] ?? emails[0] ?? c.nombre) + "#" + i,
      nombre: c.nombre || "Sin nombre",
      documentos,
      emails,
      total: c.total,
      n: c.count,
      primera: txs[txs.length - 1]?.fecha ?? "",
      ultima: txs[0]?.fecha ?? "",
      transacciones: txs,
    };
  });
}

export type Serie = { clave: string; etiqueta: string; total: number; n: number };

const MES3 = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

/** Totales por día (rangos de hasta 62 días) o por mes. */
export function serieTemporal(lista: TxFiscal[], desde: string, hasta: string): { serie: Serie[]; unidad: "día" | "mes" } {
  const d0 = new Date(desde + "T00:00:00Z"), d1 = new Date(hasta + "T00:00:00Z");
  const dias = Math.round((d1.getTime() - d0.getTime()) / 864e5) + 1;
  const porDia = dias <= 62;
  const serie: Serie[] = [];
  const idx = new Map<string, number>();
  if (porDia) {
    for (let i = 0; i < dias; i++) {
      const d = new Date(d0.getTime() + i * 864e5);
      const k = d.toISOString().slice(0, 10);
      idx.set(k, serie.length);
      serie.push({ clave: k, etiqueta: `${d.getUTCDate()} ${MES3[d.getUTCMonth()]}`, total: 0, n: 0 });
    }
  } else {
    let y = d0.getUTCFullYear(), m = d0.getUTCMonth();
    const yEnd = d1.getUTCFullYear(), mEnd = d1.getUTCMonth();
    while (y < yEnd || (y === yEnd && m <= mEnd)) {
      const k = `${y}-${pad(m + 1)}`;
      idx.set(k, serie.length);
      serie.push({ clave: k, etiqueta: `${MES3[m]} ${String(y).slice(2)}`, total: 0, n: 0 });
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  for (const t of lista) {
    const dia = diaBogota(t.fecha);
    const i = idx.get(porDia ? dia : dia.slice(0, 7));
    if (i !== undefined) { serie[i].total += t.monto; serie[i].n++; }
  }
  return { serie, unidad: porDia ? "día" : "mes" };
}

// ── Exportación (una fila por transacción) ──────────────────────────────────

export const COLUMNAS_EXPORT = [
  "Fecha", "Hora", "Monto (COP)", "Medio de pago", "Concepto", "Origen",
  "Referencia de pago", "ID de transacción", "Donante", "Documento", "Email",
] as const;

export function filaExport(t: TxFiscal): (string | number)[] {
  return [
    diaBogota(t.fecha), horaBogota(t.fecha), t.monto, etiquetaMetodo(t.metodo_pago),
    t.concepto ?? "", t.origen ?? "", t.referencia ?? "", t.id,
    t.donante, t.documento ?? "", t.email ?? "",
  ];
}

export function nombreArchivo(f: FiltrosFiscales, ext: string): string {
  const rango = f.desde || f.hasta ? `${f.desde ?? "inicio"}_a_${f.hasta ?? hoyBogotaYMD()}` : "todo";
  return `donaciones_${rango}.${ext}`;
}
