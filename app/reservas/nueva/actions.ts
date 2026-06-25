"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBogotaDatetimeLocal, toDateParam } from "@/lib/datetime";

const VALID_USE_TYPES = [
  "reunion_departamento",
  "reunion_ministerio",
  "consejeria",
  "discipulado",
  "evento",
  "externo",
  "studio_negocio",
  "otro",
] as const;

type UseType = (typeof VALID_USE_TYPES)[number];

function isUseType(value: string): value is UseType {
  return (VALID_USE_TYPES as readonly string[]).includes(value);
}

function backWithError(error: string): never {
  redirect(`/reservas/nueva?error=${encodeURIComponent(error)}`);
}

export async function createBookingAction(formData: FormData) {
  const spaceId = String(formData.get("space_id") ?? "").trim();
  const startsRaw = String(formData.get("starts_at") ?? "").trim();
  const endsRaw = String(formData.get("ends_at") ?? "").trim();
  const useType = String(formData.get("use_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const attendanceRaw = String(formData.get("expected_attendance") ?? "").trim();

  if (!spaceId || !startsRaw || !endsRaw || !useType) {
    backWithError("Faltan campos obligatorios.");
  }
  if (!isUseType(useType)) {
    backWithError("Tipo de uso no válido.");
  }

  const startsAt = parseBogotaDatetimeLocal(startsRaw);
  const endsAt = parseBogotaDatetimeLocal(endsRaw);
  if (!startsAt || !endsAt) {
    backWithError("Fechas con formato inválido.");
  }
  if (endsAt <= startsAt) {
    backWithError("La hora de fin debe ser posterior a la de inicio.");
  }

  const expectedAttendance = attendanceRaw === "" ? null : Number(attendanceRaw);
  if (expectedAttendance !== null && !Number.isFinite(expectedAttendance)) {
    backWithError("Asistencia esperada inválida.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id, booking_policy, status")
    .eq("id", spaceId)
    .single();

  if (spaceError || !space) {
    backWithError("El espacio seleccionado no existe.");
  }
  if (space.status === "disabled") {
    backWithError("Ese espacio está deshabilitado.");
  }

  const { data: rsg, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "RSG")
    .single();
  if (orgError || !rsg) {
    backWithError("No se encontró la organización RSG.");
  }

  const status =
    space.booking_policy === "self_serve" ? "approved" : "requested";

  const { error: insertError } = await supabase.from("bookings").insert({
    space_id: space.id,
    owner_org_id: rsg.id,
    created_by: user.id,
    use_type: useType,
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status,
    expected_attendance: expectedAttendance,
  });

  if (insertError) {
    // 23P01 = exclusion_violation (la exclusion constraint anti-solapamiento).
    if (insertError.code === "23P01") {
      backWithError(
        "Ese horario choca con otra reserva (incluyendo buffers de montaje). Elige otra franja."
      );
    }
    backWithError(`No se pudo crear la reserva: ${insertError.message}`);
  }

  redirect(`/calendario?view=dia&date=${toDateParam(startsAt)}`);
}
