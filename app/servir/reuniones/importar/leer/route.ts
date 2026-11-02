// Importar reunión desde PDF · paso 1: leer.
//
// Recibe el PDF (multipart, campo "pdf"), lo manda a Claude y devuelve la
// lectura para la pantalla de revisión. No crea la reunión: solo deja el
// registro en meeting_imports (quién, qué archivo, tokens, lo leído).
// Es una ruta y no una server action porque el cuerpo de una acción no pasa
// de 1 MB en Next; aquí el límite lo pone Vercel (4,5 MB).

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/database.types";
import { ErrorLectura, importarConfigurado, leerPdf, MAX_BYTES_PDF, type Lectura } from "@/lib/servir/importar-pdf";
import { servirClient, usuarioActual } from "../../_lib/db";
import { hoyBogota } from "../../_lib/fechas";

export const maxDuration = 300;

export type RespuestaLeer =
  | { ok: true; importId: string; lectura: Lectura }
  | { ok: false; error: string; yaImportada?: { meetingId: string; nombre: string; fecha: string } };

function no(error: string, status: number, extra?: Partial<RespuestaLeer>) {
  return NextResponse.json({ ok: false, error, ...extra } as RespuestaLeer, { status });
}

export async function POST(req: Request) {
  const supabase = await servirClient();
  const userId = await usuarioActual(supabase);
  if (!userId) return no("Tu sesión expiró. Vuelve a entrar.", 401);
  const { data: puede } = await supabase.rpc("has_permission", { p_permission: "servir.importar" });
  if (puede !== true) return no("No tienes permiso para importar reuniones.", 403);
  if (!importarConfigurado()) return no("Importar desde PDF no está configurado (falta la clave de la API).", 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return no("No llegó el archivo. Intenta de nuevo.", 400);
  }
  const archivo = form.get("pdf");
  if (!(archivo instanceof File) || archivo.size === 0) return no("Elige un PDF.", 400);
  if (archivo.size > MAX_BYTES_PDF) return no("El PDF pesa más de 4 MB.", 413);
  const pdf = Buffer.from(await archivo.arrayBuffer());
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return no("Ese archivo no es un PDF.", 415);

  const sha = createHash("sha256").update(pdf).digest("hex");

  // Mismo archivo ya importado: avisar antes de gastar otra lectura.
  if (form.get("forzar") !== "1") {
    const { data: previa } = await supabase
      .from("meeting_imports")
      .select("meeting_id, meetings(name, meeting_date)")
      .eq("file_sha256", sha)
      .not("meeting_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previa?.meeting_id && previa.meetings) {
      return no("Este PDF ya se importó.", 409, {
        yaImportada: { meetingId: previa.meeting_id, nombre: previa.meetings.name, fecha: previa.meetings.meeting_date },
      });
    }
  }

  const { data: tipos } = await supabase.from("meeting_types").select("name").eq("active", true).order("sort");

  let leido: Awaited<ReturnType<typeof leerPdf>>;
  try {
    leido = await leerPdf(pdf, { tipos: (tipos ?? []).map((t) => t.name), hoy: hoyBogota() });
  } catch (e) {
    if (e instanceof ErrorLectura) return no(e.message, 502);
    console.error("importar pdf:", e);
    return no("No se pudo leer el PDF. Intenta de nuevo.", 500);
  }

  const { data: registro, error } = await supabase
    .from("meeting_imports")
    .insert({
      file_name: archivo.name.slice(0, 200) || "documento.pdf",
      file_sha256: sha,
      model: leido.modelo,
      input_tokens: leido.inputTokens,
      output_tokens: leido.outputTokens,
      extraction: leido.lectura as unknown as Json,
    })
    .select("id")
    .single();
  if (error || !registro) return no(`No se pudo guardar la lectura: ${error?.message ?? "sin respuesta"}`, 500);

  return NextResponse.json({ ok: true, importId: registro.id, lectura: leido.lectura } satisfies RespuestaLeer);
}
