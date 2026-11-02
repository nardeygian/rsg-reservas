"use server";

// Solicitudes para unirse a un departamento (decisión de Gian, 28 oct).
// El servidor pide; su líder de departamento, un pastor de sede o un super
// admin responde. Todo pasa por funciones de la base con la sesión del
// usuario: ellas deciden quién puede qué.

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/servir/contratos";
import { clienteServir } from "@/app/servir/equipo/_lib/supabase";

const MENSAJES: Record<string, string> = {
  sin_sesion: "Inicia sesión para continuar.",
  departamento_invalido: "Escoge un departamento de la lista.",
  ya_es_miembro: "Ya eres parte de ese departamento.",
  no_encontrada: "Esa solicitud ya no está pendiente.",
  sin_permiso: "No puedes responder solicitudes de ese departamento.",
};

function fallo(message: string): { ok: false; error: string } {
  const clave = Object.keys(MENSAJES).find((k) => message.includes(k));
  if (!clave) console.error("[servir/unirme]", message);
  return { ok: false, error: clave ? MENSAJES[clave] : "No se pudo completar. Intenta de nuevo." };
}

function refrescar() {
  revalidatePath("/servir/unirme");
  revalidatePath("/servir/mis-servicios");
  revalidatePath("/servir/equipo", "layout");
  revalidatePath("/");
}

export async function solicitarUnirse(ministryId: string, mensaje?: string): Promise<Resultado<{ id: string }>> {
  const db = await clienteServir();
  const { data, error } = await db.rpc("solicitar_unirse", {
    p_ministry_id: ministryId,
    p_message: mensaje?.slice(0, 500),
  });
  if (error) return fallo(error.message);
  refrescar();
  return { ok: true, data: { id: data } };
}

export async function cancelarSolicitud(id: string): Promise<Resultado> {
  const db = await clienteServir();
  const { error } = await db.rpc("cancelar_solicitud", { p_request_id: id });
  if (error) return fallo(error.message);
  refrescar();
  return { ok: true, data: undefined };
}

export async function responderSolicitud(id: string, aprobar: boolean, nota?: string): Promise<Resultado> {
  const db = await clienteServir();
  const { error } = await db.rpc("responder_solicitud", {
    p_request_id: id,
    p_aprobar: aprobar,
    p_nota: nota?.slice(0, 500),
  });
  if (error) return fallo(error.message);
  refrescar();
  return { ok: true, data: undefined };
}
