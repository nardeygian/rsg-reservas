// Utilidades sin dependencias del servidor: las usan páginas, acciones y
// componentes de cliente por igual.

// ── Letra por secciones ──────────────────────────────────────────────────
// Una línea "[Verso 1]" abre una sección; lo anterior a la primera queda en
// una sección sin nombre.
export type Seccion = { nombre: string | null; lineas: string[] };

const ENCABEZADO = /^\s*\[([^\]]{1,40})\]\s*$/;

export function seccionesDeLetra(letra: string | null | undefined): Seccion[] {
  const secciones: Seccion[] = [];
  let actual: Seccion | null = null;
  for (const linea of (letra ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const m = linea.match(ENCABEZADO);
    if (m) {
      actual = { nombre: m[1].trim(), lineas: [] };
      secciones.push(actual);
      continue;
    }
    if (!actual) {
      if (!linea.trim()) continue;
      actual = { nombre: null, lineas: [] };
      secciones.push(actual);
    }
    actual.lineas.push(linea.trimEnd());
  }
  // Sin líneas vacías al principio ni al final de cada sección.
  for (const s of secciones) {
    while (s.lineas.length && !s.lineas[0].trim()) s.lineas.shift();
    while (s.lineas.length && !s.lineas.at(-1)!.trim()) s.lineas.pop();
  }
  return secciones.filter((s) => s.nombre || s.lineas.length);
}

export const SECCIONES_SUGERIDAS = ["Intro", "Verso 1", "Verso 2", "Pre-coro", "Coro", "Puente", "Final"];

// ── Tonos ────────────────────────────────────────────────────────────────
const NOTAS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
export const TONOS = [...NOTAS, ...NOTAS.map((n) => `${n}m`)];

// ── Etiquetas ────────────────────────────────────────────────────────────
export function limpiarEtiquetas(raw: unknown): string[] {
  const lista = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const t of lista) {
    if (typeof t !== "string") continue;
    const limpia = t.trim().replace(/\s+/g, " ").slice(0, 40);
    const clave = limpia.toLocaleLowerCase("es");
    if (!limpia || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(limpia);
    if (out.length >= 20) break;
  }
  return out;
}

// ── Archivos (songs.files) ───────────────────────────────────────────────
export type TipoArchivo = "letra" | "acordes" | "partitura" | "audio";
export type ArchivoCancion = { path: string; name: string; kind: TipoArchivo; size?: number; mime?: string };

export const TIPOS_ARCHIVO: { value: TipoArchivo; label: string }[] = [
  { value: "letra", label: "Letra" },
  { value: "acordes", label: "Acordes" },
  { value: "partitura", label: "Partitura" },
  { value: "audio", label: "Audio" },
];

// Los mismos que acepta el bucket (migración 20261028030000).
export const MIME_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg", "text/plain", "audio/mpeg", "audio/mp4"];
export const ACCEPT_ARCHIVOS = ".pdf,.png,.jpg,.jpeg,.txt,.mp3,.m4a," + MIME_PERMITIDOS.join(",");
export const MAX_BYTES = 20 * 1024 * 1024;

export function archivosDe(files: unknown): ArchivoCancion[] {
  if (!Array.isArray(files)) return [];
  return files.filter(
    (f): f is ArchivoCancion =>
      !!f && typeof f === "object" && typeof (f as ArchivoCancion).path === "string" && typeof (f as ArchivoCancion).name === "string",
  ).map((f) => ({ ...f, kind: TIPOS_ARCHIVO.some((t) => t.value === f.kind) ? f.kind : "letra" }));
}

export function tipoSugerido(mime: string): TipoArchivo {
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "text/plain") return "letra";
  return "acordes";
}

export function tamano(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}

// Nombre seguro para Storage: sin tildes ni caracteres raros, conserva la extensión.
export function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpio = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return (limpio || "archivo").slice(-100);
}

// ── Filtros de la biblioteca ─────────────────────────────────────────────
export const BPM_RANGOS = [
  { value: "lento", label: "Lento (< 80)" },
  { value: "medio", label: "Medio (80–120)" },
  { value: "rapido", label: "Rápido (> 120)" },
];

export const USOS = [
  { value: "programada", label: "Programada" },
  { value: "reciente", label: "Últimos 30 días" },
  { value: "antigua", label: "Hace más de 3 meses" },
  { value: "nunca", label: "Nunca usada" },
];

export const ORDENES = [
  { value: "", label: "Título (A–Z)" },
  { value: "uso", label: "Usadas hace poco" },
  { value: "menos", label: "Menos usadas" },
  { value: "bpm", label: "BPM" },
];
