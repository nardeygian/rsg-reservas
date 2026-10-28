"use server";

// B5 · Cuentas — implementa AccionesCuentas (lib/servir/contratos.ts) y las
// acciones de apoyo de login, invitaciones e identidades vinculadas.
// Las reglas viven en la base: crear_invitacion y aceptar_invitacion son
// funciones security definer que revisan servir.asignar y el token. Solo
// eliminarMiCuenta usa service_role (marcado así en el contrato).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AccionesCuentas, Resultado } from "@/lib/servir/contratos";
import { createEmailLinkClient } from "@/lib/supabase/email-link";
import { revocarTokenApple } from "./apple";
import {
  cuentasClient,
  cuentasServiceClient,
  enlaceInvitacion,
  origenSitio,
  rutaSegura,
  RUTA_INVITACION,
} from "./db";
import { esProveedor, proveedoresActivos } from "./proveedores";

const MENSAJES: Record<string, string> = {
  sin_sesion: "Inicia sesión para continuar.",
  sin_permiso: "No tienes permiso para invitar a esta persona.",
  ya_tiene_cuenta: "Esta persona ya tiene una cuenta unida.",
  correo_invalido: "El correo no es válido.",
  no_encontrada: "La invitación no existe.",
  ya_usada: "Esta invitación ya se usó.",
  revocada: "Esta invitación fue reemplazada por una más nueva. Pide el enlace otra vez.",
  vencida: "Esta invitación venció. Pide a tu líder un enlace nuevo.",
  persona_con_otra_cuenta: "Esta persona ya está unida a otra cuenta.",
  cuenta_con_otra_persona: "Tu cuenta ya está unida a otra persona. Entra con otra cuenta para aceptar.",
};

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function errorBase(e: { message: string }): string {
  const clave = Object.keys(MENSAJES).find((k) => e.message.includes(k));
  return clave ? MENSAJES[clave] : `No se pudo completar: ${e.message}`;
}

const NOMBRE_PROVEEDOR: Record<string, string> = { google: "Google", apple: "Apple" };

// ── Invitaciones ─────────────────────────────────────────────────────────

async function crear(personId: string, email: string | null) {
  const supabase = await cuentasClient();
  const { data, error } = await supabase.rpc("crear_invitacion", {
    p_person_id: personId,
    p_email: email ?? undefined,
  });
  const fila = data?.[0];
  if (error || !fila) {
    return { ok: false as const, supabase, error: error ? errorBase(error) : "No se pudo crear la invitación." };
  }
  return { ok: true as const, supabase, fila };
}

// Enlace para compartir (WhatsApp, copiar). El token sale solo aquí.
export async function crearEnlaceInvitacion(
  personId: string,
): Promise<Resultado<{ url: string; expires_at: string }>> {
  const r = await crear(personId, null);
  if (!r.ok) return fallo(r.error);
  revalidatePath("/perfil/cuenta/invitar");
  return { ok: true, data: { url: enlaceInvitacion(await origenSitio(), r.fila.token), expires_at: r.fila.expires_at } };
}

// Por correo: Supabase manda un enlace de acceso que, al abrirlo, inicia
// sesión con ese correo (crea la cuenta si no existe) y lleva a la
// invitación. Si la persona prefiere Google o Apple, el mismo enlace de la
// invitación le deja escoger.
export const invitarPersona: AccionesCuentas["invitarPersona"] = async (personId, email) => {
  const correo = email.trim().toLowerCase();
  if (!correo) return fallo("Escribe el correo de la persona.");
  const r = await crear(personId, correo);
  if (!r.ok) return fallo(r.error);

  const { data: persona } = await r.supabase.from("people").select("full_name").eq("id", personId).maybeSingle();
  const origen = await origenSitio();
  const destino = `${RUTA_INVITACION}${encodeURIComponent(r.fila.token)}`;
  const { error } = await createEmailLinkClient().auth.signInWithOtp({
    email: correo,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origen}/auth/callback?next=${encodeURIComponent(destino)}`,
      data: persona?.full_name ? { full_name: persona.full_name } : undefined,
    },
  });
  revalidatePath("/perfil/cuenta/invitar");
  if (error) {
    return fallo(/rate limit|too many/i.test(error.message)
      ? "Se enviaron demasiados correos. Comparte el enlace por WhatsApp o intenta en un rato."
      : `La invitación quedó creada, pero el correo no salió: ${error.message}`);
  }
  return { ok: true, data: undefined };
};

export async function revocarInvitacion(invitationId: string): Promise<Resultado> {
  const supabase = await cuentasClient();
  const { error } = await supabase.rpc("revocar_invitacion", { p_invitation_id: invitationId });
  if (error) return fallo(errorBase(error));
  revalidatePath("/perfil/cuenta/invitar");
  return { ok: true, data: undefined };
}

export const aceptarInvitacion: AccionesCuentas["aceptarInvitacion"] = async (token) => {
  const supabase = await cuentasClient();
  const { data, error } = await supabase.rpc("aceptar_invitacion", { p_token: token });
  if (error) return fallo(errorBase(error));
  revalidatePath("/", "layout");
  return { ok: true, data: { person_id: data } };
};

// ── Entrar con Google o Apple ────────────────────────────────────────────

// <form action={entrarConProveedor}> con campos provider y next.
export async function entrarConProveedor(formData: FormData) {
  const provider = formData.get("provider");
  const next = rutaSegura(formData.get("next"));
  const volver = rutaSegura(formData.get("back"), "/login");
  if (!esProveedor(provider)) redirect(volver);
  const activos = await proveedoresActivos();
  if (!activos[provider]) {
    const sep = volver.includes("?") ? "&" : "?";
    redirect(`${volver}${sep}error=${encodeURIComponent(`Entrar con ${NOMBRE_PROVEEDOR[provider]} todavía no está disponible.`)}`);
  }

  const supabase = await cuentasClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // "proveedor" le dice a /auth/callback de quién es el token que llega.
      redirectTo: `${await origenSitio()}/auth/callback?proveedor=${provider}&next=${encodeURIComponent(next)}`,
      // Apple: pedir nombre y correo (el correo puede llegar oculto).
      scopes: provider === "apple" ? "name email" : undefined,
    },
  });
  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "No se pudo abrir el inicio de sesión")}`);
  }
  redirect(data.url);
}

// Guarda el token de actualización de Apple tras volver de su inicio de
// sesión, para poder revocarlo al eliminar la cuenta. Solo se acepta si la
// cuenta actual sí tiene una identidad de Apple.
export async function guardarTokenApple(refreshToken: string): Promise<Resultado> {
  if (!refreshToken || refreshToken.length > 4096) return fallo("Token inválido");
  const supabase = await cuentasClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fallo(MENSAJES.sin_sesion);
  if (!user.identities?.some((i) => i.provider === "apple")) return fallo("La cuenta no usa Apple");
  const { error } = await cuentasServiceClient()
    .from("account_provider_tokens")
    .upsert({ user_id: user.id, provider: "apple", refresh_token: refreshToken, updated_at: new Date().toISOString() });
  return error ? fallo(error.message) : { ok: true, data: undefined };
}

// ── Identidades vinculadas ───────────────────────────────────────────────

export async function vincularProveedor(formData: FormData) {
  const provider = formData.get("provider");
  if (!esProveedor(provider)) redirect("/perfil/cuenta");
  const supabase = await cuentasClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${await origenSitio()}/auth/callback?proveedor=${provider}&next=${encodeURIComponent("/perfil/cuenta?ok=vinculada")}` },
  });
  if (error || !data?.url) {
    const msg = /manual linking/i.test(error?.message ?? "")
      ? "Vincular cuentas todavía no está activo en este entorno."
      : error?.message ?? "No se pudo vincular";
    redirect(`/perfil/cuenta?error=${encodeURIComponent(msg)}`);
  }
  redirect(data.url);
}

export async function desvincularIdentidad(formData: FormData) {
  const identityId = String(formData.get("identity_id") ?? "");
  const supabase = await cuentasClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) redirect(`/perfil/cuenta?error=${encodeURIComponent(error.message)}`);
  const identidades = data?.identities ?? [];
  const identidad = identidades.find((i) => i.identity_id === identityId);
  if (!identidad) redirect("/perfil/cuenta?error=No%20encontramos%20esa%20forma%20de%20entrar");
  if (identidades.length < 2) {
    redirect("/perfil/cuenta?error=Es%20tu%20%C3%BAnica%20forma%20de%20entrar%3A%20vincula%20otra%20antes%20de%20quitarla");
  }
  const { error: e2 } = await supabase.auth.unlinkIdentity(identidad);
  if (e2) redirect(`/perfil/cuenta?error=${encodeURIComponent(e2.message)}`);
  if (identidad.provider === "apple") {
    await cuentasServiceClient().from("account_provider_tokens").delete()
      .eq("user_id", identidad.user_id).eq("provider", "apple");
  }
  revalidatePath("/perfil/cuenta");
  redirect("/perfil/cuenta?ok=desvinculada");
}

// ── Eliminar mi cuenta ───────────────────────────────────────────────────

const BLOQUEOS: Record<string, string> = {
  reservas: "tienes reservas registradas",
  historial_reservas: "apareces en el historial de reservas",
  lider_de_ministerio: "figuras como líder de un ministerio",
};

// Borra la cuenta de verdad (auth.users y, en cascada, perfil, roles,
// permisos, notificaciones y dispositivos), quita correo y teléfono de su
// registro de persona y revoca Apple si la cuenta lo usa.
export const eliminarMiCuenta: AccionesCuentas["eliminarMiCuenta"] = async () => {
  const supabase = await cuentasClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fallo(MENSAJES.sin_sesion);

  const admin = cuentasServiceClient();
  const { data: bloqueos, error: eB } = await admin.rpc("cuenta_bloqueos_eliminacion", { p_user_id: user.id });
  if (eB) return fallo(`No se pudo revisar la cuenta: ${eB.message}`);
  if (bloqueos && bloqueos.length > 0) {
    return fallo(`No podemos borrarla desde aquí porque ${bloqueos.map((b) => BLOQUEOS[b] ?? b).join(" y ")}. Escríbele a un administrador y la eliminamos por ti.`);
  }

  if (user.identities?.some((i) => i.provider === "apple")) {
    const { data: tok } = await admin.from("account_provider_tokens").select("refresh_token")
      .eq("user_id", user.id).eq("provider", "apple").maybeSingle();
    if (tok?.refresh_token) {
      const r = await revocarTokenApple(tok.refresh_token);
      // No se frena el borrado: la cuenta se elimina igual (lo exige 5.1.1(v)).
      if (!r.ok) console.error("[cuentas] no se pudo revocar Apple", user.id, r.error);
    } else {
      console.error("[cuentas] cuenta con Apple sin token guardado para revocar", user.id);
    }
  }

  const { error: eP } = await admin.rpc("eliminar_datos_personales", { p_user_id: user.id });
  if (eP) return fallo(`No se pudo borrar tus datos: ${eP.message}`);
  const { error: eU } = await admin.auth.admin.deleteUser(user.id);
  if (eU) return fallo(`No se pudo eliminar la cuenta: ${eU.message}`);

  await supabase.auth.signOut({ scope: "local" });
  return { ok: true, data: undefined };
};

// "Usar otra cuenta" en la invitación: cierra la sesión y vuelve al enlace.
export async function salirYVolver(formData: FormData) {
  const supabase = await cuentasClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(rutaSegura(formData.get("next"), "/login"));
}
