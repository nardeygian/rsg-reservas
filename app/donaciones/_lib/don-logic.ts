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
export const donantes = (list: Donacion[]) => new Set(list.map((d) => d.k)).size;
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
