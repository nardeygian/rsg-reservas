"use server";

// Acciones del frente B3 (Equipos y asignaciones).
//
// Las seis primeras son las firmas de AccionesEquipo (lib/servir/contratos.ts);
// el resto gestiona "Mi equipo" (miembros, áreas, posiciones y checklists).
// Ninguna usa service_role: todas corren con la sesión del usuario y RLS
// decide si puede (un líder de área solo toca su área, un servidor solo lo
// suyo). Aquí solo se valida la forma de los datos y se traducen los errores.

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { MomentoChecklist, Resultado, SugerenciaAsignacion } from "@/lib/servir/contratos";
import { clienteServir } from "./supabase";
import { bordesDelMes } from "./datos";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MOMENTOS: MomentoChecklist[] = ["antes", "durante", "despues"];

function fallo(error: PostgrestError | { message: string; code?: string }, que: string): { ok: false; error: string } {
  const code = "code" in error ? error.code : undefined;
  if (code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return { ok: false, error: `No tienes permiso para ${que}.` };
  }
  if (code === "23505") return { ok: false, error: "Eso ya existe." };
  console.error(`[servir/equipo] ${que}:`, error.message);
  return { ok: false, error: `No se pudo ${que}. Intenta de nuevo.` };
}

function refrescar() {
  revalidatePath("/servir/equipo", "layout");
  revalidatePath("/servir/mis-servicios");
}

// ── AccionesEquipo ──────────────────────────────────────────────────────

// Quién puede servir en esa posición, del que tiene menos carga al que más.
// Candidatos: miembros activos del equipo de la posición que la saben servir
// (person_positions). Carga del mes desde service_units (mismas reglas de
// conteo de siempre); bloqueos de availability_blocks; y si ya sirve en
// otra posición de la misma reunión.
export async function sugerirServidores(meetingId: string, positionId: string): Promise<Resultado<SugerenciaAsignacion[]>> {
  const db = await clienteServir();

  const [reunion, posicion] = await Promise.all([
    db.from("meetings").select("id, meeting_date").eq("id", meetingId).maybeSingle(),
    db.from("positions").select("id, ministry_id, area_id").eq("id", positionId).maybeSingle(),
  ]);
  if (reunion.error) return fallo(reunion.error, "leer la reunión");
  if (posicion.error) return fallo(posicion.error, "leer la posición");
  if (!reunion.data) return { ok: false, error: "La reunión no existe o no la puedes ver." };
  if (!posicion.data) return { ok: false, error: "La posición no existe." };

  const fecha = reunion.data.meeting_date;
  const pos = posicion.data;

  let miembrosQ = db.from("team_members").select("person_id").eq("ministry_id", pos.ministry_id).eq("active", true);
  if (pos.area_id) miembrosQ = miembrosQ.eq("area_id", pos.area_id);
  const [saben, miembros] = await Promise.all([
    db.from("person_positions").select("person_id").eq("position_id", positionId),
    miembrosQ,
  ]);
  if (saben.error) return fallo(saben.error, "leer quién sabe la posición");
  if (miembros.error) return fallo(miembros.error, "leer el equipo");

  const delEquipo = new Set(miembros.data.map((m) => m.person_id));
  const ids = [...new Set(saben.data.map((s) => s.person_id))].filter((id) => delEquipo.has(id));
  if (ids.length === 0) return { ok: true, data: [] };

  const [desde, hasta] = bordesDelMes(fecha);
  const [personas, unidades, bloqueos, asignadas] = await Promise.all([
    db.from("people").select("id, full_name").in("id", ids).eq("active", true),
    db.from("service_units").select("person_id").in("person_id", ids).gte("meeting_date", desde).lte("meeting_date", hasta),
    db.from("availability_blocks").select("person_id").in("person_id", ids).lte("starts_on", fecha).gte("ends_on", fecha),
    db.from("assignments").select("person_id, position_id").eq("meeting_id", meetingId).in("person_id", ids)
      .in("status", ["pendiente", "aceptada"]),
  ]);
  for (const [r, que] of [[personas, "leer las personas"], [unidades, "leer la carga del mes"], [bloqueos, "leer los bloqueos"], [asignadas, "leer las asignaciones"]] as const) {
    if (r.error) return fallo(r.error, que);
  }

  const carga = new Map<string, number>();
  for (const u of unidades.data ?? []) if (u.person_id) carga.set(u.person_id, (carga.get(u.person_id) ?? 0) + 1);
  const bloqueados = new Set((bloqueos.data ?? []).map((b) => b.person_id));
  // Ya asignado en otra posición; si ya está en esta misma, no se sugiere.
  const enEsta = new Set((asignadas.data ?? []).filter((a) => a.position_id === positionId).map((a) => a.person_id));
  const enOtra = new Set((asignadas.data ?? []).filter((a) => a.position_id !== positionId).map((a) => a.person_id));

  const data: SugerenciaAsignacion[] = (personas.data ?? [])
    .filter((p) => !enEsta.has(p.id))
    .map((p) => ({
      person_id: p.id,
      full_name: p.full_name,
      servicios_mes: carga.get(p.id) ?? 0,
      bloqueado: bloqueados.has(p.id),
      ya_asignado: enOtra.has(p.id),
    }))
    .sort((a, b) =>
      Number(a.bloqueado) - Number(b.bloqueado) ||
      Number(a.ya_asignado) - Number(b.ya_asignado) ||
      a.servicios_mes - b.servicios_mes ||
      a.full_name.localeCompare(b.full_name, "es"));

  return { ok: true, data };
}

// Crea la asignación (pendiente). Si la persona ya tuvo esa posición en la
// reunión y fue rechazada o cancelada, se reabre.
export async function asignar(meetingId: string, personId: string, positionId: string): Promise<Resultado<{ id: string }>> {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };

  const previa = await db.from("assignments").select("id, status")
    .eq("meeting_id", meetingId).eq("person_id", personId).eq("position_id", positionId).maybeSingle();
  if (previa.error) return fallo(previa.error, "asignar");

  if (previa.data) {
    if (previa.data.status === "pendiente" || previa.data.status === "aceptada") {
      return { ok: false, error: "Esa persona ya está asignada en esa posición." };
    }
    const { data, error } = await db.from("assignments")
      .update({ status: "pendiente", responded_at: null, decline_reason: null, assigned_by: uid })
      .eq("id", previa.data.id).select("id").maybeSingle();
    if (error) return fallo(error, "asignar en este departamento");
    if (!data) return { ok: false, error: "No tienes permiso para asignar en este departamento." };
    refrescar();
    return { ok: true, data: { id: data.id } };
  }

  // ministry_id / area_id los pone el trigger desde la posición; se mandan
  // solo para cumplir el tipo.
  const pos = await db.from("positions").select("ministry_id, area_id").eq("id", positionId).maybeSingle();
  if (pos.error) return fallo(pos.error, "asignar");
  if (!pos.data) return { ok: false, error: "La posición no existe." };

  const { data, error } = await db.from("assignments")
    .insert({ meeting_id: meetingId, person_id: personId, position_id: positionId, ministry_id: pos.data.ministry_id, area_id: pos.data.area_id, assigned_by: uid })
    .select("id").single();
  if (error) return fallo(error, "asignar en este departamento");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

export async function cancelarAsignacion(id: string): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("assignments").update({ status: "cancelada" }).eq("id", id).select("id").maybeSingle();
  if (error) return fallo(error, "quitar esta asignación");
  if (!data) return { ok: false, error: "No tienes permiso para quitar esta asignación." };
  refrescar();
  return { ok: true, data: undefined };
}

export async function responderAsignacion(id: string, aceptar: boolean, motivo?: string): Promise<Resultado> {
  const db = await clienteServir();
  const { error } = await db.rpc("respond_assignment", {
    p_assignment_id: id,
    p_accept: aceptar,
    p_reason: aceptar ? undefined : motivo?.slice(0, 300),
  });
  if (error) return fallo(error, "responder esta asignación");
  refrescar();
  return { ok: true, data: undefined };
}

export async function marcarChecklist(itemId: string, hecho: boolean): Promise<Resultado> {
  const db = await clienteServir();
  const { error } = await db.rpc("toggle_checklist_item", { p_item_id: itemId, p_done: hecho });
  if (error) return fallo(error, "marcar este punto");
  revalidatePath("/servir/mis-servicios");
  return { ok: true, data: undefined };
}

// Bloqueo propio (fechas en que no puedo servir).
export async function guardarBloqueo(input: { starts_on: string; ends_on: string; reason?: string }): Promise<Resultado<{ id: string }>> {
  if (!FECHA.test(input.starts_on) || !FECHA.test(input.ends_on)) return { ok: false, error: "Elige las fechas." };
  if (input.ends_on < input.starts_on) return { ok: false, error: "La fecha final no puede ser antes de la inicial." };

  const db = await clienteServir();
  const [{ data: personId, error: e1 }, { data: claims }] = await Promise.all([db.rpc("current_person_id"), db.auth.getClaims()]);
  if (e1) return fallo(e1, "guardar el bloqueo");
  if (!personId) return { ok: false, error: "Tu cuenta aún no está unida a una persona del directorio. Pídele a tu líder que te invite." };

  const { data, error } = await db.from("availability_blocks")
    .insert({ person_id: personId, starts_on: input.starts_on, ends_on: input.ends_on, reason: input.reason?.trim().slice(0, 200) || null, created_by: claims?.claims.sub ?? null })
    .select("id").single();
  if (error) return fallo(error, "guardar el bloqueo");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

// ── Complementos de bloqueos ────────────────────────────────────────────

export async function borrarBloqueo(id: string): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("availability_blocks").delete().eq("id", id).select("id");
  if (error) return fallo(error, "borrar el bloqueo");
  if (!data.length) return { ok: false, error: "No tienes permiso para borrar este bloqueo." };
  refrescar();
  return { ok: true, data: undefined };
}

// ── Mi equipo: miembros ─────────────────────────────────────────────────

// Agrega una persona (existente o nueva) al equipo de un departamento/área.
export async function agregarMiembro(input: { ministry_id: string; area_id: string | null; person_id?: string; full_name?: string }): Promise<Resultado<{ person_id: string }>> {
  const db = await clienteServir();
  let personId = input.person_id ?? null;

  if (!personId) {
    const nombre = input.full_name?.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!nombre) return { ok: false, error: "Escribe el nombre." };
    const { data, error } = await db.from("people").insert({ full_name: nombre }).select("id").single();
    if (error) return fallo(error, "crear la persona");
    personId = data.id;
  }

  let q = db.from("team_members").select("id, active").eq("person_id", personId).eq("ministry_id", input.ministry_id);
  q = input.area_id ? q.eq("area_id", input.area_id) : q.is("area_id", null);
  const previa = await q.maybeSingle();
  if (previa.error) return fallo(previa.error, "agregar al equipo");

  if (previa.data) {
    if (previa.data.active) return { ok: false, error: "Ya está en el equipo." };
    const { error } = await db.from("team_members").update({ active: true }).eq("id", previa.data.id);
    if (error) return fallo(error, "agregar al equipo");
  } else {
    const { error } = await db.from("team_members").insert({ person_id: personId, ministry_id: input.ministry_id, area_id: input.area_id });
    if (error) return fallo(error, "agregar a este equipo");
  }
  refrescar();
  return { ok: true, data: { person_id: personId } };
}

// Cambia el área de un miembro (null = sin área).
export async function moverMiembro(teamMemberId: string, areaId: string | null): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("team_members").update({ area_id: areaId }).eq("id", teamMemberId).select("id");
  if (error) return fallo(error, "mover a esta área");
  if (!data.length) return { ok: false, error: "No tienes permiso para mover a esta persona." };
  refrescar();
  return { ok: true, data: undefined };
}

// Saca a alguien del equipo sin borrar su historial (active = false).
export async function quitarMiembro(teamMemberId: string): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("team_members").update({ active: false }).eq("id", teamMemberId).select("id");
  if (error) return fallo(error, "quitar del equipo");
  if (!data.length) return { ok: false, error: "No tienes permiso para quitar a esta persona." };
  refrescar();
  return { ok: true, data: undefined };
}

// Marca o desmarca una posición que la persona sabe servir.
export async function cambiarPosicionPersona(personId: string, positionId: string, sabe: boolean): Promise<Resultado> {
  const db = await clienteServir();
  const { error } = sabe
    ? await db.from("person_positions").upsert({ person_id: personId, position_id: positionId }, { ignoreDuplicates: true })
    : await db.from("person_positions").delete().eq("person_id", personId).eq("position_id", positionId);
  if (error) return fallo(error, "cambiar las posiciones");
  refrescar();
  return { ok: true, data: undefined };
}

// ── Mi equipo: áreas, posiciones y checklists ───────────────────────────

export async function crearArea(ministryId: string, nombre: string): Promise<Resultado<{ id: string }>> {
  const name = nombre.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Escribe el nombre del área." };
  const db = await clienteServir();
  const { data, error } = await db.from("areas").insert({ ministry_id: ministryId, name }).select("id").single();
  if (error) return fallo(error, "crear áreas en este departamento");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

export async function guardarPosicion(input: { id?: string; ministry_id: string; area_id: string | null; name: string; description?: string | null }): Promise<Resultado<{ id: string }>> {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Escribe el nombre de la posición." };
  const fila = { ministry_id: input.ministry_id, area_id: input.area_id, name, description: input.description?.trim() || null };
  const db = await clienteServir();

  if (input.id) {
    const { data, error } = await db.from("positions").update(fila).eq("id", input.id).select("id");
    if (error) return fallo(error, "editar esta posición");
    if (!data.length) return { ok: false, error: "No tienes permiso para editar esta posición." };
    refrescar();
    return { ok: true, data: { id: input.id } };
  }

  const { count } = await db.from("positions").select("id", { count: "exact", head: true }).eq("ministry_id", input.ministry_id);
  const { data, error } = await db.from("positions").insert({ ...fila, sort: (count ?? 0) + 1 }).select("id").single();
  if (error) return fallo(error, "crear posiciones aquí");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

// Activa o archiva una posición (no se borra: puede tener asignaciones).
export async function archivarPosicion(id: string, activa: boolean): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("positions").update({ active: activa }).eq("id", id).select("id");
  if (error) return fallo(error, "archivar esta posición");
  if (!data.length) return { ok: false, error: "No tienes permiso para archivar esta posición." };
  refrescar();
  return { ok: true, data: undefined };
}

export async function agregarPuntoChecklist(positionId: string, moment: MomentoChecklist, texto: string): Promise<Resultado<{ id: string }>> {
  const text = texto.trim().slice(0, 200);
  if (!text) return { ok: false, error: "Escribe el punto." };
  if (!MOMENTOS.includes(moment)) return { ok: false, error: "Momento no válido." };
  const db = await clienteServir();
  const { count } = await db.from("checklist_templates").select("id", { count: "exact", head: true }).eq("position_id", positionId);
  const { data, error } = await db.from("checklist_templates")
    .insert({ position_id: positionId, moment, text, sort: (count ?? 0) + 1 }).select("id").single();
  if (error) return fallo(error, "editar el checklist de esta posición");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

export async function borrarPuntoChecklist(id: string): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("checklist_templates").delete().eq("id", id).select("id");
  if (error) return fallo(error, "editar el checklist de esta posición");
  if (!data.length) return { ok: false, error: "No tienes permiso para editar este checklist." };
  refrescar();
  return { ok: true, data: undefined };
}
