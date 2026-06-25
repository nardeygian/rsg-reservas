import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
};

const PAYMENT_LABELS: Record<string, string> = {
  not_applicable: "No aplica",
  pending: "Pendiente",
  paid: "Pagado",
};

type StaffRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  use_type: string;
  visibility: string;
  title: string | null;
  expected_attendance: number | null;
  shared_occupancy_allowed: boolean;
  montaje_lock: boolean;
  payment_status: string;
  internal_notes: string | null;
  spaces: { name: string; slug: string } | null;
  ministry: { name: string } | null;
};

type CalendarRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  space_name: string | null;
  display_owner: string | null;
  use_type: string | null;
  has_montaje_lock: boolean | null;
  title: string | null;
};

function notFound() {
  return new NextResponse("No encontrado", { status: 404 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // El token es un UUID generado en profiles.calendar_feed_token. Cualquier otra
  // forma → 404 (no revelamos si el token es inválido vs inexistente).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return notFound();
  }

  const admin = createServiceClient();

  const { data: owner } = await admin
    .from("profiles")
    .select("id, role")
    .eq("calendar_feed_token", token)
    .maybeSingle();

  if (!owner) return notFound();

  const isStaff = STAFF_ROLES.includes(owner.role);
  const isStudioAdmin = owner.role === "studio_admin";

  // Rango: desde hace 30 días en adelante. Limit 500 para no exponer un feed
  // gigantesco a un calendario que reconsulta cada rato.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const events: IcsEvent[] = [];

  if (isStaff || isStudioAdmin) {
    let q = admin
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, use_type, visibility, title,
         expected_attendance, shared_occupancy_allowed, montaje_lock,
         payment_status, internal_notes,
         spaces:space_id(name, slug),
         ministry:ministry_id(name)`
      )
      .eq("is_recurrence_template", false)
      .in("status", ["requested", "approved"])
      .gte("starts_at", since.toISOString())
      .order("starts_at")
      .limit(500);

    if (isStudioAdmin) {
      const { data: estudio } = await admin
        .from("spaces")
        .select("id")
        .eq("slug", "estudio")
        .single();
      if (estudio) q = q.eq("space_id", estudio.id);
    }

    const { data } = await q.returns<StaffRow[]>();
    for (const row of data ?? []) {
      events.push(staffToEvent(row));
    }
  } else {
    const { data } = await admin
      .from("bookings_calendar")
      .select(
        "id, starts_at, ends_at, status, space_name, display_owner, use_type, has_montaje_lock, title"
      )
      .in("status", ["requested", "approved"])
      .gte("starts_at", since.toISOString())
      .order("starts_at")
      .limit(500)
      .returns<CalendarRow[]>();

    for (const row of data ?? []) {
      events.push(calendarToEvent(row));
    }
  }

  const ics = buildIcsCalendar(events);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rsg-reservas.ics"',
      // Privado: el token va en la URL, evitamos cachés compartidos.
      // Refresca cada 5 min como sugerencia al cliente.
      "Cache-Control": "private, max-age=300",
    },
  });
}

function staffToEvent(row: StaffRow): IcsEvent {
  const useTypeLabel = USE_TYPE_LABELS[row.use_type] ?? row.use_type;
  const summary =
    row.title?.trim() ||
    [useTypeLabel, row.spaces?.name].filter(Boolean).join(" - ") ||
    "Reserva RSG";

  const lines: string[] = [];
  if (row.ministry?.name) lines.push(`Ministerio: ${row.ministry.name}`);
  lines.push(`Tipo: ${useTypeLabel}`);
  if (row.expected_attendance != null) {
    lines.push(`Asistencia esperada: ${row.expected_attendance}`);
  }
  if (row.payment_status !== "not_applicable") {
    lines.push(`Pago: ${PAYMENT_LABELS[row.payment_status] ?? row.payment_status}`);
  }
  if (row.shared_occupancy_allowed) lines.push("Ocupación compartida");
  if (row.montaje_lock) lines.push("🔒 Montaje bloqueado");
  if (row.internal_notes) lines.push(`Notas: ${row.internal_notes}`);

  return {
    uid: `booking-${row.id}@rsg-reservas`,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    summary,
    location: row.spaces?.name ?? null,
    status: row.status,
    description: lines.join("\n"),
  };
}

function calendarToEvent(row: CalendarRow): IcsEvent {
  const useTypeLabel = row.use_type
    ? USE_TYPE_LABELS[row.use_type] ?? row.use_type
    : null;
  const summary =
    row.title?.trim() ||
    [useTypeLabel, row.space_name].filter(Boolean).join(" - ") ||
    "Reserva RSG";

  const lines: string[] = [];
  if (row.display_owner) lines.push(`Reserva: ${row.display_owner}`);
  if (useTypeLabel) lines.push(`Tipo: ${useTypeLabel}`);
  if (row.has_montaje_lock) lines.push("🔒 Montaje bloqueado");

  return {
    uid: `booking-${row.id}@rsg-reservas`,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    summary,
    location: row.space_name,
    status: row.status,
    description: lines.length ? lines.join("\n") : null,
  };
}
