import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerAgenda, type EventoAgenda } from "@/lib/servir/agenda";
import { hoyBogota, sumarDias } from "@/app/servir/equipo/_lib/datos";
import { CalendarioShell } from "./_components/CalendarioShell";
import { EventosEspacios } from "@/app/_components/portal/EventosEspacios";

// Hora y espacios de la reunión. booking_id solo llega a quien puede abrir
// la reserva (staff); un servidor no ve espacios.
export type LinkInfo = {
  booking_id: string | null;
  space_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

// El orden y el equipo de la reunión. Sale con la sesión del usuario: un
// servidor solo ve las reuniones donde sirve; los líderes y Planeación,
// todas (RLS).
export type ReunionCal = {
  id: string;
  status: string;
  orden: string[];
  equipo: { departamento: string; personas: { nombre: string; posicion: string; estado: string }[] }[];
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

  // La agenda de reuniones de RSG (ya no viene de Asana).
  const hoy = hoyBogota();
  let agendaError: string | null = null;
  const events: EventoAgenda[] = await leerAgenda(supabase, sumarDias(hoy, -60), sumarDias(hoy, 365)).catch((e: Error) => {
    console.error("[calendario] agenda:", e.message);
    agendaError = e.message;
    return [];
  });
  const conDetalle = events.filter((e) => e.ve_detalle).map((e) => e.gid);

  const [{ data: reunionesRaw }, { data: espaciosRaw }, { data: reservasRaw }] = conDetalle.length
    ? await Promise.all([
        supabase
          .from("meetings")
          .select("id, status, run_items!run_items_meeting_id_fkey(title, sort, kind, removed_at), assignments(status, people(full_name), positions(name), ministries(name))")
          .in("id", conDetalle),
        supabase.from("meeting_spaces").select("meeting_id, spaces(name)").in("meeting_id", conDetalle),
        supabase.from("bookings").select("id, meeting_id").in("meeting_id", conDetalle).neq("status", "cancelled"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const reunionesByGid: Record<string, ReunionCal> = {};
  for (const r of reunionesRaw ?? []) {
    const deps = new Map<string, ReunionCal["equipo"][number]["personas"]>();
    for (const a of r.assignments ?? []) {
      if (a.status === "cancelada") continue;
      const dep = a.ministries?.name ?? "Roles generales";
      deps.set(dep, [...(deps.get(dep) ?? []), { nombre: a.people?.full_name ?? "—", posicion: a.positions?.name ?? "", estado: a.status }]);
    }
    reunionesByGid[r.id] = {
      id: r.id,
      status: r.status,
      orden: [...(r.run_items ?? [])].sort((x, y) => x.sort - y.sort).filter((i) => i.kind !== "encabezado" && !i.removed_at).map((i) => i.title),
      equipo: [...deps.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).map(([departamento, personas]) => ({ departamento, personas })),
    };
  }

  const espacios = new Map<string, string[]>();
  for (const e of (espaciosRaw ?? []) as { meeting_id: string; spaces: { name: string } | null }[]) {
    if (e.spaces?.name) espacios.set(e.meeting_id, [...(espacios.get(e.meeting_id) ?? []), e.spaces.name]);
  }
  const reserva = new Map<string, string>();
  for (const b of (reservasRaw ?? []) as { id: string; meeting_id: string | null }[]) {
    if (b.meeting_id && !reserva.has(b.meeting_id)) reserva.set(b.meeting_id, b.id);
  }

  // Hora de cada reunión (y sus espacios, si se pueden ver). Sin hora de fin
  // se muestra de una hora.
  const linksByGid: Record<string, LinkInfo> = {};
  for (const e of events) {
    if (!e.starts_at && !espacios.has(e.gid)) continue;
    linksByGid[e.gid] = {
      booking_id: reserva.get(e.gid) ?? null,
      space_name: espacios.get(e.gid)?.sort((a, b) => a.localeCompare(b, "es")).join(" · ") ?? null,
      starts_at: e.starts_at,
      ends_at: e.ends_at ?? (e.starts_at ? new Date(Date.parse(e.starts_at) + 3600_000).toISOString() : null),
    };
  }

  return (
    <main className="min-h-dvh">
      <EventosEspacios actual="eventos" />
      {agendaError && (
        <div className="px-4 pt-4 max-w-3xl mx-auto">
          <p role="alert" className="text-sm rounded-[var(--radius-control)] px-4 py-3"
            style={{ background: "var(--color-down-soft)", color: "var(--color-down)", border: "1px solid var(--color-down)" }}>
            No se pudo cargar la agenda de reuniones. {agendaError}
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
      />
    </main>
  );
}
