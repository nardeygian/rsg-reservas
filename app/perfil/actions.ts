"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lookupSlackUserByEmail } from "@/lib/slack";

const SLACK_ID_RE = /^[UW][A-Z0-9]{6,20}$/;

function back(params: Record<string, string>): never {
  const sp = new URLSearchParams(params);
  redirect(`/perfil?${sp.toString()}`);
}

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
    back({ error: `No se pudo regenerar el enlace: ${error.message}` });
  }

  revalidatePath("/perfil");
  back({ ok: "Enlace regenerado. El anterior ya no funciona." });
}

export async function updateSlackUserIdAction(formData: FormData) {
  const raw = String(formData.get("slack_user_id") ?? "").trim().toUpperCase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Vacío = desvincular.
  if (raw === "") {
    const { error } = await supabase
      .from("profiles")
      .update({ slack_user_id: null })
      .eq("id", user.id);
    if (error) back({ error: `No se pudo desvincular: ${error.message}` });
    revalidatePath("/perfil");
    back({ ok: "Slack desvinculado." });
  }

  if (!SLACK_ID_RE.test(raw)) {
    back({
      error: "El Slack ID tiene formato U0123ABC (empieza con U o W, mayúsculas y números).",
    });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ slack_user_id: raw })
    .eq("id", user.id);
  if (error) back({ error: `No se pudo guardar: ${error.message}` });
  revalidatePath("/perfil");
  back({ ok: `Slack vinculado a ${raw}.` });
}

export async function autoLinkSlackByEmailAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email) back({ error: "Tu cuenta no tiene email." });

  const slackId = await lookupSlackUserByEmail(user.email);
  if (!slackId) {
    back({
      error:
        "No encontré tu usuario de Slack con ese email. Ingrésalo manual o usa el mismo email en ambos.",
    });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ slack_user_id: slackId })
    .eq("id", user.id);
  if (error) back({ error: `No se pudo guardar: ${error.message}` });
  revalidatePath("/perfil");
  back({ ok: `Slack vinculado a ${slackId}.` });
}
