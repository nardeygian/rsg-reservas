"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBogotaDatetimeLocal, toDateParam } from "@/lib/datetime";
import { notifyBookingEvent } from "@/lib/notifications";
import { sendChannelMessage } from "@/lib/slack";
import { weeklyOccurrences, weeklyRrule } from "@/lib/recurrence";
import { fromZonedTime } from "date-fns-tz";
import { formatDateLong } from "@/lib/datetime";

const TZ_BOGOTA = "America/Bogota";

const MAX_OCCURRENCES = 52; // 1 año semanal

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
  const recurringRaw = formData.get("recurring");
  const recurrenceUntilRaw = String(formData.get("recurrence_until") ?? "").trim();

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

  const isRecurring = recurringRaw === "on" || recurringRaw === "true";
  let untilUtc: Date | null = null;
  if (isRecurring) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recurrenceUntilRaw)) {
      backWithError("Marcaste recurrente pero falta la fecha hasta.");
    }
    // El "hasta" se interpreta inclusivo. Para no truncar el día, lo
    // expandimos hasta el final del día en Bogotá (23:59:59).
    untilUtc = fromZonedTime(`${recurrenceUntilRaw}T23:59:59`, TZ_BOGOTA);
    if (untilUtc <= startsAt) {
      backWithError("La fecha 'hasta' debe ser posterior al inicio.");
    }
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

  // ─── Caso 1: reserva única ────────────────────────────────────────────
  if (!isRecurring) {
    const newId = randomUUID();
    const { error: insertError } = await supabase.from("bookings").insert({
      id: newId,
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
      if (insertError.code === "23P01") {
        backWithError(
          "Ese horario choca con otra reserva (incluyendo buffers de montaje). Elige otra franja."
        );
      }
      backWithError(`No se pudo crear la reserva: ${insertError.message}`);
    }

    await notifyBookingEvent(newId, "created", user.id);
    redirect(`/calendario?view=dia&date=${toDateParam(startsAt)}`);
  }

  // ─── Caso 2: serie semanal ────────────────────────────────────────────
  if (!untilUtc) backWithError("Falta fecha hasta.");

  const occurrences = weeklyOccurrences(startsAt, endsAt, untilUtc, MAX_OCCURRENCES);
  if (occurrences.length === 0) {
    backWithError("La fecha 'hasta' no cubre ninguna semana.");
  }

  // 1. Insert template (no entra a la exclusion constraint).
  const templateId = randomUUID();
  const { error: templateError } = await supabase.from("bookings").insert({
    id: templateId,
    space_id: space.id,
    owner_org_id: rsg.id,
    created_by: user.id,
    use_type: useType,
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status,
    expected_attendance: expectedAttendance,
    is_recurrence_template: true,
    recurrence_rule: weeklyRrule(untilUtc),
  });
  if (templateError) {
    backWithError(`No se pudo crear la serie: ${templateError.message}`);
  }

  // 2. Insertar cada instancia. Las que choquen con la exclusion constraint
  //    se saltan; las demás se crean. Atómico no — preferimos crear lo que
  //    se pueda y avisar al usuario qué quedó por fuera.
  const conflicts: Date[] = [];
  let created = 0;
  for (const occ of occurrences) {
    const { error } = await supabase.from("bookings").insert({
      id: randomUUID(),
      space_id: space.id,
      owner_org_id: rsg.id,
      created_by: user.id,
      use_type: useType,
      title,
      starts_at: occ.start.toISOString(),
      ends_at: occ.end.toISOString(),
      status,
      expected_attendance: expectedAttendance,
      parent_booking_id: templateId,
    });
    if (!error) {
      created++;
    } else if (error.code === "23P01") {
      conflicts.push(occ.start);
    } else {
      backWithError(`Error inesperado en una instancia: ${error.message}`);
    }
  }

  // 3. Si NO se creó nada, borramos el template para no dejar huérfanos.
  if (created === 0) {
    await supabase.from("bookings").delete().eq("id", templateId);
    backWithError(
      "Todas las semanas chocan con otra reserva. Cambia el horario o quita la recurrencia."
    );
  }

  // 4. Notificación resumen a Slack (una sola, no N).
  const conflictNote =
    conflicts.length > 0
      ? ` ${conflicts.length} ${conflicts.length === 1 ? "semana" : "semanas"} con choque saltada${conflicts.length === 1 ? "" : "s"}.`
      : "";
  await sendChannelMessage(
    `🔁 *Serie semanal creada*\n` +
      `${created} ${created === 1 ? "reserva" : "reservas"} en *${(await spaceName(supabase, space.id)) ?? "espacio"}*, ` +
      `desde el ${formatDateLong(startsAt)}.${conflictNote}`
  );

  redirect(`/calendario?view=dia&date=${toDateParam(startsAt)}`);
}

async function spaceName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("spaces")
    .select("name")
    .eq("id", spaceId)
    .single();
  return data?.name ?? null;
}
