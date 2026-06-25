"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

async function transition(
  formData: FormData,
  next: "approved" | "rejected"
): Promise<never> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/aprobaciones?error=Reserva%20no%20encontrada");
  }

  const supabase = await requireStaff();

  // Solo transicionar si sigue 'requested' — evita pisar decisiones de otros.
  // No usamos .select() porque el cliente no tiene SELECT directo sobre
  // bookings (por diseño); el count del UPDATE basta para saber si tocó la
  // fila.
  const { error, count } = await supabase
    .from("bookings")
    .update({ status: next }, { count: "exact" })
    .eq("id", id)
    .eq("status", "requested");

  if (error) {
    redirect(
      `/aprobaciones?error=${encodeURIComponent(
        `No se pudo actualizar: ${error.message}`
      )}`
    );
  }
  if (!count) {
    redirect(
      "/aprobaciones?error=La%20reserva%20ya%20no%20est%C3%A1%20pendiente"
    );
  }

  revalidatePath("/aprobaciones");
  revalidatePath("/calendario");
  redirect(
    `/aprobaciones?ok=${next === "approved" ? "Aprobada" : "Rechazada"}`
  );
}

export async function approveBookingAction(formData: FormData) {
  return transition(formData, "approved");
}

export async function rejectBookingAction(formData: FormData) {
  return transition(formData, "rejected");
}
