import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaLarga, hoyBogota } from "@/app/servir/reuniones/_lib/fechas";
import { Encabezado, EstadoChip, Pagina } from "@/app/servir/reuniones/_components/ui";
import { VivoPanel, type AsistenciaFila, type ItemVivo, type MiServicio, type ServidorVivo } from "./VivoPanel";

export const metadata = { title: "En vivo · Servir" };

// En vivo: el orden con el ítem actual y su temporizador, el checklist de
// cada servidor y, para Planeación y los líderes, el avance del equipo y la
// asistencia. Cada lista sale con la sesión del usuario: un servidor solo
// recibe su checklist; un líder, el de su departamento (RLS).
export default async function VivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect(`/login?next=/servir/${id}/vivo`);

  const { data: m } = await db
    .from("meetings")
    .select("id, name, meeting_date, starts_at, status, current_item_id, actual_start, actual_end, attendance_closed_at")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const tiene = async (p: string) => (await db.rpc("has_permission", { p_permission: p })).data === true;
  const [puedeVivo, puedeAsistencia, alcancesAsignar, { data: personId }, itemsR, asignR] = await Promise.all([
    tiene("servir.vivo"),
    tiene("servir.asistencia"),
    db.rpc("permission_scopes", { p_permission: "servir.asignar" }).then((r) => r.data ?? []),
    db.rpc("current_person_id"),
    db.from("run_items").select("id, sort, kind, title, duration_sec, notes, song_id, song_key, actual_start, actual_end").eq("meeting_id", id).order("sort"),
    db.from("assignments")
      .select("id, person_id, status, people(full_name), positions(name), ministries(id, name), checklist_items(id, moment, text, sort, done_at)")
      .eq("meeting_id", id).eq("status", "aceptada"),
  ]);
  const esLiderDepto = alcancesAsignar.some((a) => a.scope_type === null || a.scope_type === "departamento");

  const items: ItemVivo[] = (itemsR.data ?? []).map((i) => ({
    id: i.id, kind: i.kind, title: i.title, duration_sec: i.duration_sec, notes: i.notes,
    song_id: i.song_id, song_key: i.song_key, actual_start: i.actual_start, actual_end: i.actual_end,
  }));

  type Asig = NonNullable<typeof asignR.data>[number];
  const checklist = (a: Asig) => [...(a.checklist_items ?? [])].sort((x, y) => x.sort - y.sort);
  const mias = (asignR.data ?? []).filter((a) => personId && a.person_id === personId);
  const mio: MiServicio | null = mias.length
    ? {
        posiciones: mias.map((a) => a.positions?.name ?? "").filter(Boolean),
        checklist: mias.flatMap((a) => checklist(a).map((c) => ({ id: c.id, moment: c.moment, text: c.text, done: !!c.done_at }))),
      }
    : null;

  // Avance del equipo: solo de quien RLS devuelve checklist (Planeación ve
  // todos; un líder, su departamento). Varias posiciones = una fila.
  const porPersona = new Map<string, ServidorVivo>();
  for (const a of asignR.data ?? []) {
    const items = checklist(a);
    const f = porPersona.get(a.person_id) ?? {
      person_id: a.person_id, nombre: a.people?.full_name ?? "—", posiciones: [], departamento: a.ministries?.name ?? "",
      hechos: 0, total: 0, visible: false,
    };
    f.posiciones.push(a.positions?.name ?? "");
    f.hechos += items.filter((c) => c.done_at).length;
    f.total += items.length;
    f.visible ||= items.length > 0;
    porPersona.set(a.person_id, f);
  }
  const equipo = (puedeVivo || esLiderDepto) ? [...porPersona.values()].sort((x, y) => x.departamento.localeCompare(y.departamento) || x.nombre.localeCompare(y.nombre)) : [];

  const diaLlego = m.meeting_date <= hoyBogota();
  const puedeConfirmar = (puedeAsistencia || (esLiderDepto && !m.attendance_closed_at))
    && (m.status === "en_vivo" || m.status === "cerrada" || (m.status === "publicada" && diaLlego));
  const asistencia: AsistenciaFila[] = puedeConfirmar
    ? ((await db.rpc("asistencia_sugerida", { p_meeting_id: id })).data ?? []).map((r) => ({
        person_id: r.person_id, nombre: r.full_name, roles: r.roles ?? [], departamentos: r.ministries ?? [],
        respuesta: r.assignment_status, hechos: r.checklist_done, total: r.checklist_total,
        estado: (r.current_status ?? r.suggested) as AsistenciaFila["estado"], confirmada: r.current_status !== null, nota: r.current_note,
      }))
    : [];

  return (
    <Pagina>
      <Encabezado
        titulo={m.name}
        subtitulo={<span className="capitalize">{fechaLarga(m.meeting_date)}</span>}
        volver={{ href: `/servir/reuniones/${id}`, label: "Reunión" }}
      >
        <EstadoChip status={m.status} />
      </Encabezado>
      <VivoPanel
        meeting={{ id: m.id, status: m.status, current_item_id: m.current_item_id, actual_start: m.actual_start, cerrada: !!m.attendance_closed_at }}
        items={items}
        mio={mio}
        equipo={equipo}
        asistencia={asistencia}
        puede={{ vivo: puedeVivo, cerrarAsistencia: puedeAsistencia, confirmar: puedeConfirmar }}
        assignmentIds={(asignR.data ?? []).map((a) => a.id)}
      />
    </Pagina>
  );
}
