import type { SvData, SvReunionUI, SvPer, SvConteoEntry } from "./types";

export const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export const MES3   = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIA3          = ["dom","lun","mar","mié","jue","vie","sáb"];

export const PER_CONFIG: Record<SvPer, { n: number; span: number; nombre: string }> = {
  mes:        { n: 12, span: 1,  nombre: "mes" },
  trimestre:  { n: 4,  span: 3,  nombre: "trimestre" },
  semestre:   { n: 2,  span: 6,  nombre: "semestre" },
  anio:       { n: 1,  span: 12, nombre: "año" },
};

export function svNorm(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

export function svTipo(r: { seccion?: string; nombre?: string; tipo?: string }): "min" | "serv" {
  if (r.tipo === "serv" || r.tipo === "min") return r.tipo as "min" | "serv";
  const sec = svNorm(r.seccion ?? "");
  const nom = svNorm(r.nombre ?? "");
  return sec.includes("servolucion") || nom.startsWith("servolucion") ? "serv" : "min";
}

export function svUnidad(r: { nombre?: string; fecha: string; id: string }): string {
  if (svNorm(r.nombre ?? "").includes("reunion central")) return `central|${r.fecha}`;
  return `r|${r.id}`;
}

export function svNombreLimpio(n: string): string {
  return (n ?? "").replace(/^\[[^\]]*\]\s*/, "").trim() || n;
}

export function svFmt(f: string): string {
  const [y, m, d] = f.split("-").map(Number);
  const dia = DIA3[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia} ${String(d).padStart(2, "0")} ${MES3[m - 1]} ${y}`;
}

export function svDiaLargo(iso: string): string {
  const t = new Date(iso + "T12:00:00-05:00").toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function svHoyISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export function rango(per: SvPer, y: number, i: number): { y: number; m0: number; m1: number } {
  const sp = PER_CONFIG[per].span;
  return { y, m0: i * sp, m1: i * sp + sp };
}

export function etiqueta(per: SvPer, y: number, i: number): string {
  const r = rango(per, y, i);
  if (per === "mes") return `${MESES[r.m0].charAt(0).toUpperCase()}${MESES[r.m0].slice(1)} ${y}`;
  if (per === "anio") return `Año ${y}`;
  return `${per === "trimestre" ? "T" : "S"}${i + 1} ${y} · ${MES3[r.m0]} a ${MES3[r.m1 - 1]}`;
}

export function etiquetaCorta(per: SvPer, y: number, i: number): string {
  return etiqueta(per, y, i).split(" · ")[0];
}

export function shiftPeriodo(per: SvPer, y: number, i: number, dir: number): [number, number] {
  const n = PER_CONFIG[per].n;
  i += dir;
  if (i < 0)    { y--; i = n - 1; }
  if (i >= n)   { y++; i = 0; }
  return [y, i];
}

export function periodoActual(per: SvPer): { y: number; i: number } {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [y, m] = hoy.split("-").map(Number);
  return { y, i: Math.floor((m - 1) / PER_CONFIG[per].span) };
}

export function svEnPeriodo(f: string, per: SvPer, y: number, i: number): boolean {
  const r = rango(per, y, i);
  const parts = f.split("-").map(Number);
  return parts[0] === r.y && (parts[1] - 1) >= r.m0 && (parts[1] - 1) < r.m1;
}

export function esFuturo(per: SvPer, y: number, i: number): boolean {
  const { y: hy, i: hi } = periodoActual(per);
  return y > hy || (y === hy && i > hi);
}

export function svConteo(reuniones: SvReunionUI[]): Map<string, SvConteoEntry> {
  const m = new Map<string, SvConteoEntry>();
  for (const r of reuniones) {
    if (!r.cargada) continue;
    const t = svTipo(r);
    for (const f of r.filas) {
      if (!m.has(f.sid)) {
        m.set(f.sid, { u: new Set(), min: new Set(), serv: new Set(), aus: new Set(), roles: new Set(), ult: "", reus: [] });
      }
      const x = m.get(f.sid)!;
      x.reus.push({ r, roles: f.roles ?? [], aus: !!f.aus, nota: f.nota ?? "" });
      if (f.aus) { x.aus.add(r.id); continue; }
      x.u.add(r.u); x[t].add(r.u);
      for (const ro of f.roles ?? []) x.roles.add(ro);
      if (r.fecha > x.ult) x.ult = r.fecha;
    }
  }
  return m;
}

export function enrichReuniones(data: SvData): SvReunionUI[] {
  return Object.values(data.reuniones).map(r => {
    const reg = data.registros[r.id];
    return {
      ...r,
      u: svUnidad(r),
      tipo: svTipo(r),
      cargada: !!reg,
      cuando: reg?.cuando ?? null,
      nota: reg?.nota ?? "",
      filas: reg?.filas ?? [],
    };
  });
}
