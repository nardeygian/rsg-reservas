"use server";

// B1 · Tipos de reunión y plantillas. RLS decide quién escribe: Planeación
// todos; un pastor de ministerio, los tipos de su ministerio.

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import type { ClaseReunion, Conteo, ItemOrdenPlantilla, Resultado, TipoItemOrden } from "@/lib/servir/contratos";
import { servirClient, usuarioActual } from "../reuniones/_lib/db";
import { esHora } from "../reuniones/_lib/fechas";

const KINDS: TipoItemOrden[] = ["cancion", "predica", "oracion", "anuncio", "encabezado", "otro"];
const CLASES: ClaseReunion[] = ["ministerio", "servolucion", "evento"];
const CONTEOS: Conteo[] = ["min", "serv"];

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function errorBase(e: { code?: string; message: string; hint?: string | null }): string {
  if (e.message.includes("sin_permiso_montaje")) return MONTAJE_SIN_PERMISO;
  if (e.code === "42501" || /row-level security/i.test(e.message)) return "No tienes permiso para editar tipos y plantillas de este ministerio.";
  if (e.code === "23505") return "Ya existe un tipo con ese nombre.";
  if (e.code === "23514") return "Algún dato no es válido.";
  return `No se pudo guardar: ${e.message}`;
}

function revalidar() {
  revalidatePath("/servir/plantillas");
  revalidatePath("/servir/reuniones/nueva");
}

function limpiarOrden(items: ItemOrdenPlantilla[]): ItemOrdenPlantilla[] | null {
  if (!Array.isArray(items) || items.length > 80) return null;
  const out: ItemOrdenPlantilla[] = [];
  for (const i of items) {
    const title = typeof i.title === "string" ? i.title.trim().slice(0, 200) : "";
    if (!title) return null;
    const d = Number(i.duration_sec);
    out.push({
      kind: KINDS.includes(i.kind) ? i.kind : "otro",
      title,
      duration_sec: Number.isFinite(d) && d > 0 ? Math.min(Math.round(d), 6 * 3600) : 0,
      song_id: i.song_id || null,
      responsible_position_id: i.responsible_position_id || null,
    });
  }
  return out;
}

export type DatosTipo = {
  id?: string;
  name: string;
  ministry_id: string | null;
  counting: Conteo;
  kind: ClaseReunion;
  color: string | null;
  usual_weekday: number | null;
  usual_time: string | null;      // HH:mm (Bogotá)
  duration_min: number | null;
  usual_space_ids: string[];
  setup_minutes: number;          // montaje antes, en minutos
  teardown_minutes: number;       // desmonte después
  default_template_id: string | null;
  active: boolean;
};

const UUID = /^[0-9a-f-]{36}$/i;
const minutosValidos = (n: number) => Number.isInteger(n) && n >= 0 && n <= 720;
const MONTAJE_SIN_PERMISO = "Solo Planeación, un pastor de sede o un super admin cambian espacios, montaje y desmonte.";

export async function guardarTipo(input: DatosTipo): Promise<Resultado<{ id: string }>> {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) return fallo("Tu sesión expiró. Vuelve a entrar.");

  const name = input.name.trim().slice(0, 120);
  if (!name) return fallo("Ponle un nombre al tipo.");
  if (!CONTEOS.includes(input.counting) || !CLASES.includes(input.kind)) return fallo("Conteo o clase no válidos.");
  if (input.usual_weekday != null && !(input.usual_weekday >= 0 && input.usual_weekday <= 6)) return fallo("Día no válido.");
  if (input.usual_time && !esHora(input.usual_time)) return fallo("Hora no válida.");
  if (input.duration_min != null && !(input.duration_min > 0 && input.duration_min <= 24 * 60)) return fallo("Duración no válida.");
  if (input.color && !/^#[0-9a-fA-F]{6}$/.test(input.color)) return fallo("Color no válido.");
  if (!minutosValidos(input.setup_minutes) || !minutosValidos(input.teardown_minutes)) return fallo("Montaje y desmonte van de 0 a 12 horas.");
  const espacios = [...new Set(input.usual_space_ids.filter((x) => UUID.test(x)))].slice(0, 20);

  const fila = {
    name,
    ministry_id: input.ministry_id || null,
    counting: input.counting,
    kind: input.kind,
    color: input.color || null,
    usual_weekday: input.usual_weekday,
    usual_time: input.usual_time || null,
    duration_min: input.duration_min,
    usual_space_ids: espacios,
    usual_space_id: espacios[0] ?? null,
    setup_minutes: input.setup_minutes,
    teardown_minutes: input.teardown_minutes,
    default_template_id: input.default_template_id || null,
    active: input.active,
  };

  const q = input.id
    ? supabase.from("meeting_types").update(fila).eq("id", input.id).select("id")
    : supabase.from("meeting_types").insert(fila).select("id");
  const { data, error } = await q;
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo("No tienes permiso para editar este tipo.");
  revalidar();
  return { ok: true, data: { id: data[0].id } };
}

// Crea una plantilla vacía (o con orden) para un tipo.
export async function crearPlantilla(input: {
  meeting_type_id: string | null;
  name: string;
  run_sheet?: ItemOrdenPlantilla[];
}): Promise<Resultado<{ id: string }>> {
  const supabase = await servirClient();
  const userId = await usuarioActual(supabase);
  if (!userId) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const name = input.name.trim().slice(0, 120);
  if (!name) return fallo("Ponle un nombre a la plantilla.");
  const orden = limpiarOrden(input.run_sheet ?? []);
  if (!orden) return fallo("Cada ítem del orden necesita un título.");

  let previas = supabase.from("meeting_templates").select("version").eq("name", name);
  previas = input.meeting_type_id ? previas.eq("meeting_type_id", input.meeting_type_id) : previas.is("meeting_type_id", null);
  const { data: ult } = await previas.order("version", { ascending: false }).limit(1);

  const { data, error } = await supabase
    .from("meeting_templates")
    .insert({
      name, meeting_type_id: input.meeting_type_id || null,
      version: (ult?.[0]?.version ?? 0) + 1,
      run_sheet: orden as unknown as Json, created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return fallo(error ? errorBase(error) : "No se pudo crear la plantilla.");
  revalidar();
  return { ok: true, data: { id: data.id } };
}

// Guarda el orden de una plantilla. Con nuevaVersion, deja la actual intacta
// y crea la siguiente versión (y la pone por defecto si la anterior lo era).
// Las reuniones ya creadas nunca cambian: copiaron su orden al crearse.
export async function guardarPlantilla(
  id: string,
  input: { name: string; run_sheet: ItemOrdenPlantilla[]; nuevaVersion: boolean },
): Promise<Resultado<{ id: string }>> {
  const supabase = await servirClient();
  const userId = await usuarioActual(supabase);
  if (!userId) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const name = input.name.trim().slice(0, 120);
  if (!name) return fallo("Ponle un nombre a la plantilla.");
  const orden = limpiarOrden(input.run_sheet);
  if (!orden) return fallo("Cada ítem del orden necesita un título.");

  const { data: t } = await supabase
    .from("meeting_templates")
    .select("meeting_type_id, required_positions, checklist_extra, created_from_meeting_id, space_ids, setup_minutes, teardown_minutes")
    .eq("id", id)
    .maybeSingle();
  if (!t) return fallo("No encontramos la plantilla.");

  if (!input.nuevaVersion) {
    const { data, error } = await supabase
      .from("meeting_templates").update({ name, run_sheet: orden as unknown as Json }).eq("id", id).select("id");
    if (error) return fallo(errorBase(error));
    if (!data?.length) return fallo("No tienes permiso para editar esta plantilla.");
    revalidar();
    return { ok: true, data: { id } };
  }

  let previas = supabase.from("meeting_templates").select("version").eq("name", name);
  previas = t.meeting_type_id ? previas.eq("meeting_type_id", t.meeting_type_id) : previas.is("meeting_type_id", null);
  const { data: ult } = await previas.order("version", { ascending: false }).limit(1);

  const { data: nueva, error } = await supabase
    .from("meeting_templates")
    .insert({
      name, meeting_type_id: t.meeting_type_id, version: (ult?.[0]?.version ?? 0) + 1,
      run_sheet: orden as unknown as Json, required_positions: t.required_positions,
      checklist_extra: t.checklist_extra, created_from_meeting_id: t.created_from_meeting_id,
      space_ids: t.space_ids, setup_minutes: t.setup_minutes, teardown_minutes: t.teardown_minutes,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !nueva) return fallo(error ? errorBase(error) : "No se pudo crear la versión.");

  if (t.meeting_type_id) {
    await supabase.from("meeting_types").update({ default_template_id: nueva.id })
      .eq("id", t.meeting_type_id).eq("default_template_id", id);
  }
  revalidar();
  return { ok: true, data: { id: nueva.id } };
}

export async function usarPorDefecto(typeId: string, templateId: string | null): Promise<Resultado> {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { data, error } = await supabase
    .from("meeting_types").update({ default_template_id: templateId }).eq("id", typeId).select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo("No tienes permiso para editar este tipo.");
  revalidar();
  return { ok: true, data: undefined };
}

// Las reuniones creadas con ella quedan igual (template_id pasa a null).
export async function borrarPlantilla(id: string): Promise<Resultado> {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { data, error } = await supabase.from("meeting_templates").delete().eq("id", id).select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo("No tienes permiso para borrar esta plantilla.");
  revalidar();
  return { ok: true, data: undefined };
}

// Espacios, montaje y desmonte de una plantilla (null = los del tipo). Se
// guardan en la misma versión: no cambian el orden. Solo servir.planear
// global; la base lo vuelve a revisar.
export async function guardarEspaciosPlantilla(
  id: string,
  valor: { space_ids: string[]; setup_minutes: number; teardown_minutes: number } | null,
): Promise<Resultado> {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) return fallo("Tu sesión expiró. Vuelve a entrar.");
  if (!UUID.test(id)) return fallo("No encontramos la plantilla.");
  if (valor && (!minutosValidos(valor.setup_minutes) || !minutosValidos(valor.teardown_minutes))) {
    return fallo("Montaje y desmonte van de 0 a 12 horas.");
  }
  const { data: puede } = await supabase.rpc("has_global_permission", { p_permission: "servir.planear" });
  if (!puede) return fallo(MONTAJE_SIN_PERMISO);
  const { data, error } = await supabase.from("meeting_templates").update(valor
    ? { space_ids: [...new Set(valor.space_ids.filter((x) => UUID.test(x)))].slice(0, 20), setup_minutes: valor.setup_minutes, teardown_minutes: valor.teardown_minutes }
    : { space_ids: null, setup_minutes: null, teardown_minutes: null }).eq("id", id).select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo("No tienes permiso para editar esta plantilla.");
  revalidar();
  revalidatePath(`/servir/plantillas/${id}`);
  return { ok: true, data: undefined };
}
