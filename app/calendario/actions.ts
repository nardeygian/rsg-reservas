"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function ensureCanLink() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (["pastor_sede", "pastor_ministerio", "super_admin"].includes(profile?.role ?? "")) {
    return user;
  }

  const { data: extraRoles } = await supabase
    .from("user_roles")
    .select("role, ministries(name)")
    .eq("user_id", user.id);

  const isPlaneacion = (extraRoles ?? []).some(
    (r) => r.role === "lider_departamento" && (r.ministries as { name: string } | null)?.name === "Planeación"
  );

  if (!isPlaneacion) redirect("/calendario?error=Sin%20permiso");
  return user;
}

export async function linkEventAction(formData: FormData) {
  await ensureCanLink();
  const asanaGid = String(formData.get("asana_gid") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!asanaGid || !bookingId) redirect("/calendario?error=Datos%20inv%C3%A1lidos");

  const service = createServiceClient();
  const { error } = await service.from("calendar_links").upsert(
    { asana_gid: asanaGid, booking_id: bookingId },
    { onConflict: "asana_gid" }
  );
  if (error) redirect(`/calendario?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendario");
  redirect("/calendario?ok=Enlace%20guardado");
}

export async function unlinkEventAction(formData: FormData) {
  await ensureCanLink();
  const asanaGid = String(formData.get("asana_gid") ?? "").trim();
  if (!asanaGid) redirect("/calendario?error=Datos%20inv%C3%A1lidos");

  const service = createServiceClient();
  const { error } = await service.from("calendar_links").delete().eq("asana_gid", asanaGid);
  if (error) redirect(`/calendario?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendario");
  redirect("/calendario?ok=Enlace%20eliminado");
}
