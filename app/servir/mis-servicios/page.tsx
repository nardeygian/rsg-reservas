import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServir } from "@/app/servir/equipo/_lib/supabase";
import { fechaCorta, fechaReunion, hoyBogota, misEquipos } from "@/app/servir/equipo/_lib/datos";
import { SubnavServir } from "@/app/servir/equipo/_components/ui";
import { ServicioTarjeta, type ServicioFila } from "./_components/ServicioTarjeta";
import { Bloqueos, type BloqueoFila } from "./_components/Bloqueos";

type AsignacionRaw = {
  id: string; status: string; decline_reason: string | null; position_id: string; meeting_id: string;
  meetings: { name: string; meeting_date: string; starts_at: string | null; status: string } | null;
  positions: { name: string } | null;
  ministries: { name: string } | null;
};

// Solo las reuniones donde sirvo: RLS de assignments y meetings ya lo
// garantiza; aquí además se filtra por mi persona para no mezclar con lo que
// ve un líder.
export default async function MisServiciosPage() {
  const db = await clienteServir();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const [{ data: personId }, equipos] = await Promise.all([db.rpc("current_person_id"), misEquipos(db)]);
  const esLider = equipos.length > 0;
  const hoy = hoyBogota();

  const encabezado = (
    <>
      <SubnavServir actual="mis-servicios" esLider={esLider} />
      <header className="flex flex-col gap-1">
        <p className="eyebrow">Servir</p>
        <h1 className="page-title">Mis servicios</h1>
      </header>
    </>
  );
  const marco = (children: React.ReactNode) => (
    <main className="min-h-dvh px-4 pt-6 max-w-[760px] mx-auto w-full flex flex-col gap-5" style={{ paddingBottom: "calc(var(--nav-space) + 24px)" }}>
      {encabezado}
      {children}
    </main>
  );

  if (!personId) {
    return marco(
      <div className="card px-4 py-5 flex flex-col gap-3">
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          Tu cuenta aún no está en un equipo. Escoge tu departamento y tu líder aprobará tu solicitud. Si tu líder te mandó una invitación, ábrela y quedará unida.
        </p>
        <Link href="/servir/unirme" className="btn-primary self-start">Unirme a un departamento</Link>
      </div>,
    );
  }

  const [asignacionesR, bloqueosR] = await Promise.all([
    db.from("assignments")
      .select("id, status, decline_reason, position_id, meeting_id, meetings(name, meeting_date, starts_at, status), positions(name), ministries(name)")
      .eq("person_id", personId).neq("status", "cancelada"),
    db.from("availability_blocks").select("id, starts_on, ends_on, reason").eq("person_id", personId).gte("ends_on", hoy).order("starts_on"),
  ]);

  const asignaciones = ((asignacionesR.data ?? []) as AsignacionRaw[])
    .filter((a) => a.meetings && a.meetings.status !== "cancelada");
  const proximas = asignaciones.filter((a) => a.meetings!.meeting_date >= hoy)
    .sort((x, y) => x.meetings!.meeting_date.localeCompare(y.meetings!.meeting_date) || (x.meetings!.starts_at ?? "").localeCompare(y.meetings!.starts_at ?? ""));
  const pasadas = asignaciones.filter((a) => a.meetings!.meeting_date < hoy && a.status === "aceptada")
    .sort((x, y) => y.meetings!.meeting_date.localeCompare(x.meetings!.meeting_date)).slice(0, 5);

  const aceptadasIds = [...proximas, ...pasadas].filter((a) => a.status === "aceptada").map((a) => a.id);
  const reunionIds = [...new Set(proximas.map((a) => a.meeting_id))];
  const [itemsR, ordenR] = await Promise.all([
    aceptadasIds.length
      ? db.from("checklist_items").select("id, assignment_id, moment, text, sort, done_at").in("assignment_id", aceptadasIds).order("sort")
      : Promise.resolve({ data: [] }),
    reunionIds.length
      ? db.from("run_items").select("id, meeting_id, title, kind, duration_sec, sort, responsible_position_id").in("meeting_id", reunionIds).order("sort")
      : Promise.resolve({ data: [] }),
  ]);

  const fila = (a: AsignacionRaw, pasado: boolean): ServicioFila => ({
    id: a.id,
    meeting_id: a.meeting_id,
    status: a.status,
    decline_reason: a.decline_reason,
    fecha: fechaReunion(a.meetings!.meeting_date, a.meetings!.starts_at),
    reunion: a.meetings!.name,
    posicion: a.positions?.name ?? "—",
    departamento: a.ministries?.name ?? "",
    pasado,
    enVivo: !pasado && (a.meetings!.status === "en_vivo" || a.meetings!.meeting_date === hoy),
    checklist: (itemsR.data ?? []).filter((i) => i.assignment_id === a.id)
      .map((i) => ({ id: i.id, moment: i.moment, text: i.text, done: !!i.done_at })),
    orden: pasado ? [] : (ordenR.data ?? []).filter((o) => o.meeting_id === a.meeting_id)
      .map((o) => ({ id: o.id, title: o.title, kind: o.kind, duration_sec: o.duration_sec, mia: o.responsible_position_id === a.position_id })),
  });

  const pendientes = proximas.filter((a) => a.status === "pendiente").length;
  const bloqueos: BloqueoFila[] = (bloqueosR.data ?? []).map((b) => ({
    id: b.id,
    rango: b.starts_on === b.ends_on ? fechaCorta(b.starts_on) : `${fechaCorta(b.starts_on)} – ${fechaCorta(b.ends_on)}`,
    reason: b.reason,
  }));

  return marco(
    <>
      {pendientes > 0 && (
        <p className="card px-4 py-3 text-[14px] font-medium" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)", borderColor: "transparent" }}>
          Tienes {pendientes} {pendientes === 1 ? "asignación" : "asignaciones"} por responder.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Próximos</h2>
        {proximas.length === 0 ? (
          <p className="card px-4 py-5 text-[14px]" style={{ color: "var(--color-muted)" }}>
            No tienes servicios próximos. Cuando tu líder te asigne, aparecerán aquí para que aceptes.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {proximas.map((a) => <ServicioTarjeta key={a.id} s={fila(a, false)} />)}
          </div>
        )}
      </section>

      <Bloqueos bloqueos={bloqueos} hoy={hoy} />

      <Link href="/servir/unirme" className="text-[14px] font-semibold px-1 self-start" style={{ color: "var(--color-accent)" }}>
        Unirme a otro departamento
      </Link>

      {pasadas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow px-1">Últimos servicios</h2>
          <div className="flex flex-col gap-3">
            {pasadas.map((a) => <ServicioTarjeta key={a.id} s={fila(a, true)} />)}
          </div>
        </section>
      )}
    </>,
  );
}
