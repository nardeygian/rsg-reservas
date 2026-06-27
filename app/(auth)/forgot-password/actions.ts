"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=El%20email%20es%20obligatorio");
  }

  const supabase = await createClient();
  const origin = process.env.SITE_URL ?? "https://rsg-reservas.vercel.app";

  // No reportamos si el email existe o no (anti-enumeración).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  redirect("/forgot-password?ok=1");
}
