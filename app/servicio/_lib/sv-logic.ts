import type { SvData, SvReunionUI, SvPer, SvConteoEntry, SvMiembro, SvServicioItem, SvDiscipuloFila } from "./types";

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

function svNombreClave(norm: string): string | null {
  const p = norm.split(" ").filter(Boolean);
  if (p.length < 2) return null;
  // Estructura colombiana típica: [nombre1, nombre2?, apellido1, apellido2?]
  // Para 2 palabras: [N, A1] → clave = p[0] + p[1]
  // Para 3 palabras: [N1, N2, A1] → clave = p[0] + p[2]
  // Para 4+ palabras: [N1, N2, A1, A2] → clave = p[0] + p[2]
  const apellidoIdx = Math.min(2, p.length - 1);
  return p[0] + " " + p[apellidoIdx];
}

export function svDiOf(s: { id: string; nombre: string; di?: string | null }, miembros: Record<string, SvMiembro>): string | null {
  if ("di" in s && s.di !== undefined) return s.di ?? null;
  const kS = svNorm(s.nombre);
  const lista = Object.values(miembros);
  // 1. Exact match
  const exacto = lista.find(m => svNorm(m.nombre) === kS);
  if (exacto) return exacto.id;
  // 2. Prefix match: "Luis Miguel Utria" ↔ "Luis Miguel Utria Gil"
  const prefijo = lista.find(m => {
    const kM = svNorm(m.nombre);
    if (kM.length < 8) return false;
    return kS.startsWith(kM + " ") || kM.startsWith(kS + " ");
  });
  if (prefijo) return prefijo.id;
  // 3. Primer nombre + primer apellido: "Luis Miguel Utria" ↔ "Luis Antonio Utria"
  const claveSrv = svNombreClave(kS);
  if (claveSrv) {
    const porClave = lista.find(m => svNombreClave(svNorm(m.nombre)) === claveSrv);
    if (porClave) return porClave.id;
  }
  return null;
}

export function svServiciosGrupo(data: SvData, grupoId: string): SvServicioItem[] {
  const out: SvServicioItem[] = [];
  Object.values(data.reuniones).forEach(r => {
    const reg = data.registros[r.id];
    if (!reg) return;
    const t = svTipo(r);
    const u = svUnidad(r);
    reg.filas.forEach(f => {
      const s = data.servidores[f.sid];
      if (!s) return;
      const di = svDiOf(s, data.miembros ?? {});
      if (!di) return;
      const m = (data.miembros ?? {})[di];
      if (!m || m.grupo_id !== grupoId) return;
      out.push({ di, f: r.fecha, r: r.nombre, u, t, aus: !!f.aus, rid: r.id, roles: f.roles ?? [] });
    });
  });
  return out;
}

export function svTablaDiscipulos(
  miembros: SvMiembro[],
  servicios: SvServicioItem[],
  per: SvPer, y: number, i: number
): { filas: SvDiscipuloFila[]; sirvieron: number; totMin: number; totServ: number; totAus: number } {
  const ps = servicios.filter(x => svEnPeriodo(x.f, per, y, i));
  const filas: SvDiscipuloFila[] = miembros.map(m => {
    const todos = ps.filter(x => x.di === m.id);
    const mios  = todos.filter(x => !x.aus);
    const um = new Map<string, SvServicioItem>(), us = new Map<string, SvServicioItem>();
    mios.forEach(x => { const d = x.t === "serv" ? us : um; if (!d.has(x.u)) d.set(x.u, x); });
    const aus = new Set(todos.filter(x => x.aus).map(x => x.rid || x.u + x.f)).size;
    return { id: m.id, n: m.nombre, min: um.size, serv: us.size, aus, det: todos.slice().sort((a, b) => b.f.localeCompare(a.f)) };
  }).sort((a, b) => (b.min + b.serv) - (a.min + a.serv) || b.aus - a.aus || a.n.localeCompare(b.n, "es"));
  return {
    filas,
    sirvieron: filas.filter(f => f.min + f.serv > 0).length,
    totMin:    filas.reduce((a, f) => a + f.min, 0),
    totServ:   filas.reduce((a, f) => a + f.serv, 0),
    totAus:    filas.reduce((a, f) => a + f.aus, 0),
  };
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
