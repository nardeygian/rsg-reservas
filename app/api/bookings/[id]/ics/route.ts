import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcsCalendar } from "@/lib/ics";

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

type StaffExtra = {
  expected_attendance: number | null;
  internal_notes: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("No autenticado", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isStaff = !!profile && STAFF_ROLES.includes(profile.role);

  const { data: base } = await supabase
    .from("bookings_calendar")
    .select(
      "id, space_name, starts_at, ends_at, status, display_owner, use_type, created_by, title"
    )
    .eq("id", id)
    .maybeSingle();

  if (!base || !base.id || !base.starts_at || !base.ends_at) {
    return new NextResponse("No encontrada", { status: 404 });
  }

  const isCreator = base.created_by === user.id;
  if (!isStaff && !isCreator) {
    return new NextResponse("Sin permiso", { status: 403 });
  }

  let staffExtra: StaffExtra | null = null;
  if (isStaff) {
    const { data } = await supabase
      .from("bookings_staff")
      .select("expected_attendance, internal_notes")
      .eq("id", id)
      .maybeSingle()
      .returns<StaffExtra>();
    staffExtra = data;
  }

  const useTypeLabel = base.use_type
    ? USE_TYPE_LABELS[base.use_type] ?? base.use_type
    : null;

  const summary =
    base.title?.trim() ||
    [useTypeLabel, base.space_name].filter(Boolean).join(" - ") ||
    "Reserva RSG";

  const descriptionLines: string[] = [];
  if (base.display_owner) descriptionLines.push(`Reserva: ${base.display_owner}`);
  if (useTypeLabel) descriptionLines.push(`Tipo: ${useTypeLabel}`);
  if (staffExtra?.expected_attendance != null) {
    descriptionLines.push(`Asistencia esperada: ${staffExtra.expected_attendance}`);
  }
  if (staffExtra?.internal_notes) {
    descriptionLines.push(`Notas: ${staffExtra.internal_notes}`);
  }

  const ics = buildIcsCalendar([
    {
      uid: `booking-${base.id}@rsg-reservas`,
      startsAt: base.starts_at,
      endsAt: base.ends_at,
      summary,
      status: base.status ?? "approved",
      location: base.space_name,
      description: descriptionLines.length ? descriptionLines.join("\n") : null,
    },
  ]);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsg-reserva-${base.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
