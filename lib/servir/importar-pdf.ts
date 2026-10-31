// Importar reunión desde PDF: lectura con Claude.
//
// Solo servidor (usa ANTHROPIC_API_KEY). Lee el PDF de un orden de servicio
// (WorshipTools, Planning Center, un Word exportado…) y devuelve una Lectura:
// datos de la reunión, orden con canciones y responsables. No escribe nada
// en la base; eso pasa después de que la persona revisa y confirma.
//
// Sin nombres de iglesia ni zona horaria aquí: las horas salen tal como
// están en el documento ("HH:MM" en 24 h) y la app las interpreta en su zona.

import Anthropic from "@anthropic-ai/sdk";
import type { TipoItemOrden } from "@/lib/servir/contratos";

export const MODELO_IMPORTAR = "claude-opus-5-5";
export const MAX_BYTES_PDF = 4 * 1024 * 1024; // el cuerpo de una función de Vercel no pasa de 4,5 MB

export type CancionLeida = { titulo: string; tono: string | null; dirige: string | null };
export type ItemLeido = {
  hora: string | null;           // "HH:MM" 24 h, como dice el documento
  titulo: string;
  tipo: TipoItemOrden;
  duracion_seg: number | null;
  cancion: CancionLeida | null;  // solo si tipo = 'cancion'
};
export type ResponsableLeido = { grupo: string | null; rol: string; personas: string[] };
export type Lectura = {
  reunion: {
    nombre: string;
    tipo: string | null;          // uno de los tipos que existen, o null
    fecha: string | null;         // YYYY-MM-DD
    hora_inicio: string | null;   // HH:MM 24 h
    duracion_min: number | null;
    espacio: string | null;
    notas: string | null;
  };
  orden: ItemLeido[];
  responsables: ResponsableLeido[];
  advertencias: string[];
};

const KINDS: TipoItemOrden[] = ["cancion", "predica", "oracion", "anuncio", "encabezado", "otro"];

const texto = { type: "string" };
const textoONulo = { anyOf: [{ type: "string" }, { type: "null" }] };
const enteroONulo = { anyOf: [{ type: "integer" }, { type: "null" }] };

function objeto(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const ESQUEMA = objeto({
  reunion: objeto({
    nombre: texto,
    tipo: textoONulo,
    fecha: textoONulo,
    hora_inicio: textoONulo,
    duracion_min: enteroONulo,
    espacio: textoONulo,
    notas: textoONulo,
  }),
  orden: {
    type: "array",
    items: objeto({
      hora: textoONulo,
      titulo: texto,
      tipo: { type: "string", enum: KINDS },
      duracion_seg: enteroONulo,
      cancion: {
        anyOf: [objeto({ titulo: texto, tono: textoONulo, dirige: textoONulo }), { type: "null" }],
      },
    }),
  },
  responsables: {
    type: "array",
    items: objeto({ grupo: textoONulo, rol: texto, personas: { type: "array", items: texto } }),
  },
  advertencias: { type: "array", items: texto },
});

const SISTEMA = `Lees el PDF del plan de una reunión de iglesia (orden del servicio) y lo pasas a JSON. Copia lo que dice el documento; no inventes datos.

reunion
- nombre: el nombre de la reunión tal como aparece (sin la fecha).
- tipo: el tipo de reunión de la lista que te doy que mejor corresponda, escrito exactamente igual; null si ninguno corresponde.
- fecha: YYYY-MM-DD. Si el documento no trae el año, usa el de la fecha de referencia más cercana y avisa en advertencias.
- hora_inicio: hora de inicio de la reunión en 24 h (HH:MM), la del encabezado; null si no está.
- duracion_min: solo si el documento da la duración o la hora de fin de la reunión; si no, null.
- espacio: el lugar o salón si aparece; si no, null.
- notas: notas generales de la reunión si las hay; si no, null.

orden: cada renglón del orden, en el mismo orden del documento.
- hora: la hora del renglón en 24 h (HH:MM); null si no tiene. Si un a.m./p.m. es un error evidente por la secuencia (por ejemplo "11:50 p.m." entre 11:45 a.m. y 12:35 p.m.), corrígelo y avisa en advertencias.
- titulo: el texto del renglón sin la hora.
- tipo: cancion (una canción), predica (prédica o mensaje), oracion, anuncio, encabezado (bloques o secciones como "Alabanza y adoración (Bloque 1)") u otro (logística, montaje, llegadas, etc.).
- duracion_seg: si el renglón da duración ("6:24", "5 min"); 0:00 cuenta como null.
- cancion: solo para canciones: titulo de la canción sin el tono, tono (la nota del acorde, p. ej. "A", "Bb", "F#m") y dirige (quien la dirige); null en los demás renglones.
Las canciones van justo después del encabezado del bloque al que pertenecen. Si el documento repite el mismo renglón por un salto de página, ponlo una sola vez.

responsables: la tabla de roles o equipo. grupo es el departamento o sección (p. ej. "Creativos"), rol es la posición (p. ej. "Cámara Principal") y personas los nombres tal cual. Si no hay, lista vacía.

advertencias: lo que la persona debe revisar (datos dudosos, ilegibles o corregidos). Cortas y en español.`;

export class ErrorLectura extends Error {}

function limpiarTexto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function limpiarHora(v: unknown): string | null {
  const t = limpiarTexto(v, 8);
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
}

function limpiarEntero(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
}

// Lo que devuelve el modelo ya cumple el esquema; esto recorta y normaliza.
export function limpiarLectura(raw: unknown): Lectura {
  const r = (raw ?? {}) as Record<string, unknown>;
  const reunion = (r.reunion ?? {}) as Record<string, unknown>;
  const fecha = limpiarTexto(reunion.fecha, 10);

  const orden: ItemLeido[] = (Array.isArray(r.orden) ? r.orden : []).slice(0, 120).flatMap((x): ItemLeido[] => {
    const i = (x ?? {}) as Record<string, unknown>;
    const titulo = limpiarTexto(i.titulo, 200);
    if (!titulo) return [];
    const tipo = KINDS.includes(i.tipo as TipoItemOrden) ? (i.tipo as TipoItemOrden) : "otro";
    const c = (i.cancion ?? null) as Record<string, unknown> | null;
    const cancion = tipo === "cancion"
      ? {
          titulo: limpiarTexto(c?.titulo, 200) ?? titulo,
          tono: limpiarTexto(c?.tono, 12),
          dirige: limpiarTexto(c?.dirige, 120),
        }
      : null;
    return [{ hora: limpiarHora(i.hora), titulo, tipo, duracion_seg: limpiarEntero(i.duracion_seg, 6 * 3600), cancion }];
  });

  const responsables: ResponsableLeido[] = (Array.isArray(r.responsables) ? r.responsables : []).slice(0, 200).flatMap((x) => {
    const p = (x ?? {}) as Record<string, unknown>;
    const rol = limpiarTexto(p.rol, 120);
    const personas = (Array.isArray(p.personas) ? p.personas : [])
      .map((n) => limpiarTexto(n, 120)).filter((n): n is string => !!n);
    return rol && personas.length ? [{ grupo: limpiarTexto(p.grupo, 120), rol, personas }] : [];
  });

  return {
    reunion: {
      nombre: limpiarTexto(reunion.nombre, 200) ?? "",
      tipo: limpiarTexto(reunion.tipo, 200),
      fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
      hora_inicio: limpiarHora(reunion.hora_inicio),
      duracion_min: limpiarEntero(reunion.duracion_min, 1440),
      espacio: limpiarTexto(reunion.espacio, 200),
      notas: limpiarTexto(reunion.notas, 2000),
    },
    orden,
    responsables,
    advertencias: (Array.isArray(r.advertencias) ? r.advertencias : [])
      .map((a) => limpiarTexto(a, 300)).filter((a): a is string => !!a).slice(0, 20),
  };
}

export function importarConfigurado(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function leerPdf(
  pdf: Buffer,
  opciones: { tipos: string[]; hoy: string },
): Promise<{ lectura: Lectura; modelo: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic();
  const tipos = opciones.tipos.length ? opciones.tipos.map((t) => `- ${t}`).join("\n") : "(no hay tipos)";

  let respuesta: Anthropic.Beta.BetaMessage;
  try {
    respuesta = await client.beta.messages.create({
      model: MODELO_IMPORTAR,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: SISTEMA,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: `Tipos de reunión que existen:\n${tipos}\n\nFecha de referencia (hoy): ${opciones.hoy}` },
        ],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorLectura("La clave de la API de Claude no es válida.");
    if (e instanceof Anthropic.RateLimitError) throw new ErrorLectura("Claude está ocupado. Intenta de nuevo en un minuto.");
    if (e instanceof Anthropic.BadRequestError) throw new ErrorLectura("Claude no pudo abrir ese PDF. ¿Está dañado o protegido con clave?");
    if (e instanceof Anthropic.APIError) throw new ErrorLectura(`Claude respondió con un error (${e.status ?? "sin conexión"}).`);
    throw e;
  }

  if (respuesta.stop_reason === "refusal") throw new ErrorLectura("Claude no quiso leer este documento.");
  if (respuesta.stop_reason === "max_tokens") throw new ErrorLectura("El documento es demasiado largo para leerlo de una vez.");
  const bloque = respuesta.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!bloque) throw new ErrorLectura("Claude no devolvió nada.");

  let json: unknown;
  try {
    json = JSON.parse(bloque.text);
  } catch {
    throw new ErrorLectura("La lectura llegó incompleta. Intenta de nuevo.");
  }
  return {
    lectura: limpiarLectura(json),
    modelo: respuesta.model,
    inputTokens: respuesta.usage.input_tokens,
    outputTokens: respuesta.usage.output_tokens,
  };
}
