"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const VALID_ROLES = [
  "leader",
  "mentor",
  "pastor_ministerio",
  "pastor_sede",
  "admin_casa",
  "studio_admin",
  "super_admin",
] as const;

type Role = (typeof VALID_ROLES)[number];

function isRole(v: string): v is Role {
  return (VALID_ROLES as readonly string[]).includes(v);
}

async function ensureSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!me || me.role !== "super_admin") {
    redirect("/admin/usuarios?error=Sin%20permiso");
  }
  return user;
}

export async function inviteUserAction(formData: FormData) {
  await ensureSuperAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!email || !fullName) {
    redirect(
      "/admin/usuarios?error=Email%20y%20nombre%20son%20obligatorios"
    );
  }
  if (!isRole(role)) {
    redirect("/admin/usuarios?error=Rol%20inv%C3%A1lido");
  }

  const service = createServiceClient();
  const origin =
    process.env.SITE_URL ?? "https://rsg-reservas.vercel.app";

  const { data, error } = await service.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: fullName },
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    }
  );

  if (error) {
    redirect(
      `/admin/usuarios?error=${encodeURIComponent(error.message)}`
    );
  }

  // El trigger crea el profile con role='leader'. Si pedimos otro rol, lo
  // ajustamos ahora.
  if (data?.user && role !== "leader") {
    const { error: roleError } = await service
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) {
      redirect(
        `/admin/usuarios?error=${encodeURIComponent(
          `Usuario invitado pero el rol no se actualizó: ${roleError.message}`
        )}`
      );
    }
  }

  redirect(
    `/admin/usuarios?ok=${encodeURIComponent(
      `Invitación enviada a ${email}`
    )}`
  );
}

const VALID_EXTRA_ROLES = ["lider_departamento", "pastor_ministerio", "pastor_sede", "lider_discipulado"] as const;
type ExtraRole = (typeof VALID_EXTRA_ROLES)[number];
function isExtraRole(v: string): v is ExtraRole {
  return (VALID_EXTRA_ROLES as readonly string[]).includes(v);
}

export async function addUserRoleAction(formData: FormData) {
  await ensureSuperAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const ministryId = String(formData.get("ministry_id") ?? "").trim() || null;

  if (!userId || !isExtraRole(role)) {
    redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");
  }

  const service = createServiceClient();
  const { error } = await service.from("user_roles").insert({
    user_id: userId,
    role,
    ministry_id: ministryId,
  });

  if (error) redirect(`/admin/usuarios?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/usuarios?ok=Rol%20agregado");
}

export async function removeUserRoleAction(formData: FormData) {
  await ensureSuperAdmin();
  const roleId = String(formData.get("role_id") ?? "");
  if (!roleId) redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");

  const service = createServiceClient();
  const { error } = await service.from("user_roles").delete().eq("id", roleId);
  if (error) redirect(`/admin/usuarios?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/usuarios?ok=Rol%20eliminado");
}

export async function updateUserRoleAction(formData: FormData) {
  const user = await ensureSuperAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId || !isRole(role)) {
    redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");
  }

  // Evita que el último super_admin se baje a sí mismo y se quede sin acceso.
  if (userId === user.id && role !== "super_admin") {
    redirect(
      "/admin/usuarios?error=No%20puedes%20cambiar%20tu%20propio%20rol%20desde%20aqu%C3%AD"
    );
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    redirect(`/admin/usuarios?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin/usuarios?ok=Rol%20actualizado");
}
