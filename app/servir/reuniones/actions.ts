"use server";

// B1 · Planeación — implementa AccionesPlaneacion (lib/servir/contratos.ts).
// Los avisos a los asignados al reprogramar, cancelar o restaurar los manda
// un trigger de B4 sobre meeting_changes: aquí basta con registrar el cambio.
// Cada acción valida la entrada y deja que RLS decida: crear y editar
// reuniones exige servir.planear en la base. Ninguna usa service_role.

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/database.types";
import type {
  AccionesPlaneacion,
  ItemOrden,
  ItemOrdenPlantilla,
  NuevaReunion,
  Resultado,
  TipoItemOrden,
} from "@/lib/servir/contratos";
import { servirClient, usuarioActual, type ServirClient } from "./_lib/db";
import { esFecha, fechaLarga, instanteBogota, moverAFecha } from "./_lib/fechas";

const KINDS: TipoItemOrden[] = ["cancion", "predica", "oracion", "anuncio", "encabezado", "otro"];
const MAX_SERIE = 60;
const MAX_ITEMS = 80;

const SIN_PERMISO = "No tienes permiso para planear reuniones.";

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// Traduce los errores de la base a algo que la UI pueda mostrar.
function errorBase(e: { code?: string; message: string }): string {
  if (e.code === "42501" || /row-level security/i.test(e.message)) return SIN_PERMISO;
  if (e.code === "23514") return "Algún dato no es válido (revisa horas y duraciones).";
  return `No se pudo guardar: ${e.message}`;
}

async function contexto(): Promise<{ supabase: ServirClient; userId: string } | null> {
  const supabase = await servirClient();
  const userId = await usuarioActual(supabase);
  return userId ? { supabase, userId } : null;
}

async function puedePlanear(supabase: ServirClient): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { p_permission: "servir.planear" });
  return data === true;
}

function revalidar(id?: string) {
  revalidatePath("/servir/reuniones");
  if (id) revalidatePath(`/servir/reuniones/${id}`);
}

// Normaliza un ítem del orden; null si no sirve.
function limpiarItem(raw: ItemOrdenPlantilla): ItemOrdenPlantilla | null {
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 200) : "";
  if (!title) return null;
  const kind = KINDS.includes(raw.kind) ? raw.kind : "otro";
  const dur = Number(raw.duration_sec);
  return {
    kind,
    title,
    duration_sec: Number.isFinite(dur) && dur > 0 ? Math.min(Math.round(dur), 6 * 3600) : 0,
    song_id: raw.song_id || null,
    responsible_position_id: raw.responsible_position_id || null,
  };
}

// run_sheet de una plantilla → filas de run_items.
function itemsDePlantilla(runSheet: Json, meetingId: string) {
  const lista = Array.isArray(runSheet) ? (runSheet as unknown as ItemOrdenPlantilla[]) : [];
  return lista
    .map(limpiarItem)
    .filter((i): i is ItemOrdenPlantilla => i !== null)
    .map((i, sort) => ({ ...i, duration_sec: i.duration_sec ?? 0, meeting_id: meetingId, sort }));
}

// ── Crear ─────────────────────────────────────────────────────────────────

async function crearUna(
  supabase: ServirClient,
  userId: string,
  input: NuevaReunion,
): Promise<Resultado<{ id: string }>> {
  if (!esFecha(input.meeting_date)) return fallo("La fecha no es válida.");

  let tipo: {
    name: string; kind: string; ministry_id: string | null; default_template_id: string | null;
    usual_time: string | null; duration_min: number | null;
  } | null = null;
  if (input.meeting_type_id) {
    const { data } = await supabase
      .from("meeting_types")
      .select("name, kind, ministry_id, default_template_id, usual_time, duration_min")
      .eq("id", input.meeting_type_id)
      .maybeSingle();
    if (!data) return fallo("No encontramos ese tipo de reunión.");
    tipo = data;
  }

  const templateId = input.template_id ?? tipo?.default_template_id ?? null;
  let plantilla: { run_sheet: Json; meeting_type_id: string | null } | null = null;
  if (templateId) {
    const { data } = await supabase
      .from("meeting_templates").select("run_sheet, meeting_type_id").eq("id", templateId).maybeSingle();
    if (!data) return fallo("No encontramos esa plantilla.");
    plantilla = data;
  }

  const name = (input.name ?? "").trim() || tipo?.name || "";
  if (!name) return fallo("Ponle un nombre a la reunión.");

  // Si no llega hora, la del tipo (hora habitual + duración).
  let startsAt = input.starts_at ?? null;
  let endsAt = input.ends_at ?? null;
  if (!startsAt && tipo?.usual_time) startsAt = instanteBogota(input.meeting_date, tipo.usual_time);
  if (startsAt && !endsAt && tipo?.duration_min) {
    endsAt = new Date(new Date(startsAt).getTime() + tipo.duration_min * 60_000).toISOString();
  }
  if (startsAt && endsAt && endsAt <= startsAt) return fallo("La hora de fin debe ser después del inicio.");

  const { data: reunion, error } = await supabase
    .from("meetings")
    .insert({
      name: name.slice(0, 200),
      meeting_date: input.meeting_date,
      starts_at: startsAt,
      ends_at: endsAt,
      meeting_type_id: input.meeting_type_id ?? plantilla?.meeting_type_id ?? null,
      template_id: templateId,
      kind: tipo?.kind ?? "ministerio",
      ministry_id: input.ministry_id ?? tipo?.ministry_id ?? null,
      booking_id: input.booking_id ?? null,
      status: "borrador",
      origin: "manual",
      outside_asana: true,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !reunion) return fallo(error ? errorBase(error) : "No se pudo crear la reunión.");

  if (plantilla) {
    const items = itemsDePlantilla(plantilla.run_sheet, reunion.id);
    if (items.length) {
      const { error: e2 } = await supabase.from("run_items").insert(items);
      if (e2) return fallo(`La reunión se creó, pero no su orden: ${e2.message}`);
    }
  }
  return { ok: true, data: { id: reunion.id } };
}

export async function crearReunion(input: NuevaReunion): Promise<Resultado<{ id: string }>> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  if (!(await puedePlanear(ctx.supabase))) return fallo(SIN_PERMISO);
  const r = await crearUna(ctx.supabase, ctx.userId, input);
  if (r.ok) revalidar();
  return r;
}

export async function crearEnSerie(
  input: Omit<NuevaReunion, "meeting_date">,
  fechas: string[],
): Promise<Resultado<{ ids: string[] }>> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  if (!(await puedePlanear(ctx.supabase))) return fallo(SIN_PERMISO);

  const unicas = [...new Set(fechas)].sort();
  if (unicas.length === 0) return fallo("Elige al menos una fecha.");
  if (unicas.length > MAX_SERIE) return fallo(`Máximo ${MAX_SERIE} reuniones por serie.`);
  if (!unicas.every(esFecha)) return fallo("Alguna fecha no es válida.");

  // Una hora fija llega como instante de la primera fecha: se repite a la
  // misma hora de Bogotá en cada fecha.
  const duracionMs = input.starts_at && input.ends_at
    ? new Date(input.ends_at).getTime() - new Date(input.starts_at).getTime()
    : null;

  const ids: string[] = [];
  for (const fecha of unicas) {
    const startsAt = input.starts_at ? moverAFecha(input.starts_at, fecha) : null;
    const endsAt = startsAt && duracionMs ? new Date(new Date(startsAt).getTime() + duracionMs).toISOString() : null;
    const r = await crearUna(ctx.supabase, ctx.userId, { ...input, meeting_date: fecha, starts_at: startsAt, ends_at: endsAt });
    if (!r.ok) {
      revalidar();
      return fallo(ids.length ? `Se crearon ${ids.length} reuniones; falló la del ${fechaLarga(fecha)}: ${r.error}` : r.error);
    }
    ids.push(r.data.id);
  }
  revalidar();
  return { ok: true, data: { ids } };
}

export async function duplicarReunion(id: string, meeting_date: string): Promise<Resultado<{ id: string }>> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase, userId } = ctx;
  if (!(await puedePlanear(supabase))) return fallo(SIN_PERMISO);
  if (!esFecha(meeting_date)) return fallo("La fecha no es válida.");

  const { data: m } = await supabase
    .from("meetings")
    .select("name, starts_at, ends_at, meeting_type_id, template_id, kind, section, ministry_id, notes")
    .eq("id", id)
    .maybeSingle();
  if (!m) return fallo("No encontramos la reunión.");

  const startsAt = m.starts_at ? moverAFecha(m.starts_at, meeting_date) : null;
  const endsAt = startsAt && m.starts_at && m.ends_at
    ? new Date(new Date(startsAt).getTime() + (new Date(m.ends_at).getTime() - new Date(m.starts_at).getTime())).toISOString()
    : null;

  // La reserva del espacio es de una fecha concreta: no se copia.
  const { data: nueva, error } = await supabase
    .from("meetings")
    .insert({
      name: m.name, meeting_date, starts_at: startsAt, ends_at: endsAt,
      meeting_type_id: m.meeting_type_id, template_id: m.template_id, kind: m.kind,
      section: m.section, ministry_id: m.ministry_id, notes: m.notes,
      status: "borrador", origin: "manual", outside_asana: true, created_by: userId,
    })
    .select("id")
    .single();
  if (error || !nueva) return fallo(error ? errorBase(error) : "No se pudo duplicar.");

  const { data: items } = await supabase
    .from("run_items")
    .select("sort, kind, title, duration_sec, song_id, song_key, notes, responsible_position_id")
    .eq("meeting_id", id)
    .order("sort");
  if (items?.length) {
    const { error: e2 } = await supabase.from("run_items").insert(items.map((i) => ({ ...i, meeting_id: nueva.id })));
    if (e2) return fallo(`La reunión se duplicó, pero no su orden: ${e2.message}`);
  }
  revalidar();
  return { ok: true, data: { id: nueva.id } };
}

// Nueva plantilla con el orden de la reunión. Si ya hay una con ese nombre
// para el mismo tipo, queda como su siguiente versión.
export async function guardarComoPlantilla(meetingId: string, nombre: string): Promise<Resultado<{ id: string }>> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase, userId } = ctx;
  const name = nombre.trim().slice(0, 120);
  if (!name) return fallo("Ponle un nombre a la plantilla.");

  const { data: m } = await supabase
    .from("meetings").select("meeting_type_id, template_id").eq("id", meetingId).maybeSingle();
  if (!m) return fallo("No encontramos la reunión.");

  const { data: items } = await supabase
    .from("run_items")
    .select("kind, title, duration_sec, song_id, responsible_position_id")
    .eq("meeting_id", meetingId)
    .order("sort");

  let anteriores = supabase.from("meeting_templates").select("version, required_positions, checklist_extra").eq("name", name);
  anteriores = m.meeting_type_id ? anteriores.eq("meeting_type_id", m.meeting_type_id) : anteriores.is("meeting_type_id", null);
  const { data: previas } = await anteriores.order("version", { ascending: false }).limit(1);

  // Las posiciones y el checklist extra vienen de la última versión o de la
  // plantilla con que se creó la reunión.
  let base = previas?.[0] ?? null;
  if (!base && m.template_id) {
    const { data } = await supabase
      .from("meeting_templates").select("version, required_positions, checklist_extra").eq("id", m.template_id).maybeSingle();
    base = data ? { ...data, version: 0 } : null;
  }

  const runSheet: ItemOrdenPlantilla[] = (items ?? []).map((i) => ({
    kind: i.kind as TipoItemOrden, title: i.title, duration_sec: i.duration_sec,
    song_id: i.song_id, responsible_position_id: i.responsible_position_id,
  }));

  const { data: t, error } = await supabase
    .from("meeting_templates")
    .insert({
      name,
      meeting_type_id: m.meeting_type_id,
      version: (previas?.[0]?.version ?? 0) + 1,
      created_from_meeting_id: meetingId,
      run_sheet: runSheet as unknown as Json,
      required_positions: base?.required_positions ?? [],
      checklist_extra: base?.checklist_extra ?? [],
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !t) {
    return fallo(error && /row-level security/i.test(error.message)
      ? "No tienes permiso para crear plantillas de este tipo."
      : error ? errorBase(error) : "No se pudo guardar la plantilla.");
  }
  revalidatePath("/servir/plantillas");
  return { ok: true, data: { id: t.id } };
}

// ── Orden ─────────────────────────────────────────────────────────────────

export async function guardarOrden(
  meetingId: string,
  items: (ItemOrdenPlantilla & { id?: string; sort: number })[],
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase } = ctx;
  if (!(await puedePlanear(supabase))) return fallo(SIN_PERMISO);
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return fallo(`El orden admite hasta ${MAX_ITEMS} ítems.`);

  const { data: m } = await supabase.from("meetings").select("status").eq("id", meetingId).maybeSingle();
  if (!m) return fallo("No encontramos la reunión.");
  if (m.status === "cerrada" || m.status === "cancelada") return fallo("Esta reunión ya no se puede editar.");

  const { data: actuales } = await supabase.from("run_items").select("id").eq("meeting_id", meetingId);
  const existentes = new Set((actuales ?? []).map((r) => r.id));

  const ordenados = [...items].sort((a, b) => a.sort - b.sort);
  const actualizar: (Pick<ItemOrden, "id" | "meeting_id" | "sort" | "kind" | "title" | "duration_sec" | "song_id" | "responsible_position_id">)[] = [];
  const insertar: Omit<(typeof actualizar)[number], "id">[] = [];
  let sort = 0;
  for (const raw of ordenados) {
    const limpio = limpiarItem(raw);
    if (!limpio) return fallo("Cada ítem del orden necesita un título.");
    const fila = {
      meeting_id: meetingId, sort: sort++, kind: limpio.kind, title: limpio.title,
      duration_sec: limpio.duration_sec ?? 0, song_id: limpio.song_id ?? null,
      responsible_position_id: limpio.responsible_position_id ?? null,
    };
    if (raw.id && existentes.has(raw.id)) actualizar.push({ id: raw.id, ...fila });
    else insertar.push(fila);
  }
  const quedan = new Set(actualizar.map((i) => i.id));
  const borrar = [...existentes].filter((id) => !quedan.has(id));

  if (borrar.length) {
    const { error } = await supabase.from("run_items").delete().in("id", borrar);
    if (error) return fallo(errorBase(error));
  }
  if (actualizar.length) {
    const { error } = await supabase.from("run_items").upsert(actualizar, { onConflict: "id" });
    if (error) return fallo(errorBase(error));
  }
  if (insertar.length) {
    const { error } = await supabase.from("run_items").insert(insertar);
    if (error) return fallo(errorBase(error));
  }
  revalidar(meetingId);
  return { ok: true, data: undefined };
}

// ── Estado ────────────────────────────────────────────────────────────────

export async function publicarReunion(id: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { data, error } = await ctx.supabase
    .from("meetings").update({ status: "publicada" }).eq("id", id).eq("status", "borrador").select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo(await motivoSinCambio(ctx.supabase, id, "Solo se publican reuniones en borrador."));
  revalidar(id);
  return { ok: true, data: undefined };
}

async function motivoSinCambio(supabase: ServirClient, id: string, porEstado: string): Promise<string> {
  const { data } = await supabase.from("meetings").select("id").eq("id", id).maybeSingle();
  if (!data) return "No encontramos la reunión.";
  return (await puedePlanear(supabase)) ? porEstado : SIN_PERMISO;
}

export async function reprogramarReunion(
  id: string,
  nueva_fecha: string,
  starts_at?: string | null,
  motivo?: string,
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase, userId } = ctx;
  if (!esFecha(nueva_fecha)) return fallo("La fecha no es válida.");
  if (!(await puedePlanear(supabase))) return fallo(SIN_PERMISO);

  const { data: m } = await supabase
    .from("meetings").select("name, status, meeting_date, starts_at, ends_at").eq("id", id).maybeSingle();
  if (!m) return fallo("No encontramos la reunión.");
  if (!["borrador", "publicada"].includes(m.status)) return fallo("Solo se reprograman reuniones en borrador o publicadas.");

  // Sin hora nueva, conserva la hora de Bogotá en la fecha nueva.
  const nuevoInicio = starts_at ?? (m.starts_at ? moverAFecha(m.starts_at, nueva_fecha) : null);
  const nuevoFin = nuevoInicio && m.starts_at && m.ends_at
    ? new Date(new Date(nuevoInicio).getTime() + (new Date(m.ends_at).getTime() - new Date(m.starts_at).getTime())).toISOString()
    : null;
  if (nueva_fecha === m.meeting_date && nuevoInicio === m.starts_at) return fallo("La fecha y la hora son las mismas.");

  const { error } = await supabase
    .from("meetings").update({ meeting_date: nueva_fecha, starts_at: nuevoInicio, ends_at: nuevoFin }).eq("id", id);
  if (error) return fallo(errorBase(error));

  const reason = motivo?.trim().slice(0, 500) || null;
  const { error: e2 } = await supabase.from("meeting_changes").insert({
    meeting_id: id, change: "reprogramada",
    previous_date: m.meeting_date, new_date: nueva_fecha,
    previous_starts_at: m.starts_at, new_starts_at: nuevoInicio,
    reason, actor_id: userId,
  });
  if (e2) return fallo(`Se cambió la fecha, pero no quedó en el historial: ${e2.message}`);

  revalidar(id);
  return { ok: true, data: undefined };
}

export async function cancelarReunion(id: string, motivo?: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase, userId } = ctx;

  const { data: m } = await supabase.from("meetings").select("name, meeting_date").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("meetings").update({ status: "cancelada" }).eq("id", id).in("status", ["borrador", "publicada"]).select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length || !m) return fallo(await motivoSinCambio(supabase, id, "Solo se cancelan reuniones en borrador o publicadas."));

  const reason = motivo?.trim().slice(0, 500) || null;
  const { error: e2 } = await supabase.from("meeting_changes").insert({
    meeting_id: id, change: "cancelada", previous_date: m.meeting_date, reason, actor_id: userId,
  });
  if (e2) return fallo(`Se canceló, pero no quedó en el historial: ${e2.message}`);

  revalidar(id);
  return { ok: true, data: undefined };
}

// Fuera del contrato: deshace una cancelación (vuelve a borrador).
export async function restaurarReunion(id: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase, userId } = ctx;
  const { data, error } = await supabase
    .from("meetings").update({ status: "borrador" }).eq("id", id).eq("status", "cancelada").select("meeting_date");
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo(await motivoSinCambio(supabase, id, "Solo se restauran reuniones canceladas."));
  await supabase.from("meeting_changes").insert({
    meeting_id: id, change: "restaurada", new_date: data[0].meeting_date, actor_id: userId,
  });
  revalidar(id);
  return { ok: true, data: undefined };
}

// Borra la reunión con su orden, equipo asignado e historial (todo en
// cascada). Fuera del contrato. En vivo o cerrada no se borra: ya tiene
// asistencia y cuenta en las estadísticas. RLS exige servir.planear.
export async function eliminarReunion(id: string): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const { supabase } = ctx;
  if (!(await puedePlanear(supabase))) return fallo(SIN_PERMISO);

  const { data, error } = await supabase
    .from("meetings").delete().eq("id", id).in("status", ["borrador", "publicada", "cancelada"]).select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length) {
    return fallo(await motivoSinCambio(supabase, id, "Una reunión en vivo o cerrada no se puede borrar."));
  }
  revalidatePath("/servir/reuniones");
  return { ok: true, data: undefined };
}

// Datos básicos de la reunión (nombre, fecha, hora, notas). Fuera del contrato.
export async function guardarDatosReunion(
  id: string,
  input: { name: string; starts_at: string | null; ends_at: string | null; notes: string | null },
): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return fallo("Tu sesión expiró. Vuelve a entrar.");
  const name = input.name.trim().slice(0, 200);
  if (!name) return fallo("Ponle un nombre a la reunión.");
  if (input.starts_at && input.ends_at && input.ends_at <= input.starts_at) return fallo("La hora de fin debe ser después del inicio.");
  const { data, error } = await ctx.supabase
    .from("meetings")
    .update({ name, starts_at: input.starts_at, ends_at: input.ends_at, notes: input.notes?.trim() || null })
    .eq("id", id)
    .in("status", ["borrador", "publicada"])
    .select("id");
  if (error) return fallo(errorBase(error));
  if (!data?.length) return fallo(await motivoSinCambio(ctx.supabase, id, "Esta reunión ya no se puede editar."));
  revalidar(id);
  return { ok: true, data: undefined };
}

// Las firmas cumplen el contrato del frente.
const _contrato: AccionesPlaneacion = {
  crearReunion, crearEnSerie, duplicarReunion, guardarComoPlantilla,
  guardarOrden, publicarReunion, reprogramarReunion, cancelarReunion,
};
void _contrato;
