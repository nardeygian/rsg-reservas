"use server";

// C1 · En vivo y asistencia — implementa AccionesVivo (lib/servir/contratos.ts).
// Todo pasa por funciones de la base con la sesión del usuario: ellas
// revisan servir.vivo, servir.asistencia o el liderazgo del departamento.

import { revalidatePath } from "next/cache";
import type { AccionesVivo, EstadoAsistencia, Resultado } from "@/lib/servir/contratos";
import { createClient } from "@/lib/supabase/server";

const MENSAJES: Record<string, string> = {
  sin_sesion: "Inicia sesión para continuar.",
  sin_permiso: "No tienes permiso para hacer esto.",
  no_encontrada: "La reunión no existe o no la puedes ver.",
  estado_invalido: "La reunión no está en un estado que lo permita.",
  item_invalido: "Ese punto no es de esta reunión.",
  estado_asistencia_invalido: "Escoge asistió, tarde o ausente.",
  minutos_invalidos: "Escribe entre 1 y 240 minutos.",
  item_quitado: "Ese punto está quitado. Devuélvelo primero.",
  motivo_requerido: "Escoge el motivo del ajuste.",
  texto_requerido: "Escribe el aviso.",
  cancion_invalida: "Esa canción no está en el catálogo.",
};

// Motivos de un ajuste de tiempo (iguales al check de la base).
export type CategoriaMotivo = "alabanza" | "predica" | "tecnica" | "llegada" | "logistica" | "otro";
const CATEGORIAS: CategoriaMotivo[] = ["alabanza", "predica", "tecnica", "llegada", "logistica", "otro"];
export type Motivo = { categoria: CategoriaMotivo; nota?: string };

const UUID = /^[0-9a-f-]{36}$/i;
const ESTADOS: EstadoAsistencia[] = ["asistio", "tarde", "ausente"];

function fallo(error: { message: string; hint?: string }): { ok: false; error: string } {
  const clave = Object.keys(MENSAJES).find((k) => error.message.includes(k));
  if (!clave) console.error("[servir/vivo]", error.message);
  return { ok: false, error: error.hint ?? (clave ? MENSAJES[clave] : "No se pudo completar. Intenta de nuevo.") };
}

function refrescar(id: string) {
  revalidatePath(`/servir/${id}/vivo`);
  revalidatePath(`/servir/reuniones/${id}`);
  revalidatePath("/servir/reuniones");
  revalidatePath("/");
}

export const iniciarReunion: AccionesVivo["iniciarReunion"] = async (id) => {
  if (!UUID.test(id)) return { ok: false, error: MENSAJES.no_encontrada };
  const db = await createClient();
  const { error } = await db.rpc("iniciar_reunion", { p_meeting_id: id });
  if (error) return fallo(error);
  refrescar(id);
  return { ok: true, data: undefined };
};

export const avanzarItem: AccionesVivo["avanzarItem"] = async (meetingId, itemId) => {
  if (!UUID.test(meetingId) || (itemId !== null && !UUID.test(itemId))) return { ok: false, error: MENSAJES.item_invalido };
  const db = await createClient();
  // El RPC acepta null (ningún ítem actual); los tipos generados no lo dicen.
  const { error } = await db.rpc("avanzar_item", { p_meeting_id: meetingId, p_item_id: itemId as string });
  if (error) return fallo(error);
  refrescar(meetingId);
  return { ok: true, data: undefined };
};

export const terminarReunion: AccionesVivo["terminarReunion"] = async (id) => {
  if (!UUID.test(id)) return { ok: false, error: MENSAJES.no_encontrada };
  const db = await createClient();
  const { error } = await db.rpc("terminar_reunion", { p_meeting_id: id });
  if (error) return fallo(error);
  refrescar(id);
  return { ok: true, data: undefined };
};

export const confirmarAsistencia: AccionesVivo["confirmarAsistencia"] = async (meetingId, filas, opciones) => {
  if (!UUID.test(meetingId)) return { ok: false, error: MENSAJES.no_encontrada };
  const limpias = filas
    .filter((f) => UUID.test(f.person_id))
    .map((f) => ({
      person_id: f.person_id,
      status: f.status,
      roles: f.roles.map((r) => r.slice(0, 80)).slice(0, 10),
      note: f.note?.slice(0, 300),
    }));
  if (limpias.some((f) => !ESTADOS.includes(f.status))) return { ok: false, error: MENSAJES.estado_asistencia_invalido };

  const db = await createClient();
  const { error } = await db.rpc("confirmar_asistencia", {
    p_meeting_id: meetingId,
    p_filas: limpias,
    p_cerrar: opciones?.cerrar ?? false,
  });
  if (error) return fallo(error);
  refrescar(meetingId);
  revalidatePath("/servicio");
  return { ok: true, data: undefined } satisfies Resultado;
};

// ── Ajustes en vivo ─────────────────────────────────────────────────────
// Cada uno queda en meeting_live_changes y avisa a los asignados (la base
// lo hace todo en la misma transacción).

function minutosValidos(min: number): boolean {
  return Number.isInteger(min) && min !== 0 && Math.abs(min) <= 240;
}

export async function atrasarReunion(meetingId: string, minutos: number, motivo: Motivo): Promise<Resultado> {
  if (!UUID.test(meetingId)) return { ok: false, error: MENSAJES.no_encontrada };
  if (!minutosValidos(minutos)) return { ok: false, error: MENSAJES.minutos_invalidos };
  if (!CATEGORIAS.includes(motivo?.categoria)) return { ok: false, error: MENSAJES.motivo_requerido };
  const db = await createClient();
  const { error } = await db.rpc("atrasar_reunion", {
    p_meeting_id: meetingId, p_minutos: minutos, p_categoria: motivo.categoria, p_motivo: motivo.nota?.slice(0, 300) ?? undefined,
  });
  if (error) return fallo(error);
  refrescar(meetingId);
  return { ok: true, data: undefined };
}

export async function ajustarItem(meetingId: string, itemId: string, minutos: number, motivo: Motivo): Promise<Resultado> {
  if (!UUID.test(meetingId) || !UUID.test(itemId)) return { ok: false, error: MENSAJES.item_invalido };
  if (!minutosValidos(minutos)) return { ok: false, error: MENSAJES.minutos_invalidos };
  if (!CATEGORIAS.includes(motivo?.categoria)) return { ok: false, error: MENSAJES.motivo_requerido };
  const db = await createClient();
  const { error } = await db.rpc("ajustar_item", {
    p_item_id: itemId, p_minutos: minutos, p_categoria: motivo.categoria, p_motivo: motivo.nota?.slice(0, 300) ?? undefined,
  });
  if (error) return fallo(error);
  refrescar(meetingId);
  return { ok: true, data: undefined };
}

export async function quitarItem(meetingId: string, itemId: string, quitar: boolean): Promise<Resultado> {
  if (!UUID.test(meetingId) || !UUID.test(itemId)) return { ok: false, error: MENSAJES.item_invalido };
  const db = await createClient();
  const { error } = await db.rpc("quitar_item", { p_item_id: itemId, p_quitar: quitar });
  if (error) return fallo(error);
  refrescar(meetingId);
  return { ok: true, data: undefined };
}

// Cambia una canción del orden por otra del catálogo (avisa a Creativos).
export async function reemplazarCancion(meetingId: string, itemId: string, songId: string, motivo?: string): Promise<Resultado> {
  if (!UUID.test(meetingId) || !UUID.test(itemId) || !UUID.test(songId)) return { ok: false, error: MENSAJES.item_invalido };
  const db = await createClient();
  const { error } = await db.rpc("reemplazar_cancion", { p_item_id: itemId, p_song_id: songId, p_motivo: motivo?.slice(0, 300) ?? undefined });
  if (error) return fallo(error);
  refrescar(meetingId);
  return { ok: true, data: undefined };
}

// Aviso a los servidores de la reunión. ministerios null = todos los que
// el usuario puede avisar (la base decide cuáles son).
export async function enviarAviso(meetingId: string, ministerios: string[] | null, texto: string): Promise<Resultado<{ destinatarios: number }>> {
  if (!UUID.test(meetingId)) return { ok: false, error: MENSAJES.no_encontrada };
  if (ministerios && !ministerios.every((m) => UUID.test(m))) return { ok: false, error: MENSAJES.sin_permiso };
  const limpio = texto.trim().slice(0, 500);
  if (!limpio) return { ok: false, error: MENSAJES.texto_requerido };
  const db = await createClient();
  const { data, error } = await db.rpc("enviar_aviso_reunion", {
    p_meeting_id: meetingId, p_ministerios: (ministerios ?? null) as string[], p_texto: limpio,
  });
  if (error) return fallo(error);
  refrescar(meetingId);
  return { ok: true, data: { destinatarios: data ?? 0 } };
}
