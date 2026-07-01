"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (!email || !password || !fullName || !rawRequestedRole) {
    redirect("/signup?error=Todos%20los%20campos%20son%20obligatorios");
  }

  if (!isRequestedRole(rawRequestedRole)) {
    redirect("/signup?error=Tipo%20no%20v%C3%A1lido");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        requested_role: rawRequestedRole,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?ok=1");
}
