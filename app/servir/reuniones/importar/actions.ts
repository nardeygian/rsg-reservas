"use server";

// Importar reunión desde PDF · paso 2: confirmar lo revisado.
// Crea la reunión en borrador (origin 'pdf'), las canciones que falten y el
// orden, con la sesión de quien importa: RLS exige servir.planear para la
// reunión y el orden, y canciones.editar para crear canciones. Si algo falla
// después de crear la reunión, se borra para no dejarla a medias.

import { revalidatePath } from "next/cache";
import type { Resultado, TipoItemOrden } from "@/lib/servir/contratos";
import { servirClient, usuarioActual, type ServirClient } from "../_lib/db";
import { esFecha, esHora, instanteBogota } from "../_lib/fechas";
import { normalizar, type DecisionCancion } from "./_lib/revision";

const KINDS: TipoItemOrden[] = ["cancion", "predica", "oracion", "anuncio", "encabezado", "otro"];
const MAX_ITEMS = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConfirmarImportacion = {
  importId: string;
  meeting_type_id: string | null;
  name: string;
  meeting_date: string;          // YYYY-MM-DD
  hora: string | null;           // HH:MM, hora local de la organización
  duracion_min: number | null;
  notes: string | null;
  items: {
    kind: TipoItemOrden;
    title: string;
    duration_sec: number;
    song_key: string | null;
    notes: string | null;
    cancion: { titulo: string; decision: DecisionCancion } | null;
  }[];
};

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

async function tiene(supabase: ServirClient, permiso: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { p_permission: permiso });
  return data === true;
}

export async function confirmarImportacion(input: ConfirmarImportacion): Promise<Resultado<{ id: string }>> {
  const supabase = await servirClient();
  const userId = await usuarioActual(supabase);
  if (!userId) return fallo("Tu sesión expiró. Vuelve a entrar.");
  if (!(await tiene(supabase, "servir.importar")) || !(await tiene(supabase, "servir.planear"))) {
    return fallo("No tienes permiso para importar reuniones.");
  }

  if (!UUID.test(input.importId)) return fallo("La lectura no es válida. Sube el PDF otra vez.");
  const { data: registro } = await supabase
    .from("meeting_imports").select("id, meeting_id").eq("id", input.importId).maybeSingle();
  if (!registro) return fallo("No encontramos esa lectura. Sube el PDF otra vez.");
  if (registro.meeting_id) return fallo("Esta lectura ya se convirtió en una reunión.");

  const name = texto(input.name, 200);
  if (!name) return fallo("Ponle un nombre a la reunión.");
  if (!esFecha(input.meeting_date)) return fallo("La fecha no es válida.");
  if (input.hora && !esHora(input.hora)) return fallo("La hora no es válida.");
  const durMin = input.duracion_min == null ? null : Math.round(Number(input.duracion_min));
  if (durMin !== null && !(durMin > 0 && durMin <= 1440)) return fallo("La duración debe estar entre 1 y 1440 minutos.");

  let tipo: { kind: string; ministry_id: string | null; usual_time: string | null; duration_min: number | null } | null = null;
  if (input.meeting_type_id) {
    const { data } = await supabase
      .from("meeting_types").select("kind, ministry_id, usual_time, duration_min").eq("id", input.meeting_type_id).maybeSingle();
    if (!data) return fallo("No encontramos ese tipo de reunión.");
    tipo = data;
  }

  const items = (Array.isArray(input.items) ? input.items : []).slice(0, MAX_ITEMS + 1);
  if (items.length > MAX_ITEMS) return fallo(`El orden no puede pasar de ${MAX_ITEMS} renglones.`);
  const limpios = items.flatMap((i) => {
    const title = texto(i.title, 200);
    if (!title) return [];
    const dur = Number(i.duration_sec);
    return [{
      kind: KINDS.includes(i.kind) ? i.kind : "otro" as TipoItemOrden,
      title,
      duration_sec: Number.isFinite(dur) && dur > 0 ? Math.min(Math.round(dur), 6 * 3600) : 0,
      song_key: texto(i.song_key, 12),
      notes: texto(i.notes, 500),
      cancion: i.cancion && texto(i.cancion.titulo, 200) ? { titulo: texto(i.cancion.titulo, 200)!, decision: i.cancion.decision } : null,
    }];
  });

  // Canciones: las enlazadas deben existir; las nuevas se crean una vez por
  // título, y si ya hay una con ese título en el catálogo se enlaza esa.
  const enlazadas = [...new Set(limpios.flatMap((i) =>
    i.cancion?.decision.modo === "enlazar" ? [i.cancion.decision.songId] : []))];
  if (enlazadas.some((id) => !UUID.test(id))) return fallo("Alguna canción enlazada no es válida.");
  const { data: catalogo } = await supabase.from("songs").select("id, title");
  const porId = new Set((catalogo ?? []).map((c) => c.id));
  if (enlazadas.some((id) => !porId.has(id))) return fallo("Alguna canción enlazada ya no existe. Revisa las canciones.");
  const porTitulo = new Map((catalogo ?? []).map((c) => [normalizar(c.title), c.id]));

  const aCrear = new Map<string, { title: string; default_key: string | null }>();
  for (const i of limpios) {
    if (i.cancion?.decision.modo !== "crear") continue;
    const n = normalizar(i.cancion.titulo);
    if (n && !porTitulo.has(n) && !aCrear.has(n)) aCrear.set(n, { title: i.cancion.titulo, default_key: i.song_key });
  }
  if (aCrear.size && !(await tiene(supabase, "canciones.editar"))) {
    return fallo("No tienes permiso para crear canciones. Enlaza cada canción nueva a una del catálogo u omítela.");
  }

  let startsAt = input.hora ? instanteBogota(input.meeting_date, input.hora) : null;
  if (!startsAt && tipo?.usual_time) startsAt = instanteBogota(input.meeting_date, tipo.usual_time);
  const minutos = durMin ?? tipo?.duration_min ?? null;
  const endsAt = startsAt && minutos ? new Date(new Date(startsAt).getTime() + minutos * 60_000).toISOString() : null;

  const { data: reunion, error } = await supabase
    .from("meetings")
    .insert({
      name,
      meeting_date: input.meeting_date,
      starts_at: startsAt,
      ends_at: endsAt,
      meeting_type_id: input.meeting_type_id,
      kind: tipo?.kind ?? "ministerio",
      ministry_id: tipo?.ministry_id ?? null,
      status: "borrador",
      origin: "pdf",
      outside_asana: true,
      notes: texto(input.notes, 5000),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !reunion) return fallo(`No se pudo crear la reunión: ${error?.message ?? "sin respuesta"}`);

  const deshacer = async (mensaje: string) => {
    await supabase.from("meetings").delete().eq("id", reunion.id);
    return fallo(mensaje);
  };

  if (aCrear.size) {
    const { data: nuevas, error: e2 } = await supabase
      .from("songs")
      .insert([...aCrear.values()].map((c) => ({ ...c, created_by: userId })))
      .select("id, title");
    if (e2 || !nuevas) return deshacer(`No se pudieron crear las canciones: ${e2?.message ?? "sin respuesta"}`);
    for (const c of nuevas) porTitulo.set(normalizar(c.title), c.id);
  }

  const filas = limpios.map((i, sort) => {
    const d = i.cancion?.decision;
    const songId = d?.modo === "enlazar" ? d.songId
      : d?.modo === "crear" ? porTitulo.get(normalizar(i.cancion!.titulo)) ?? null
      : null;
    return {
      meeting_id: reunion.id,
      sort,
      kind: i.kind,
      title: i.title,
      duration_sec: i.duration_sec,
      song_id: songId,
      song_key: i.song_key,
      notes: i.notes,
    };
  });
  if (filas.length) {
    const { error: e3 } = await supabase.from("run_items").insert(filas);
    if (e3) return deshacer(`No se pudo guardar el orden: ${e3.message}`);
  }

  await supabase.from("meeting_imports").update({ meeting_id: reunion.id }).eq("id", input.importId);

  revalidatePath("/servir/reuniones");
  if (aCrear.size) revalidatePath("/servir/canciones");
  return { ok: true, data: { id: reunion.id } };
}
