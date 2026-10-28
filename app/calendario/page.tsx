import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCalendarEvents } from "@/lib/asana";
import { CalendarioShell } from "./_components/CalendarioShell";
import { EventosEspacios } from "@/app/_components/portal/EventosEspacios";
import { linkEventAction, unlinkEventAction } from "./actions";

export type LinkInfo = {
  booking_id: string;
  space_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

// La reunión de Servir creada desde el evento (asana_gid), con su orden y su
// equipo. Sale con la sesión del usuario: un servidor solo ve las reuniones
// donde sirve; los líderes y Planeación, todas (RLS).
export type ReunionCal = {
  id: string;
  status: string;
  orden: string[];
  equipo: { departamento: string; personas: { nombre: string; posicion: string; estado: string }[] }[];
};

export type BookingOption = {
  id: string;
  space_name: string | null;
  starts_at: string;
  ends_at: string;
  display_owner: string | null;
  use_type: string | null;
};

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Determinar si el usuario puede enlazar reuniones con reservas
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  let canLink = ["pastor_sede", "pastor_ministerio", "super_admin"].includes(profile?.role ?? "");
  if (!canLink) {
    const { data: extraRoles } = await supabase
      .from("user_roles")
      .select("role, ministries(name)")
      .eq("user_id", user.id);
    canLink = (extraRoles ?? []).some(
      (r) =>
        r.role === "pastor_ministerio" ||
        (r.role === "lider_departamento" && (r.ministries as { name: string } | null)?.name === "Planeación")
    );
  }

  // Eventos de Asana, links actuales y opciones de reserva (en paralelo)
  let asanaError: string | null = null;
  const [events, { data: linksRaw }, { data: bookingsRaw }] = await Promise.all([
    getCalendarEvents().catch((e: Error) => {
      console.error("[calendario] Asana:", e.message);
      asanaError = e.message;
      return [] as Awaited<ReturnType<typeof getCalendarEvents>>;
    }),
    service.from("calendar_links").select("asana_gid, booking_id"),
    service
      .from("bookings_calendar")
      .select("id, space_name, starts_at, ends_at, display_owner, use_type")
      .eq("status", "approved")
      .gte("starts_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order("starts_at")
      .limit(300),
  ]);

  const { data: reunionesRaw } = await supabase
    .from("meetings")
    .select("id, status, asana_gid, run_items!run_items_meeting_id_fkey(title, sort, kind), assignments(status, people(full_name), positions(name), ministries(name))")
    .not("asana_gid", "is", null)
    .neq("status", "cancelada")
    .gte("meeting_date", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const reunionesByGid: Record<string, ReunionCal> = {};
  for (const r of reunionesRaw ?? []) {
    if (!r.asana_gid) continue;
    const deps = new Map<string, ReunionCal["equipo"][number]["personas"]>();
    for (const a of r.assignments ?? []) {
      if (a.status === "cancelada") continue;
      const dep = a.ministries?.name ?? "";
      deps.set(dep, [...(deps.get(dep) ?? []), { nombre: a.people?.full_name ?? "—", posicion: a.positions?.name ?? "", estado: a.status }]);
    }
    reunionesByGid[r.asana_gid] = {
      id: r.id,
      status: r.status,
      orden: [...(r.run_items ?? [])].sort((x, y) => x.sort - y.sort).filter((i) => i.kind !== "encabezado").map((i) => i.title),
      equipo: [...deps.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).map(([departamento, personas]) => ({ departamento, personas })),
    };
  }

  // Mapa booking_id → detalles
  const bookingById = new Map<string, { space_name: string | null; starts_at: string | null; ends_at: string | null }>();
  for (const b of bookingsRaw ?? []) {
    if (!b.id) continue;
    bookingById.set(b.id, { space_name: b.space_name, starts_at: b.starts_at, ends_at: b.ends_at });
  }

  // Links por asana_gid
  const linksByGid: Record<string, LinkInfo> = {};
  for (const link of linksRaw ?? []) {
    const detail = bookingById.get(link.booking_id);
    linksByGid[link.asana_gid] = {
      booking_id: link.booking_id,
      space_name: detail?.space_name ?? null,
      starts_at: detail?.starts_at ?? null,
      ends_at: detail?.ends_at ?? null,
    };
  }

  const bookingOptions: BookingOption[] = (bookingsRaw ?? [])
    .filter((b): b is typeof b & { id: string; starts_at: string } => !!b.id && !!b.starts_at)
    .map((b) => ({
      id: b.id,
      space_name: b.space_name,
      starts_at: b.starts_at,
      ends_at: b.ends_at ?? "",
      display_owner: b.display_owner ?? null,
      use_type: b.use_type ?? null,
    }));

  return (
    <main className="min-h-dvh">
      <EventosEspacios actual="eventos" />
      {asanaError && (
        <div className="px-4 pt-4 max-w-3xl mx-auto">
          <p role="alert" className="text-sm rounded-[var(--radius-control)] px-4 py-3"
            style={{ background: "var(--color-down-soft)", color: "var(--color-down)", border: "1px solid var(--color-down)" }}>
            No se pudieron cargar los eventos del calendario de Asana. {asanaError}
          </p>
        </div>
      )}
      {(ok || error) && (
        <div className="px-4 pt-4 max-w-3xl mx-auto">
          {ok && (
            <p className="text-sm rounded-[var(--radius-control)] px-4 py-3 mb-2"
              style={{ background: "var(--color-up-soft)", color: "var(--color-up)", border: "1px solid var(--color-up)" }}>
              {ok}
            </p>
          )}
          {error && (
            <p className="text-sm rounded-[var(--radius-control)] px-4 py-3 mb-2"
              style={{ background: "var(--color-down-soft)", color: "var(--color-down)", border: "1px solid var(--color-down)" }}>
              {error}
            </p>
          )}
        </div>
      )}
      <CalendarioShell
        events={events}
        linksByGid={linksByGid}
        reunionesByGid={reunionesByGid}
        bookingOptions={bookingOptions}
        canLink={canLink}
        linkAction={linkEventAction}
        unlinkAction={unlinkEventAction}
      />
    </main>
  );
}
