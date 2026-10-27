import type { Donacion } from "./types";

export const CONCEPTOS = ["Diezmo", "Diezmo + Ofrenda", "Ofrenda", "Pro Casa"] as const;
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export const MES3   = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export const METODOS: Record<string, string> = {
  CARD:"Tarjeta", PSE:"PSE", NEQUI:"Nequi", BANCOLOMBIA_TRANSFER:"Bancolombia",
  BANCOLOMBIA_COLLECT:"Corresponsal", DAVIPLATA:"Daviplata", Efectivo:"Efectivo",
};
export const metodo = (m: string) => METODOS[m] || m || "";
export const esDar  = (d: Donacion) => d.o === "Módulo Dar";
export const esEfe  = (d: Donacion) => d.met === "Efectivo";
export const suma   = (list: Donacion[]) => list.reduce((a, d) => a + d.m, 0);
// Una sola definición de "donante" para toda la app: la misma persona cuenta
// una vez aunque sus donaciones vengan con claves `k` distintas (el panel PHP
// y el portal las generan de forma diferente). Ver clusterDonantes.
export const donantes = (list: Donacion[]) => clusterDonantes(list).length;
export const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const money = (n: number) => COP.format(Math.round(n || 0));
export const moneyShort = (n: number) =>
  n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M"
  : n >= 1e3 ? "$" + Math.round(n / 1e3) + " mil"
  : money(n);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const ordenConcepto = (t: string) => {
  const i = CONCEPTOS.indexOf(t as typeof CONCEPTOS[number]);
  return i < 0 ? 99 : i;
};

// Bogotá = UTC-5 fijo (Colombia no cambia horario)
const OFF = 5 * 3600e3;
export function loc(iso: string) {
  const d = new Date(Date.parse(iso) - OFF);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
export function fmtFecha(iso: string) {
  const l = loc(iso);
  return `${String(l.d).padStart(2,"0")} ${MES3[l.m]} ${l.y} · ${String(l.h).padStart(2,"0")}:${String(l.mi).padStart(2,"0")}`;
}

// ── Periodos ────────────────────────────────────────────────────────────────

export type DonPer = "mes" | "trimestre" | "semestre" | "anio";
export const PER_CFG: Record<DonPer, { n: number; span: number; nombre: string }> = {
  mes:       { n: 12, span: 1,  nombre: "mes" },
  trimestre: { n: 4,  span: 3,  nombre: "trimestre" },
  semestre:  { n: 2,  span: 6,  nombre: "semestre" },
  anio:      { n: 1,  span: 12, nombre: "año" },
};

export function rangoMeses(per: DonPer, y: number, i: number): { y: number; m0: number; m1: number } {
  const sp = PER_CFG[per].span;
  return { y, m0: i * sp, m1: i * sp + sp };
}

export function hoyBogota() {
  return loc(new Date().toISOString());
}

export function periodoActualDon(per: DonPer): { y: number; i: number } {
  const h = hoyBogota();
  return { y: h.y, i: Math.floor(h.m / PER_CFG[per].span) };
}

export function shiftDon(per: DonPer, y: number, i: number, dir: number): [number, number] {
  const n = PER_CFG[per].n;
  i += dir;
  if (i < 0) { y--; i = n - 1; }
  if (i >= n) { y++; i = 0; }
  return [y, i];
}

export function etiquetaDon(per: DonPer, y: number, i: number): string {
  const r = rangoMeses(per, y, i);
  if (per === "mes") return cap(MESES[r.m0]) + " " + y;
  if (per === "anio") return "Año " + y;
  return (per === "trimestre" ? "T" : "S") + (i + 1) + " " + y + " · " + MES3[r.m0] + " a " + MES3[r.m1 - 1];
}

export function esFuturoDon(per: DonPer, y: number, i: number): boolean {
  const h = hoyBogota();
  const r = rangoMeses(per, y, i);
  return y > h.y || (y === h.y && r.m0 > h.m);
}

export function donDe(list: Donacion[], per: DonPer, y: number, i: number): Donacion[] {
  const r = rangoMeses(per, y, i);
  return list.filter((d) => {
    const l = loc(d.f);
    return l.y === r.y && l.m >= r.m0 && l.m < r.m1;
  });
}

// ── Chart data ──────────────────────────────────────────────────────────────

export type ChartBar = { t: string; v: number; n: number };

export function chartData(list: Donacion[], per: DonPer, y: number, i: number): { bars: ChartBar[]; labels: string[]; title: string } {
  const r = rangoMeses(per, y, i);
  let bars: ChartBar[] = [];
  let labels: string[] = [];
  let title = "";

  if (per === "mes") {
    const dias = new Date(Date.UTC(y, r.m0 + 1, 0)).getUTCDate();
    bars = Array.from({ length: dias }, (_, k) => ({ t: (k + 1) + " " + MES3[r.m0], v: 0, n: 0 }));
    list.forEach((d) => { const l = loc(d.f); if (l.d - 1 < bars.length) { bars[l.d - 1].v += d.m; bars[l.d - 1].n++; } });
    labels = bars.map((_, k) => (k === 0 || (k + 1) % 5 === 0) ? String(k + 1) : "");
    title = "Por día";
  } else {
    for (let m = r.m0; m < r.m1; m++) bars.push({ t: cap(MESES[m]) + " " + y, v: 0, n: 0 });
    list.forEach((d) => { const l = loc(d.f); const idx = l.m - r.m0; if (idx >= 0 && idx < bars.length) { bars[idx].v += d.m; bars[idx].n++; } });
    labels = bars.map((_, k) => MES3[r.m0 + k]);
    title = "Por mes";
  }
  return { bars, labels, title };
}

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

// ── Texto con tildes y ñ ────────────────────────────────────────────────────

/**
 * Repara texto UTF-8 que se leyó como Latin-1 ("DÃ­az" → "Díaz", "PeÃ±a" →
 * "Peña"). Solo toca cadenas que tienen la marca típica del error y que se
 * pueden decodificar sin pérdida; cualquier otro texto se devuelve igual.
 */
export function repararTexto(s: string): string {
  if (!s || !/[ÃÂ]/.test(s)) return s;
  const bytes = Array.from(s, (c) => c.charCodeAt(0));
  if (bytes.some((b) => b > 255)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return s;
  }
}

/** Copia de la donación con los textos visibles reparados. */
export function normalizarDonacion(d: Donacion): Donacion {
  const n = repararTexto(d.n);
  const t = repararTexto(d.t);
  const o = repararTexto(d.o);
  return n === d.n && t === d.t && o === d.o ? d : { ...d, n, t, o };
}

// ── Identidad del donante ───────────────────────────────────────────────────

/** Nombre sin tildes, mayúsculas ni signos, para comparar. */
export function normDon(s: string) {
  return repararTexto(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/** Primer nombre + primer apellido ("maria alejandra llanos" → "maria llanos"). */
function claveDon(n: string): string | null {
  const p = normDon(n).split(" ").filter(Boolean);
  if (p.length < 2) return null;
  return p[0] + " " + p[Math.min(2, p.length - 1)];
}

/** Claves fuertes de la persona: cédula (solo dígitos) y email. */
function clavesFuertes(d: Donacion): string[] {
  const out: string[] = [];
  const doc = (d.doc ?? "").replace(/\D/g, "");
  if (doc.length >= 5) out.push("c:" + doc);
  const email = (d.e ?? "").trim().toLowerCase();
  if (email) out.push("e:" + email);
  if (d.k) out.push("k:" + d.k);
  return out;
}

export type DonCluster = { nombre: string; total: number; count: number; conceptos: string[]; list: Donacion[] };

/**
 * Agrupa las donaciones por persona. Primero por cédula, email o clave `k`;
 * si no hay coincidencia, por nombre (exacto, prefijo, o primer nombre +
 * primer apellido). Es la base de todos los conteos de donantes.
 */
export function clusterDonantes(lista: Donacion[]): DonCluster[] {
  const clusters: { names: string[]; list: Donacion[] }[] = [];
  const claveToIdx = new Map<string, number>();

  for (const d of lista) {
    const claves = clavesFuertes(d);
    let found = -1;
    for (const c of claves) {
      const idx = claveToIdx.get(c);
      if (idx !== undefined) { found = idx; break; }
    }

    if (found === -1) {
      const kD = normDon(d.n);
      const claveD = claveDon(d.n);
      for (let i = 0; i < clusters.length && found === -1; i++) {
        for (const cn of clusters[i].names) {
          const kC = normDon(cn);
          if (
            kD === kC ||
            (kD.length >= 8 && (kD.startsWith(kC + " ") || kC.startsWith(kD + " "))) ||
            (claveD !== null && claveDon(cn) === claveD)
          ) { found = i; break; }
        }
      }
    }

    if (found === -1) {
      found = clusters.length;
      clusters.push({ names: [], list: [] });
    }
    const c = clusters[found];
    c.list.push(d);
    if (!c.names.includes(d.n)) c.names.push(d.n);
    for (const k of claves) claveToIdx.set(k, found);
  }

  return clusters.map((c) => {
    const nombre = c.names.map(repararTexto).reduce((b, n) => n.length > b.length ? n : b, "");
    const total = c.list.reduce((s, d) => s + (d.m ?? 0), 0);
    const conceptos = [...new Set(c.list.map((d) => d.t).filter(Boolean))];
    return { nombre, total, count: c.list.length, conceptos, list: c.list };
  }).sort((a, b) => b.total - a.total);
}
