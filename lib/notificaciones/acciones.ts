"use server";

// Acciones del frente B4 (contrato AccionesNotificaciones en lib/servir/contratos.ts).
// RLS decide quién puede qué: aquí solo se valida la forma de los datos.

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { parseBogotaDatetimeLocal } from "@/lib/datetime";
import type { AccionesNotificaciones, Audiencia, Resultado } from "@/lib/servir/contratos";
import { despacharAhora } from "./despachar";
import { clienteServir } from "./supabase";

const AUDIENCIAS: Audiencia[] = ["todos", "departamento", "area", "reunion"];

function sinPermiso(code: string | undefined) {
  return code === "42501";
}

export async function registrarDispositivo(
  input: Parameters<AccionesNotificaciones["registrarDispositivo"]>[0],
): Promise<Resultado> {
  const sb = await clienteServir();
  const { error } = await sb.rpc("register_push_device", input.platform === "web"
    ? { p_platform: "web", p_endpoint: input.endpoint, p_p256dh: input.p256dh, p_auth: input.auth, p_device: input.device }
    : { p_platform: input.platform, p_token: input.token, p_device: input.device, p_app_version: input.app_version });
  if (error) return { ok: false, error: sinPermiso(error.code) ? "Inicia sesión para activar las notificaciones." : "No se pudo registrar este dispositivo." };
  return { ok: true, data: undefined };
}

// Al desactivar en este navegador. RLS solo deja borrar los propios.
export async function quitarDispositivo(endpoint: string): Promise<Resultado> {
  const sb = await clienteServir();
  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: "No se pudo desactivar este dispositivo." };
  return { ok: true, data: undefined };
}

export async function enviarMasivo(
  input: Parameters<AccionesNotificaciones["enviarMasivo"]>[0],
): Promise<Resultado<{ id: string }>> {
  const title = input.title.trim();
  const body = input.body.trim();
  const link = input.link?.trim() || null;

  if (!AUDIENCIAS.includes(input.audience)) return { ok: false, error: "Elige a quién va el aviso." };
  if ((input.audience === "todos") !== (input.scope_id === null)) return { ok: false, error: "Elige a quién va el aviso." };
  if (!title || title.length > 80) return { ok: false, error: "El título es obligatorio (máximo 80 caracteres)." };
  if (!body || body.length > 500) return { ok: false, error: "El mensaje es obligatorio (máximo 500 caracteres)." };
  // Solo enlaces dentro del portal: un aviso nunca lleva a otro sitio.
  if (link && !/^\/(?!\/)[\w\-./?=&%#]*$/.test(link)) return { ok: false, error: "El enlace debe ser una ruta del portal, por ejemplo /servir." };

  let scheduled: Date | null = null;
  if (input.scheduled_for) {
    scheduled = new Date(input.scheduled_for);
    if (Number.isNaN(scheduled.getTime())) return { ok: false, error: "La fecha programada no es válida." };
    if (scheduled.getTime() > Date.now() + 60 * 24 * 3600 * 1000) return { ok: false, error: "Solo se puede programar hasta 60 días adelante." };
  }

  const sb = await clienteServir();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión para enviar avisos." };

  const { data, error } = await sb
    .from("broadcasts")
    .insert({
      author_id: user.id,
      audience: input.audience,
      scope_id: input.scope_id,
      title,
      body,
      link,
      ...(scheduled ? { scheduled_for: scheduled.toISOString() } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: sinPermiso(error?.code) ? "No puedes enviar avisos a esa audiencia." : "No se pudo guardar el aviso." };
  }

  if (!scheduled || scheduled.getTime() <= Date.now()) after(despacharAhora);
  revalidatePath("/tu/notificaciones/enviar");
  return { ok: true, data: { id: data.id } };
}

export async function marcarLeidas(ids: string[] | "todas"): Promise<Resultado> {
  const sb = await clienteServir();
  let q = sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids !== "todas") {
    if (ids.length === 0) return { ok: true, data: undefined };
    q = q.in("id", ids);
  }
  const { error } = await q;
  if (error) return { ok: false, error: "No se pudieron marcar como leídas." };
  revalidatePath("/tu/notificaciones");
  return { ok: true, data: undefined };
}

// Para el formulario de envío (useActionState).
export type EstadoEnvio = { ok: boolean; mensaje: string } | null;

export async function enviarMasivoForm(_prev: EstadoEnvio, form: FormData): Promise<EstadoEnvio> {
  const [audience, scope] = String(form.get("audiencia") ?? "").split(":");
  const programar = String(form.get("programar") ?? "");
  let scheduled_for: string | undefined;
  if (programar) {
    const d = parseBogotaDatetimeLocal(programar);
    if (!d) return { ok: false, mensaje: "La fecha programada no es válida." };
    scheduled_for = d.toISOString();
  }
  const r = await enviarMasivo({
    audience: audience as Audiencia,
    scope_id: scope || null,
    title: String(form.get("titulo") ?? ""),
    body: String(form.get("mensaje") ?? ""),
    link: String(form.get("enlace") ?? "") || undefined,
    scheduled_for,
  });
  if (!r.ok) return { ok: false, mensaje: r.error };
  return { ok: true, mensaje: scheduled_for ? "Aviso programado." : "Aviso enviado." };
}
