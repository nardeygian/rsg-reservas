"use server";

// B2 · Canciones — implementa AccionesCanciones (lib/servir/contratos.ts).
// Escribir exige canciones.editar en la base (RLS de songs y del bucket
// 'songs'); leer, cualquier autenticado. Ninguna acción usa service_role.
//
// Subida de archivos en dos pasos: el cuerpo de una server action no pasa de
// 1 MB en Next y de 4,5 MB en Vercel, y un audio pesa más. Por eso
// prepararSubidaCancion entrega una URL firmada de subida, el navegador sube
// directo a Storage y subirArchivoCancion (la firma del contrato) verifica el
// objeto y lo agrega a songs.files.

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import type { AccionesCanciones, Cancion, Resultado } from "@/lib/servir/contratos";
import { puedeEditarCanciones, servirClient, usuarioActual, type ServirClient } from "./_lib/db";
import {
  archivosDe,
  limpiarEtiquetas,
  MAX_BYTES,
  MIME_PERMITIDOS,
  nombreSeguro,
  TIPOS_ARCHIVO,
  type ArchivoCancion,
  type TipoArchivo,
} from "./_lib/canciones";

const BUCKET = "songs";
const SIN_PERMISO = "No tienes permiso para editar canciones.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function errorBase(e: { code?: string; message: string }): string {
  if (e.code === "42501" || /row-level security|unauthorized|not allowed/i.test(e.message)) return SIN_PERMISO;
  if (e.code === "23514") return "Algún dato no es válido (revisa el BPM).";
  return `No se pudo guardar: ${e.message}`;
}

// Sesión + permiso. La base lo vuelve a exigir; esto solo da un mensaje claro.
async function editor(): Promise<{ supabase: ServirClient; userId: string } | { error: string }> {
  const supabase = await servirClient();
  const userId = await usuarioActual(supabase);
  if (!userId) return { error: "Tu sesión expiró. Vuelve a entrar." };
  if (!(await puedeEditarCanciones(supabase))) return { error: SIN_PERMISO };
  return { supabase, userId };
}

function revalidar(id?: string) {
  revalidatePath("/servir/canciones");
  if (id) revalidatePath(`/servir/canciones/${id}`, "layout");
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// ── Canción ──────────────────────────────────────────────────────────────

const guardarCancion: AccionesCanciones["guardarCancion"] = async (input) => {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  const { supabase, userId } = ctx;

  const title = texto(input.title, 200);
  if (!title) return fallo("Escribe el título de la canción.");

  let bpm: number | null = null;
  if (input.bpm !== undefined && input.bpm !== null && String(input.bpm) !== "") {
    bpm = Math.round(Number(input.bpm));
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) return fallo("El BPM debe estar entre 20 y 300.");
  }

  // Solo estos campos vienen del formulario: files y last_used_on los
  // mantienen las acciones de archivos y la base.
  const fila: Partial<Cancion> = {
    title,
    artist: texto(input.artist, 120),
    default_key: texto(input.default_key, 8),
    bpm,
    ccli: texto(input.ccli, 20),
    tags: limpiarEtiquetas(input.tags),
    lyrics: typeof input.lyrics === "string" ? input.lyrics.replace(/\r\n?/g, "\n").slice(0, 50_000) || null : null,
  };
  if (typeof input.active === "boolean") fila.active = input.active;

  if (input.id) {
    if (!UUID.test(input.id)) return fallo("Canción no válida.");
    const { data, error } = await supabase.from("songs").update(fila).eq("id", input.id).select("id").maybeSingle();
    if (error) return fallo(errorBase(error));
    if (!data) return fallo("No se encontró la canción o no tienes permiso para editarla.");
    revalidar(data.id);
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("songs")
    .insert({ ...fila, title, created_by: userId })
    .select("id")
    .single();
  if (error) return fallo(errorBase(error));
  revalidar(data.id);
  return { ok: true, data: { id: data.id } };
};

// Archiva: la canción sale de la biblioteca y del selector del orden, pero
// las reuniones que ya la usaron conservan el enlace (run_items.song_id) y
// sus archivos. Se puede restaurar con guardarCancion({ id, active: true }).
const borrarCancion: AccionesCanciones["borrarCancion"] = async (id) => {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  if (!UUID.test(id)) return fallo("Canción no válida.");
  const { data, error } = await ctx.supabase.from("songs").update({ active: false }).eq("id", id).select("id").maybeSingle();
  if (error) return fallo(errorBase(error));
  if (!data) return fallo("No se encontró la canción.");
  revalidar(id);
  return { ok: true, data: undefined };
};

export async function restaurarCancion(id: string): Promise<Resultado> {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  if (!UUID.test(id)) return fallo("Canción no válida.");
  const { data, error } = await ctx.supabase.from("songs").update({ active: true }).eq("id", id).select("id").maybeSingle();
  if (error) return fallo(errorBase(error));
  if (!data) return fallo("No se encontró la canción.");
  revalidar(id);
  return { ok: true, data: undefined };
}

// ── Archivos ─────────────────────────────────────────────────────────────

async function archivosActuales(supabase: ServirClient, songId: string): Promise<ArchivoCancion[] | null> {
  const { data } = await supabase.from("songs").select("files").eq("id", songId).maybeSingle();
  return data ? archivosDe(data.files) : null;
}

// Paso 1: valida y entrega una URL firmada para subir a songs/{id}/{archivo}.
export async function prepararSubidaCancion(
  songId: string,
  archivo: { name: string; type: string; size: number },
): Promise<Resultado<{ path: string; token: string }>> {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  if (!UUID.test(songId)) return fallo("Canción no válida.");
  if (!MIME_PERMITIDOS.includes(archivo.type)) return fallo("Ese tipo de archivo no se admite. Sube PDF, imagen, texto, MP3 o M4A.");
  if (!(archivo.size > 0) || archivo.size > MAX_BYTES) return fallo("El archivo debe pesar menos de 20 MB.");

  const actuales = await archivosActuales(ctx.supabase, songId);
  if (!actuales) return fallo("No se encontró la canción.");

  // Si el nombre ya existe, se numera (letra.pdf → letra-2.pdf).
  const seguro = nombreSeguro(archivo.name);
  const punto = seguro.lastIndexOf(".");
  const [base, ext] = punto > 0 ? [seguro.slice(0, punto), seguro.slice(punto)] : [seguro, ""];
  const usados = new Set(actuales.map((a) => a.path));
  let path = `${songId}/${seguro}`;
  for (let n = 2; usados.has(path); n++) path = `${songId}/${base}-${n}${ext}`;

  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error) return fallo(errorBase(error));
  return { ok: true, data: { path: data.path, token: data.token } };
}

// Paso 2 (firma del contrato): FormData con path, name, kind, size y mime.
const subirArchivoCancion: AccionesCanciones["subirArchivoCancion"] = async (songId, archivo) => {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  if (!UUID.test(songId)) return fallo("Canción no válida.");

  const path = String(archivo.get("path") ?? "");
  const carpeta = `${songId}/`;
  const nombreObjeto = path.slice(carpeta.length);
  if (!path.startsWith(carpeta) || !nombreObjeto || nombreObjeto.includes("/")) return fallo("Ruta de archivo no válida.");
  const kindRaw = String(archivo.get("kind") ?? "");
  const kind: TipoArchivo = TIPOS_ARCHIVO.some((t) => t.value === kindRaw) ? (kindRaw as TipoArchivo) : "letra";
  const name = texto(archivo.get("name"), 120) ?? nombreObjeto;

  // El objeto tiene que existir de verdad en el bucket.
  const { data: lista, error: errLista } = await ctx.supabase.storage.from(BUCKET).list(songId, { search: nombreObjeto, limit: 20 });
  if (errLista) return fallo(errorBase(errLista));
  const objeto = (lista ?? []).find((o) => o.name === nombreObjeto);
  if (!objeto) return fallo("El archivo no terminó de subir. Inténtalo de nuevo.");
  const meta = (objeto.metadata ?? {}) as { size?: number; mimetype?: string };

  const actuales = await archivosActuales(ctx.supabase, songId);
  if (!actuales) return fallo("No se encontró la canción.");
  const nuevo: ArchivoCancion = { path, name, kind, size: meta.size, mime: meta.mimetype };
  const files = [...actuales.filter((a) => a.path !== path), nuevo];

  const { data, error } = await ctx.supabase
    .from("songs")
    .update({ files: files as unknown as Json })
    .eq("id", songId)
    .select("id")
    .maybeSingle();
  if (error) return fallo(errorBase(error));
  if (!data) return fallo(SIN_PERMISO);
  revalidar(songId);
  return { ok: true, data: { path } };
};

export async function cambiarTipoArchivo(songId: string, path: string, kind: TipoArchivo): Promise<Resultado> {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  if (!TIPOS_ARCHIVO.some((t) => t.value === kind)) return fallo("Tipo no válido.");
  const actuales = await archivosActuales(ctx.supabase, songId);
  if (!actuales) return fallo("No se encontró la canción.");
  const files = actuales.map((a) => (a.path === path ? { ...a, kind } : a));
  const { error } = await ctx.supabase.from("songs").update({ files: files as unknown as Json }).eq("id", songId);
  if (error) return fallo(errorBase(error));
  revalidar(songId);
  return { ok: true, data: undefined };
}

export async function borrarArchivoCancion(songId: string, path: string): Promise<Resultado> {
  const ctx = await editor();
  if ("error" in ctx) return fallo(ctx.error);
  if (!UUID.test(songId) || !path.startsWith(`${songId}/`)) return fallo("Ruta de archivo no válida.");
  const actuales = await archivosActuales(ctx.supabase, songId);
  if (!actuales) return fallo("No se encontró la canción.");

  const { error: errStorage } = await ctx.supabase.storage.from(BUCKET).remove([path]);
  if (errStorage) return fallo(errorBase(errStorage));
  const files = actuales.filter((a) => a.path !== path);
  const { error } = await ctx.supabase.from("songs").update({ files: files as unknown as Json }).eq("id", songId);
  if (error) return fallo(errorBase(error));
  revalidar(songId);
  return { ok: true, data: undefined };
}

// Server actions exportadas con la forma del contrato.
export { guardarCancion, borrarCancion, subirArchivoCancion };
