// Client-only: PDF parsing using pdf.js loaded from CDN (same approach as panel PHP).

const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

type PdfDoc  = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfPage = { getTextContent: () => Promise<{ items: PdfItem[] }> };
type PdfItem = { str: string; transform: number[]; width: number; height: number };

async function svCargarPdfJs(): Promise<void> {
  if ((window as any).pdfjsLib) return;
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = PDFJS_BASE + "pdf.min.js";
    s.onload = () => { (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js"; ok(); };
    s.onerror = () => no(new Error("no se pudo cargar el lector de PDF (revisa la conexión)"));
    document.head.append(s);
  });
}

export async function svLeerPDF(file: File): Promise<string[][]> {
  await svCargarPdfJs();
  const pdfjs = (window as any).pdfjsLib;
  const pdf: PdfDoc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lineas: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const items = tc.items
      .filter((i: PdfItem) => i.str?.trim())
      .map((i: PdfItem) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) || 10 }));
    items.sort((a: any, b: any) => b.y - a.y || a.x - b.x);
    let fila: typeof items = [], y0: number | null = null;
    const cerrar = () => {
      if (!fila.length) return;
      fila.sort((a: any, b: any) => a.x - b.x);
      const celdas: string[] = [];
      let cur = fila[0].s, fin = fila[0].x + fila[0].w;
      for (let k = 1; k < fila.length; k++) {
        const it = fila[k]; const hueco = it.x - fin;
        if (hueco > Math.max(5, it.h * 0.55)) { celdas.push(cur.trim()); cur = it.s; }
        else cur += (hueco > it.h * 0.15 && !/\s$/.test(cur) && !/^\s/.test(it.s) ? " " : "") + it.s;
        fin = Math.max(fin, it.x + it.w);
      }
      celdas.push(cur.trim());
      lineas.push(celdas.filter(Boolean));
      fila = [];
    };
    for (const it of items) {
      if (y0 === null || Math.abs(it.y - y0) > Math.max(3, it.h * 0.5)) { cerrar(); y0 = it.y; }
      fila.push(it);
    }
    cerrar();
  }
  return lineas;
}

export function svNormPdf(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function svTokens(t: string): string[] {
  return t.split(/\s+/).map(w => w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ''.\-]/g, "").toLowerCase()).filter(w => w.length > 1);
}

const SV_NO_NOMBRE = new Set(
  "sonido audio camara camaras luces video proyeccion pantalla pantallas transmision streaming bienvenida protocolo ujier ujieres alabanza adoracion banda coro coros voz voces vocal vocales bajo guitarra bateria piano teclado teclados director directora direccion produccion productor medios ninos semillas maestro maestra maestros apoyo logistica montaje aseo cafeteria seguridad parqueadero oracion intercesion predicador predica presentador presentadora anfitrion anfitriones coordinador coordinadora coordinacion lider lideres equipo ministerio reunion servicio servidores servidor fecha hora lugar total rol roles nombre nombres area areas domingo lunes martes miercoles jueves viernes sabado enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre resurgencia rsg central general redes fotografia foto fotos diseno contacto conexion cocina staff roadie roadies backstage tarima escenario listado lista asistencia observaciones encargado encargada responsable responsables horario turno turnos primera segunda jovenes mujeres hombres mayores casa formacion evento eventos mega bautizos ofrenda ofrendas diezmos santa cena multimedia sala salon recepcion acomodadores consolidacion tecnica tecnico planeacion creativos creativo edicion editor grabacion grabador".split(" ")
);

function svEsNombre(t: string): string | null {
  t = t.replace(/^[\s\d.)\-•*·–]+/, "").trim();
  if (!t || /\d/.test(t) || t.length > 60) return null;
  const pal = t.split(/\s+/);
  if (pal.length < 2 || pal.length > 5) return null;
  if (!pal.every(p => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ''.\-]+$/.test(p))) return null;
  if (pal.some(p => SV_NO_NOMBRE.has(svNormPdf(p)))) return null;
  const may = t === t.toUpperCase();
  const iniciales = pal.filter(p => /^[A-ZÁÉÍÓÚÑ]/.test(p)).length;
  if (!may && iniciales < 2) return null;
  if (svTokens(t).length < 2) return null;
  return t;
}

const SV_PART = new Set(["de", "del", "la", "las", "los", "y"]);

function svInterpretarPlanning(lineas: string[][]): { nombre: string; roles: string[] }[] | null {
  const ini = lineas.findIndex(c => c.length === 1 && svNormPdf(c[0]) === "roles");
  if (ini < 0) return null;
  const out = new Map<string, { nombre: string; roles: Set<string> }>();
  let equipo = "";
  for (let i = ini + 1; i < lineas.length; i++) {
    const celdas = lineas[i]; const txt = celdas.join(" ");
    if (/worshiptools|reservados todos los derechos/i.test(txt)) break;
    const k = celdas.findIndex(c => /:\s*$/.test(c) || /:\s+\S/.test(c));
    if (k < 0) continue;
    if (k > 0) equipo = celdas.slice(0, k).join(" ").trim();
    const m = celdas[k].match(/^(.*?):\s*(.*)$/);
    if (!m) continue;
    const rol = m[1].trim().replace(/\s*,\s*/g, " / ");
    const resto = [m[2]].concat(celdas.slice(k + 1)).join(" ");
    resto.split(",").map(n => n.replace(/\s+/g, " ").trim())
      .filter(n => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(n) && !/\d/.test(n))
      .forEach(n => {
        const nombre = n.split(" ").map(w => SV_PART.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace(/^./, x => x.toUpperCase());
        const key = svNormPdf(nombre);
        if (!out.has(key)) out.set(key, { nombre, roles: new Set() });
        out.get(key)!.roles.add((equipo ? equipo + " · " : "") + rol);
      });
  }
  return out.size ? [...out.values()].map(x => ({ nombre: x.nombre, roles: [...x.roles] })) : null;
}

function tituloCase(t: string): string {
  if (t === t.toUpperCase()) {
    t = t.toLowerCase()
      .replace(/(^|[\s''\-])([a-záéíóúüñ])/g, (_, a, b) => a + b.toUpperCase())
      .replace(/\b(De|Del|La|Las|Los|Y)\b/g, x => x.toLowerCase())
      .replace(/^./, x => x.toUpperCase());
  }
  return t;
}

const rolLimpio = (t: string) => t.replace(/^[\s\d.)\-•*·–]+|[\s:.\-–]+$/g, "").trim();

export function svInterpretar(
  lineas: string[][],
  conocidos: { nombre: string }[],
  pegado?: boolean
): { nombre: string; roles: string[] }[] {
  if (!pegado) {
    const wt = svInterpretarPlanning(lineas);
    if (wt) return wt;
  }
  const conoc = new Set((conocidos ?? []).map(x => svNormPdf(x.nombre)));
  const esNombre = (t: string): string | null => {
    const limpio = t.replace(/^[\s\d.)\-•*·–]+/, "").trim();
    if (conoc.has(svNormPdf(limpio)) && svNormPdf(limpio)) return limpio;
    return svEsNombre(t);
  };
  const out = new Map<string, { nombre: string; roles: Set<string> }>();
  let rolActual = "";
  const agregar = (nombre: string, rol: string) => {
    nombre = tituloCase(nombre);
    const k = svNormPdf(nombre); if (!k) return;
    if (!out.has(k)) out.set(k, { nombre: nombre.replace(/\s+/g, " ").trim(), roles: new Set() });
    if (rol) out.get(k)!.roles.add(rol);
  };
  for (const celdas of lineas) {
    const piezas: { t: string; antesDeDosPuntos: boolean }[] = [];
    celdas.forEach(cel => {
      String(cel).split(/\s*[:|]\s*/).forEach((parte, idx, arr) => {
        parte.split(/\s*[,;\/•]\s*|\s+[-–]\s+/).forEach(p => {
          p = p.trim(); if (p) piezas.push({ t: p, antesDeDosPuntos: arr.length > 1 && idx === 0 });
        });
      });
    });
    const nombres: string[] = [], otros: string[] = [];
    for (const p of piezas) {
      const n = p.antesDeDosPuntos ? null : esNombre(p.t);
      if (n) { nombres.push(n); continue; }
      if (!p.antesDeDosPuntos) {
        const w = p.t.split(/\s+/);
        let found = false;
        for (let k = Math.min(5, w.length - 1); k >= 2; k--) {
          const cola = esNombre(w.slice(-k).join(" "));
          if (cola) { nombres.push(cola); otros.push(rolLimpio(w.slice(0, -k).join(" "))); found = true; break; }
        }
        if (!found) otros.push(rolLimpio(p.t));
      } else {
        otros.push(rolLimpio(p.t));
      }
    }
    const rolesLinea = otros.filter(o => o && o.length <= 40 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(o) && !/^\d/.test(o)).filter((o, i, a) => a.indexOf(o) === i);
    if (!nombres.length) { if (rolesLinea.length === 1) rolActual = rolesLinea[0]; continue; }
    const rol = rolesLinea.length ? rolesLinea.join(" · ") : rolActual;
    nombres.forEach(n => agregar(n, rol));
  }
  return [...out.values()].map(x => ({ nombre: x.nombre, roles: [...x.roles] }));
}
