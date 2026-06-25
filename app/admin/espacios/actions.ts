"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePesosToCents } from "@/lib/money";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/?error=Sin%20permiso");
  }
  return supabase;
}

function back(params: Record<string, string>): never {
  redirect(`/admin/espacios?${new URLSearchParams(params).toString()}`);
}

export async function toggleSpaceStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const nextStatus = String(formData.get("next_status") ?? "");
  if (!id || (nextStatus !== "active" && nextStatus !== "disabled")) {
    back({ error: "Datos inválidos." });
  }

  const supabase = await requireStaff();
  // No tocamos espacios 'external' (los administra un tercero).
  const { data: current } = await supabase
    .from("spaces")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current) back({ error: "Espacio no encontrado." });
  if (current.status === "external") {
    back({ error: "No se puede modificar un espacio administrado por externo." });
  }

  const { error } = await supabase
    .from("spaces")
    .update({ status: nextStatus })
    .eq("id", id);
  if (error) back({ error: `No se pudo cambiar el estado: ${error.message}` });

  revalidatePath("/admin/espacios");
  revalidatePath("/alquilar");
  back({ ok: nextStatus === "active" ? "Espacio activado." : "Espacio pausado." });
}

export async function updateSpaceRateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) back({ error: "Espacio no encontrado." });

  const priceRaw = String(formData.get("hourly_rate") ?? "").trim();
  // Vacío = no rentable (NULL en DB).
  const hourlyRateCents =
    priceRaw === "" ? null : parsePesosToCents(priceRaw);
  if (priceRaw !== "" && hourlyRateCents === null) {
    back({ error: "Tarifa inválida." });
  }

  const supabase = await requireStaff();
  const { error } = await supabase
    .from("spaces")
    .update({ hourly_rate_cents: hourlyRateCents })
    .eq("id", id);
  if (error) back({ error: `No se pudo guardar: ${error.message}` });

  revalidatePath("/admin/espacios");
  back({ ok: "Tarifa actualizada." });
}
