"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBogotaDatetimeLocal, toDateParam } from "@/lib/datetime";
import { notifyBookingEvent } from "@/lib/notifications";
import { sendChannelMessage } from "@/lib/slack";
import {
  generateOccurrences,
  getBogotaWeekday,
  recurrenceRrule,
  RECURRENCE_LABELS,
  type RecurrencePattern,
} from "@/lib/recurrence";
import { fromZonedTime } from "date-fns-tz";
import { formatDateLong } from "@/lib/datetime";
import { getSessionProfile } from "@/lib/auth";

const TZ_BOGOTA = "America/Bogota";

const MAX_OCCURRENCES = 365; // cubre daily a 1 año

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
  const freqRaw = String(formData.get("recurrence_freq") ?? "weekly").trim();
  const bydayRaw = formData
    .getAll("recurrence_byday")
    .map((v) => Number(String(v)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  let untilUtc: Date | null = null;
  let pattern: RecurrencePattern | null = null;
  if (isRecurring) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recurrenceUntilRaw)) {
      backWithError("Marcaste recurrente pero falta la fecha hasta.");
    }
    untilUtc = fromZonedTime(`${recurrenceUntilRaw}T23:59:59`, TZ_BOGOTA);
    if (untilUtc <= startsAt) {
      backWithError("La fecha 'hasta' debe ser posterior al inicio.");
    }

    switch (freqRaw) {
      case "daily":
        pattern = { kind: "daily" };
        break;
      case "weekly":
        pattern = { kind: "weekly" };
        break;
      case "monthly":
        pattern = { kind: "monthly" };
        break;
      case "custom": {
        if (bydayRaw.length === 0) {
          backWithError("En 'personalizado' debes elegir al menos un día.");
        }
        const startDow = getBogotaWeekday(startsAt);
        if (!bydayRaw.includes(startDow)) {
          backWithError(
            "El día de inicio no está en los días marcados. Cambia la fecha de inicio o marca ese día."
          );
        }
        pattern = { kind: "custom", byday: bydayRaw };
        break;
      }
      default:
        backWithError("Frecuencia de recurrencia inválida.");
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

  // Determinar rol del usuario para decidir org/visibility/status.
  const session = await getSessionProfile();
  const isStudioAdmin = session?.profile?.role === "studio_admin";
  const isMentor = session?.profile?.role === "mentor";
  const externalClient =
    isStudioAdmin && String(formData.get("external_client") ?? "") === "on";

  // El mentor solo puede reservar para discipulado, consejería u otro.
  if (isMentor && !["discipulado", "consejeria", "otro"].includes(useType)) {
    backWithError(
      "Como Líder de Discipulado solo puedes reservar para reunión de discipulado, consejería u otro."
    );
  }

  const orgName = isStudioAdmin ? "Studio Prado" : "RSG";
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", orgName)
    .single();
  if (orgError || !org) {
    backWithError(`No se encontró la organización ${orgName}.`);
  }

  // El admin del Estudio auto-aprueba (no pasa por flujo de aprobación
  // de la iglesia). El resto sigue la política del espacio.
  const status = isStudioAdmin
    ? "approved"
    : space.booking_policy === "self_serve"
      ? "approved"
      : "requested";

  // Cliente externo del Estudio: visibilidad oculta + tipo forzado a
  // studio_negocio. Resto: visibilidad full y el tipo que eligió el form.
  const visibility: "full" | "private_label" = externalClient
    ? "private_label"
    : "full";
  const finalUseType: UseType = externalClient ? "studio_negocio" : useType;

  // ─── Items pedidos (solo aplican a reservas únicas internas) ─────────
  // Las series recurrentes ignoran items en esta versión. El form lo dice.
  type RequestedItem = { itemId: string; quantity: number };
  const requestedItems: RequestedItem[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^item_qty_([0-9a-f-]{36})$/i.exec(key);
    if (!match) continue;
    const qty = Number(String(value));
    if (!Number.isInteger(qty) || qty <= 0) continue;
    requestedItems.push({ itemId: match[1], quantity: qty });
  }

  // ─── Caso 1: reserva única ────────────────────────────────────────────
  if (!isRecurring) {
    // Validar disponibilidad ANTES de insertar la reserva. Race condition
    // posible pero aceptable en bajo tráfico (futuro: trigger SQL).
    if (requestedItems.length > 0) {
      const { data: avail, error: availErr } = await supabase.rpc(
        "items_available",
        {
          _starts: startsAt.toISOString(),
          _ends: endsAt.toISOString(),
        }
      );
      if (availErr) {
        backWithError(`No se pudo verificar inventario: ${availErr.message}`);
      }
      const byItem = new Map((avail ?? []).map((a) => [a.item_id, a]));
      for (const req of requestedItems) {
        const a = byItem.get(req.itemId);
        if (!a) {
          backWithError("Algún item ya no existe; recarga la página.");
        }
        if (req.quantity > a.available) {
          backWithError(
            `No alcanzan los ${a.name}: pediste ${req.quantity}, hay ${a.available} disponibles en esa franja.`
          );
        }
      }
    }

    const newId = randomUUID();
    const { error: insertError } = await supabase.from("bookings").insert({
      id: newId,
      space_id: space.id,
      owner_org_id: org.id,
      created_by: user.id,
      use_type: finalUseType,
      title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status,
      visibility,
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

    // Insertar booking_items con snapshot del precio actual (no se cobra a
    // líderes; el snapshot sirve para reportes futuros).
    if (requestedItems.length > 0) {
      const { data: catalog, error: catErr } = await supabase
        .from("rentable_items")
        .select("id, unit_price_cents")
        .in(
          "id",
          requestedItems.map((r) => r.itemId)
        );
      if (catErr) {
        backWithError(`No se pudo leer catálogo: ${catErr.message}`);
      }
      const priceById = new Map(
        (catalog ?? []).map((c) => [c.id, c.unit_price_cents])
      );
      const rows = requestedItems.map((r) => ({
        booking_id: newId,
        item_id: r.itemId,
        quantity: r.quantity,
        unit_price_cents_snapshot: priceById.get(r.itemId) ?? 0,
      }));
      const { error: bItemsErr } = await supabase
        .from("booking_items")
        .insert(rows);
      if (bItemsErr) {
        // Rollback: borrar la reserva para no quedar inconsistentes.
        await supabase.from("bookings").delete().eq("id", newId);
        backWithError(`No se pudo registrar items: ${bItemsErr.message}`);
      }
    }

    await notifyBookingEvent(newId, "created", user.id);
    redirect(`/calendario?view=dia&date=${toDateParam(startsAt)}`);
  }

  // ─── Caso 2: serie recurrente ─────────────────────────────────────────
  if (!untilUtc || !pattern) backWithError("Falta info de recurrencia.");

  const occurrences = generateOccurrences(
    startsAt,
    endsAt,
    untilUtc,
    pattern,
    MAX_OCCURRENCES
  );
  if (occurrences.length === 0) {
    backWithError(
      "La fecha 'hasta' no cubre ninguna ocurrencia con el patrón elegido."
    );
  }

  // 1. Insert template (no entra a la exclusion constraint).
  const templateId = randomUUID();
  const { error: templateError } = await supabase.from("bookings").insert({
    id: templateId,
    space_id: space.id,
    owner_org_id: org.id,
    created_by: user.id,
    use_type: finalUseType,
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status,
    visibility,
    expected_attendance: expectedAttendance,
    is_recurrence_template: true,
    recurrence_rule: recurrenceRrule(pattern, untilUtc),
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
      owner_org_id: org.id,
      created_by: user.id,
      use_type: finalUseType,
      title,
      starts_at: occ.start.toISOString(),
      ends_at: occ.end.toISOString(),
      status,
      visibility,
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
      ? ` ${conflicts.length} con choque saltada${conflicts.length === 1 ? "" : "s"}.`
      : "";
  await sendChannelMessage(
    `🔁 *Serie ${RECURRENCE_LABELS[pattern.kind]} creada*\n` +
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
