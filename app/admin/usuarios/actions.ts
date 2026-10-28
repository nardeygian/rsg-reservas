"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const VALID_ROLES = [
  "leader",
  "mentor",
  "pastor_ministerio",
  "pastor_sede",
  "admin_casa",
  "studio_admin",
  "planeacion",
  "fundador",
  "servidor",
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
    const msg = error.message.includes("already been registered")
      ? "Este email ya está registrado en el sistema."
      : error.message.includes("valid email")
        ? "El email no es válido."
        : `Error al invitar: ${error.message}`;
    redirect(`/admin/usuarios?error=${encodeURIComponent(msg)}`);
  }

  // El trigger crea el profile con role='leader'. Si pedimos otro rol, lo
  // ajustamos ahora.
  if (data?.user && role !== "leader") {
    const { error: roleError } = await service
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) {
      const msg = roleError.message.includes("check constraint")
        ? `Rol inválido: "${role}" no está permitido en la base de datos.`
        : `Usuario invitado pero el rol no se actualizó: ${roleError.message}`;
      redirect(`/admin/usuarios?error=${encodeURIComponent(msg)}`);
    }
  }

  redirect(
    `/admin/usuarios?ok=${encodeURIComponent(
      `Invitación enviada a ${email}`
    )}`
  );
}

// Al otorgar el rol que el usuario pidió al registrarse, la solicitud queda
// resuelta y deja de aparecer como pendiente.
async function clearRequestIfGranted(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  grantedRole: string
) {
  const matches =
    grantedRole === "mentor" ? ["mentor", "lider_discipulado"] : [grantedRole];
  await service
    .from("profiles")
    .update({ requested_role: null })
    .eq("id", userId)
    .in("requested_role", matches);
}

const VALID_EXTRA_ROLES = [
  "lider_departamento", "pastor_ministerio", "pastor_sede", "lider_discipulado",
  "lider_area", "servidor_planeacion",
] as const;
type ExtraRole = (typeof VALID_EXTRA_ROLES)[number];
function isExtraRole(v: string): v is ExtraRole {
  return (VALID_EXTRA_ROLES as readonly string[]).includes(v);
}

export async function addUserRoleAction(formData: FormData) {
  await ensureSuperAdmin();
  const userId    = String(formData.get("user_id")    ?? "");
  const role      = String(formData.get("role")       ?? "");
  const ministryId = String(formData.get("ministry_id") ?? "").trim() || null;
  const grupoId   = String(formData.get("grupo_id")   ?? "").trim() || null;
  const areaId    = String(formData.get("area_id")    ?? "").trim() || null;

  if (!userId || !isExtraRole(role) || (role === "lider_area" && !areaId)) {
    redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");
  }

  // Líder de área: su alcance es el área. Planeación y discipulado: sin
  // departamento.
  const sinMinisterio = role === "lider_discipulado" || role === "lider_area" || role === "servidor_planeacion";
  const service = createServiceClient();
  const { error } = await service.from("user_roles").insert({
    user_id: userId,
    role,
    ministry_id: sinMinisterio ? null : ministryId,
    area_id: role === "lider_area" ? areaId : null,
  });

  if (error) {
    const msg = error.message.includes("check constraint")
      ? `Rol extra inválido: "${role}".`
      : error.message;
    redirect(`/admin/usuarios?error=${encodeURIComponent(msg)}`);
  }

  await clearRequestIfGranted(service, userId, role);

  // For discipulado: also assign the group leader in svData
  if (role === "lider_discipulado" && grupoId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svTable = (service as any).from("servicio_data");
    const { data } = await svTable.select("data").eq("id", "main").maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = data?.data ?? { grupos: {} };
    if (!d.grupos) d.grupos = {};
    if (d.grupos[grupoId]) {
      // Remove user from any group they previously led
      for (const g of Object.values(d.grupos)) {
        const ids: string[] = (g as Record<string, unknown>)["lider_user_ids"] as string[] ?? [];
        const idx = ids.indexOf(userId);
        if (idx !== -1) ids.splice(idx, 1);
        (g as Record<string, unknown>)["lider_user_ids"] = ids;
      }
      // Add to new group (without displacing existing leaders)
      const ids: string[] = (d.grupos[grupoId] as Record<string, unknown>)["lider_user_ids"] as string[] ?? [];
      if (!ids.includes(userId)) ids.push(userId);
      (d.grupos[grupoId] as Record<string, unknown>)["lider_user_ids"] = ids;
      await svTable.upsert({ id: "main", data: d, updated_at: new Date().toISOString() });
      revalidatePath("/servicio");
      revalidatePath("/discipulos");
    }
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/");
  redirect("/admin/usuarios?ok=Rol%20agregado");
}

export async function removeUserRoleAction(formData: FormData) {
  await ensureSuperAdmin();
  const roleId = String(formData.get("role_id") ?? "");
  if (!roleId) redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");

  const service = createServiceClient();
  const { error } = await service.from("user_roles").delete().eq("id", roleId);
  if (error) redirect(`/admin/usuarios?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/usuarios");
  revalidatePath("/");
  redirect("/admin/usuarios?ok=Rol%20eliminado");
}

export async function asignarGrupoAction(formData: FormData) {
  await ensureSuperAdmin();

  const grupoId = String(formData.get("grupo_id") ?? "").slice(0, 80);
  const userId  = String(formData.get("user_id")  ?? "").trim().slice(0, 40);

  if (!userId) redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svTable = (service as any).from("servicio_data");

  const { data } = await svTable.select("data").eq("id", "main").maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = data?.data ?? { grupos: {} };
  if (!d.grupos) d.grupos = {};

  if (grupoId && !d.grupos[grupoId]) {
    redirect("/admin/usuarios?error=Grupo%20no%20encontrado");
  }

  // Liberar al usuario de cualquier grupo previo
  for (const g of Object.values(d.grupos)) {
    const raw = g as Record<string, unknown>;
    const ids: string[] = Array.isArray(raw["lider_user_ids"])
      ? (raw["lider_user_ids"] as string[])
      : raw["lider_user_id"] ? [raw["lider_user_id"] as string] : [];
    const idx = ids.indexOf(userId);
    if (idx !== -1) ids.splice(idx, 1);
    raw["lider_user_ids"] = ids;
  }

  // Asignar al nuevo grupo (sin desplazar a los líderes existentes)
  if (grupoId) {
    const raw = d.grupos[grupoId] as Record<string, unknown>;
    const ids: string[] = Array.isArray(raw["lider_user_ids"])
      ? (raw["lider_user_ids"] as string[])
      : raw["lider_user_id"] ? [raw["lider_user_id"] as string] : [];
    if (!ids.includes(userId)) ids.push(userId);
    raw["lider_user_ids"] = ids;
  }

  await svTable.upsert({ id: "main", data: d, updated_at: new Date().toISOString() });
  revalidatePath("/servicio");
  revalidatePath("/discipulos");
  redirect(
    `/admin/usuarios?ok=${encodeURIComponent(grupoId ? "Líder asignado al grupo" : "Líder desvinculado del grupo")}`
  );
}

export async function deleteUserAction(formData: FormData) {
  const user = await ensureSuperAdmin();

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect("/admin/usuarios?error=Datos%20inv%C3%A1lidos");
  if (userId === user.id) {
    redirect("/admin/usuarios?error=No%20puedes%20eliminar%20tu%20propia%20cuenta");
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    redirect(`/admin/usuarios?error=${encodeURIComponent(`Error al eliminar: ${error.message}`)}`);
  }

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?ok=Usuario%20eliminado");
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
    const msg = error.message.includes("check constraint")
      ? `Rol inválido: "${role}" no está registrado en la base de datos.`
      : error.message;
    redirect(`/admin/usuarios?error=${encodeURIComponent(msg)}`);
  }

  await clearRequestIfGranted(service, userId, role);

  revalidatePath("/admin/usuarios");
  revalidatePath("/");
  redirect("/admin/usuarios?ok=Rol%20actualizado");
}
