"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function resetPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (!password || password.length < 6) {
    redirect(
      "/reset-password?error=La%20contrase%C3%B1a%20debe%20tener%20al%20menos%206%20caracteres"
    );
  }

  if (password !== passwordConfirm) {
    redirect("/reset-password?error=Las%20contrase%C3%B1as%20no%20coinciden");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
