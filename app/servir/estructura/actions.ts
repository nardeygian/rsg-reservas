"use server";

// Estructura de Servir: departamentos, áreas y roles, y quién asigna en
// Planeación. Solo el super admin y el líder del departamento que planea
// (puede_estructura / es_lider_planeacion); RLS lo vuelve a exigir.

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Resultado } from "@/lib/servir/contratos";
import { clienteServir } from "../equipo/_lib/supabase";

function fallo(error: PostgrestError, que: string): { ok: false; error: string } {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return { ok: false, error: `No tienes permiso para ${que}.` };
  }
  if (error.code === "23505") return { ok: false, error: "Ya existe uno con ese nombre." };
  console.error(`[servir/estructura] ${que}:`, error.message);
  return { ok: false, error: `No se pudo ${que}. Intenta de nuevo.` };
}

function nombre(v: string, max = 80): string {
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

function refrescar() {
  revalidatePath("/servir/estructura");
  revalidatePath("/servir/equipo", "layout");
  revalidatePath("/servir/reuniones", "layout");
}

const SIN_CAMBIO = { ok: false as const, error: "No tienes permiso para cambiar la estructura." };

export async function crearDepartamento(texto: string): Promise<Resultado<{ id: string }>> {
  const name = nombre(texto);
  if (!name) return { ok: false, error: "Escribe el nombre del departamento." };
  const db = await clienteServir();
  const { data, error } = await db.from("ministries").insert({ name, type: "departamento" }).select("id").single();
  if (error) return fallo(error, "crear departamentos");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

export async function renombrarDepartamento(id: string, texto: string): Promise<Resultado> {
  const name = nombre(texto);
  if (!name) return { ok: false, error: "Escribe el nombre del departamento." };
  const db = await clienteServir();
  const { data, error } = await db.from("ministries").update({ name }).eq("id", id).eq("type", "departamento").select("id");
  if (error) return fallo(error, "renombrar el departamento");
  if (!data.length) return SIN_CAMBIO;
  refrescar();
  return { ok: true, data: undefined };
}

export async function crearArea(ministryId: string, texto: string): Promise<Resultado<{ id: string }>> {
  const name = nombre(texto);
  if (!name) return { ok: false, error: "Escribe el nombre del área." };
  const db = await clienteServir();
  const { data, error } = await db.from("areas").insert({ ministry_id: ministryId, name }).select("id").single();
  if (error) return fallo(error, "crear áreas");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

export async function renombrarArea(id: string, texto: string): Promise<Resultado> {
  const name = nombre(texto);
  if (!name) return { ok: false, error: "Escribe el nombre del área." };
  const db = await clienteServir();
  const { data, error } = await db.from("areas").update({ name }).eq("id", id).select("id");
  if (error) return fallo(error, "renombrar el área");
  if (!data.length) return SIN_CAMBIO;
  refrescar();
  return { ok: true, data: undefined };
}

// Crea o edita un rol. ministry_id nulo = rol general (con su grupo, p. ej.
// "Escenario"); area_id solo dentro de un departamento.
export async function guardarRol(input: {
  id?: string; name: string; ministry_id: string | null; area_id: string | null; grupo: string | null;
}): Promise<Resultado<{ id: string }>> {
  const name = nombre(input.name);
  if (!name) return { ok: false, error: "Escribe el nombre del rol." };
  const general = !input.ministry_id;
  const fila = {
    name,
    ministry_id: input.ministry_id || null,
    area_id: general ? null : input.area_id || null,
    grupo: general ? nombre(input.grupo ?? "", 60) || null : null,
  };
  const db = await clienteServir();

  if (fila.area_id) {
    const { data: area } = await db.from("areas").select("ministry_id").eq("id", fila.area_id).maybeSingle();
    if (!area || area.ministry_id !== fila.ministry_id) return { ok: false, error: "Esa área no es de ese departamento." };
  }

  if (input.id) {
    const { data, error } = await db.from("positions").update(fila).eq("id", input.id).select("id");
    if (error) return fallo(error, "editar el rol");
    if (!data.length) return SIN_CAMBIO;
    refrescar();
    return { ok: true, data: { id: input.id } };
  }

  const contarQ = db.from("positions").select("id", { count: "exact", head: true });
  const { count } = await (fila.ministry_id ? contarQ.eq("ministry_id", fila.ministry_id) : contarQ.is("ministry_id", null));
  const { data, error } = await db.from("positions").insert({ ...fila, sort: (count ?? 0) + 1 }).select("id").single();
  if (error) return fallo(error, "crear el rol");
  refrescar();
  return { ok: true, data: { id: data.id } };
}

export async function archivarRol(id: string, activo: boolean): Promise<Resultado> {
  const db = await clienteServir();
  const { data, error } = await db.from("positions").update({ active: activo }).eq("id", id).select("id");
  if (error) return fallo(error, "archivar el rol");
  if (!data.length) return SIN_CAMBIO;
  refrescar();
  return { ok: true, data: undefined };
}

// ── Autorizados para asignar en Planeación, VIO y Escenario ─────────────

export async function autorizarPlaneacion(profileId: string): Promise<Resultado> {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  const { error } = await db.from("user_permissions").insert({
    user_id: profileId, permission: "servir.asignar_planeacion", effect: "grant", granted_by: claims?.claims.sub ?? null,
  });
  if (error && error.code !== "23505") return fallo(error, "autorizar a esta persona");
  refrescar();
  return { ok: true, data: undefined };
}

export async function quitarAutorizacionPlaneacion(profileId: string): Promise<Resultado> {
  const db = await clienteServir();
  const { error } = await db.from("user_permissions").delete()
    .eq("user_id", profileId).eq("permission", "servir.asignar_planeacion").eq("effect", "grant");
  if (error) return fallo(error, "quitar la autorización");
  refrescar();
  return { ok: true, data: undefined };
}
