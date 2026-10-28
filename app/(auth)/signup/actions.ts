"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rutaSegura, RUTA_INVITACION } from "@/lib/cuentas/db";

const VALID_REQUESTED_ROLES = [
  "lider_departamento",
  "mentor",
  "pastor_ministerio",
  "pastor_sede",
] as const;

type RequestedRole = (typeof VALID_REQUESTED_ROLES)[number];

function isRequestedRole(value: string): value is RequestedRole {
  return (VALID_REQUESTED_ROLES as readonly string[]).includes(value);
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const rawRequestedRole = String(formData.get("requested_role") ?? "");
  // Quien llega con una invitación de su líder no escoge rol: la invitación
  // ya dice quién es (people.profile_id).
  const next = rutaSegura(formData.get("next"));
  const porInvitacion = next.startsWith(RUTA_INVITACION);
  const conNext = next === "/" ? "" : `&next=${encodeURIComponent(next)}`;

  if (!email || !password || !fullName || (!rawRequestedRole && !porInvitacion)) {
    redirect(`/signup?error=Todos%20los%20campos%20son%20obligatorios${conNext}`);
  }

  if (rawRequestedRole && !isRequestedRole(rawRequestedRole)) {
    redirect(`/signup?error=Tipo%20no%20v%C3%A1lido${conNext}`);
  }

  const supabase = await createClient();
  const origin = process.env.SITE_URL ?? "https://rsg-reservas.vercel.app";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        ...(rawRequestedRole ? { requested_role: rawRequestedRole } : {}),
      },
      emailRedirectTo: next === "/"
        ? `${origin}/auth/callback`
        : `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}${conNext}`);
  }

  // Sin confirmación de correo la sesión ya está abierta: seguir.
  if (data.session && next !== "/") redirect(next);

  redirect(`/signup?ok=1${conNext}`);
}
