"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function regenerateFeedTokenAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ calendar_feed_token: randomUUID() })
    .eq("id", user.id);

  if (error) {
    redirect(
      `/perfil?error=${encodeURIComponent(
        `No se pudo regenerar el enlace: ${error.message}`
      )}`
    );
  }

  revalidatePath("/perfil");
  redirect("/perfil?ok=Enlace+regenerado.+El+anterior+ya+no+funciona.");
}
