"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyBookingEvent } from "@/lib/notifications";
import { sendChannelMessage } from "@/lib/slack";

const PAYMENT_BUCKET = "payment-receipts";
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "application/pdf"]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
};

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

async function getUserRole() {
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

  return { supabase, user, role: profile?.role ?? "leader" };
}

function detailPath(id: string, params?: Record<string, string>) {
  const sp = new URLSearchParams(params ?? {});
  const query = sp.toString();
  return `/reservas/${id}${query ? `?${query}` : ""}`;
}

async function staffTransition(
  formData: FormData,
  next: "approved" | "rejected"
): Promise<never> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/calendario");

  const { supabase, user, role } = await getUserRole();
  if (!STAFF_ROLES.includes(role)) {
    redirect(detailPath(id, { error: "Sin permiso" }));
  }

  const { error, count } = await supabase
    .from("bookings")
    .update({ status: next }, { count: "exact" })
    .eq("id", id)
    .eq("status", "requested");

  if (error) {
    redirect(detailPath(id, { error: `No se pudo actualizar: ${error.message}` }));
  }
  if (!count) {
    redirect(detailPath(id, { error: "La reserva ya no está pendiente" }));
  }

  await notifyBookingEvent(id, next, user.id);

  revalidatePath(`/reservas/${id}`);
  revalidatePath("/calendario");
  revalidatePath("/aprobaciones");
  redirect(
    detailPath(id, { ok: next === "approved" ? "Aprobada" : "Rechazada" })
  );
}

export async function approveBookingAction(formData: FormData) {
  return staffTransition(formData, "approved");
}

export async function rejectBookingAction(formData: FormData) {
  return staffTransition(formData, "rejected");
}

export async function cancelSeriesAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/calendario");

  const { supabase } = await getUserRole();

  // Leemos el parent_booking_id desde la vista pública (security_invoker=false
  // así que cualquier autenticado puede ver el campo).
  const { data: instance } = await supabase
    .from("bookings_calendar")
    .select("parent_booking_id")
    .eq("id", id)
    .maybeSingle();

  if (!instance?.parent_booking_id) {
    redirect(detailPath(id, { error: "Esta reserva no es parte de una serie." }));
  }

  // Cancela template + todas las instancias activas. RLS filtra por rol.
  const templateId = instance.parent_booking_id;
  const { error, count } = await supabase
    .from("bookings")
    .update({ status: "cancelled" }, { count: "exact" })
    .or(`id.eq.${templateId},parent_booking_id.eq.${templateId}`)
    .in("status", ["requested", "approved"]);

  if (error) {
    redirect(
      detailPath(id, {
        error: `No se pudo cancelar la serie: ${error.message}`,
      })
    );
  }
  if (!count) {
    redirect(
      detailPath(id, { error: "No puedes cancelar esta serie." })
    );
  }

  await sendChannelMessage(
    `🚫 *Serie semanal cancelada*\n${count} ${count === 1 ? "reserva cancelada" : "reservas canceladas"}.`
  );

  revalidatePath(`/reservas/${id}`);
  revalidatePath("/calendario");
  revalidatePath("/aprobaciones");
  redirect(
    detailPath(id, { ok: `Serie cancelada (${count} reservas).` })
  );
}

export async function uploadPaymentReceiptAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/calendario");

  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    redirect(detailPath(id, { error: "Adjunta un archivo." }));
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    redirect(
      detailPath(id, { error: "El archivo supera 5 MB." })
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    redirect(
      detailPath(id, { error: "Tipo de archivo no permitido (usa PDF, PNG o JPG)." })
    );
  }

  const { supabase, user, role } = await getUserRole();
  if (!STAFF_ROLES.includes(role)) {
    redirect(detailPath(id, { error: "Sin permiso" }));
  }

  const ext = MIME_EXT[file.type] ?? "bin";
  const path = `${id}/receipt.${ext}`;

  // upsert=true para que un re-upload sobrescriba el comprobante anterior.
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadError) {
    redirect(
      detailPath(id, { error: `No se pudo subir: ${uploadError.message}` })
    );
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_receipt_url: path,
      payment_status: "paid",
      payment_marked_by: user.id,
    })
    .eq("id", id);
  if (updateError) {
    redirect(
      detailPath(id, {
        error: `Comprobante subido pero no se pudo marcar como pagado: ${updateError.message}`,
      })
    );
  }

  revalidatePath(`/reservas/${id}`);
  redirect(detailPath(id, { ok: "Comprobante subido. Reserva marcada como pagada." }));
}

export async function removePaymentReceiptAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/calendario");

  const { supabase, role } = await getUserRole();
  if (!STAFF_ROLES.includes(role)) {
    redirect(detailPath(id, { error: "Sin permiso" }));
  }

  // Borrar todos los archivos del folder de esta reserva.
  const { data: list } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .list(id);
  if (list && list.length > 0) {
    const paths = list.map((f) => `${id}/${f.name}`);
    await supabase.storage.from(PAYMENT_BUCKET).remove(paths);
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_receipt_url: null,
      payment_status: "pending",
      payment_marked_by: null,
    })
    .eq("id", id);
  if (updateError) {
    redirect(
      detailPath(id, { error: `No se pudo limpiar: ${updateError.message}` })
    );
  }

  revalidatePath(`/reservas/${id}`);
  redirect(detailPath(id, { ok: "Comprobante eliminado." }));
}

export async function cancelBookingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/calendario");

  const { supabase, user } = await getUserRole();

  // RLS hace el gating: creator con status in (requested, approved) o staff.
  const { error, count } = await supabase
    .from("bookings")
    .update({ status: "cancelled" }, { count: "exact" })
    .eq("id", id)
    .in("status", ["requested", "approved"]);

  if (error) {
    redirect(detailPath(id, { error: `No se pudo cancelar: ${error.message}` }));
  }
  if (!count) {
    redirect(
      detailPath(id, {
        error: "No puedes cancelar esta reserva o ya no está activa",
      })
    );
  }

  await notifyBookingEvent(id, "cancelled", user.id);

  revalidatePath(`/reservas/${id}`);
  revalidatePath("/calendario");
  revalidatePath("/aprobaciones");
  redirect(detailPath(id, { ok: "Cancelada" }));
}
