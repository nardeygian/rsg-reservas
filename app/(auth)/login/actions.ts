"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function translateAuthError(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("invalid login credentials") || l.includes("invalid credentials"))
    return "Email o contraseña incorrectos";
  if (l.includes("email not confirmed"))
    return "Confirma tu email antes de ingresar";
  if (l.includes("too many requests"))
    return "Demasiados intentos. Espera unos minutos";
  if (l.includes("user not found"))
    return "No existe una cuenta con ese email";
  return msg;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Email%20y%20contrase%C3%B1a%20son%20obligatorios");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/");
}
