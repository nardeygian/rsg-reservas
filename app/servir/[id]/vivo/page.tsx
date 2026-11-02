import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaLarga, hoyBogota } from "@/app/servir/reuniones/_lib/fechas";
import { Encabezado, EstadoChip, Pagina } from "@/app/servir/reuniones/_components/ui";
import { ReporteReunion, type Reporte } from "@/app/servir/reuniones/_components/ReporteReunion";
import { Asistentes, type JornadaConteo } from "./Asistentes";
import { VivoPanel, type AlertaVivo, type AsistenciaFila, type CambioVivo, type ItemVivo, type MiServicio, type ServidorVivo } from "./VivoPanel";

export const metadata = { title: "En vivo · Servir" };

// En vivo: el orden con el ítem actual y su temporizador, el checklist de
// cada servidor y, para Planeación y los líderes, el avance del equipo y la
// asistencia. Cada lista sale con la sesión del usuario: un servidor solo
// recibe su checklist; un líder, el de su departamento (RLS).
export default async function VivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Una reunión que no existe o que no puede ver (p. ej. un servidor no
  // asignado) lleva al Inicio.
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/");
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect(`/login?next=/servir/${id}/vivo`);

  const { data: m } = await db
    .from("meetings")
    .select("id, name, meeting_date, starts_at, status, current_item_id, actual_start, actual_end, attendance_closed_at, delay_minutes, report")
    .eq("id", id)
    .maybeSingle();
  if (!m) redirect("/");

  const tiene = async (p: string) => (await db.rpc("has_permission", { p_permission: p })).data === true;
  const [puedeVivo, puedeAsistencia, alcancesAsignar, { data: personId }, itemsR, asignR, proyR, cambiosR, quitaCanciones] = await Promise.all([
    tiene("servir.vivo"),
    tiene("servir.asistencia"),
    db.rpc("permission_scopes", { p_permission: "servir.asignar" }).then((r) => r.data ?? []),
    db.rpc("current_person_id"),
    db.from("run_items").select("id, sort, kind, title, duration_sec, planned_duration_sec, removed_at, notes, song_id, song_key, actual_start, actual_end").eq("meeting_id", id).order("sort"),
    db.from("assignments")
      .select("id, person_id, status, people(full_name), positions(name), ministries(id, name), checklist_items(id, moment, text, sort, done_at)")
      .eq("meeting_id", id).eq("status", "aceptada"),
    db.rpc("proyeccion_reunion", { p_meeting_id: id }),
    // Cada "Siguiente" queda registrado, pero aquí solo se muestran los saltos.
    db.from("meeting_live_changes").select("id, kind, minutes, item_title, created_at, reason_category, reason, profiles(full_name)")
      .eq("meeting_id", id).or("kind.neq.avanzar,minutes.neq.1").order("created_at", { ascending: false }).limit(30),
    db.rpc("puede_quitar_canciones", { p_meeting_id: id }).then((r) => r.data === true),
  ]);
  const [{ data: jornadasR }, { data: puedeContar }, { data: deptosAviso }, { data: personasAviso }, { data: alertasR }, cancionesR] = await Promise.all([
    db.rpc("jornadas_reunion", { p_meeting_id: id }),
    db.rpc("puede_registrar_asistentes", { p_meeting_id: id }),
    db.rpc("departamentos_para_avisar", { p_meeting_id: id }),
    db.rpc("personas_para_avisar", { p_meeting_id: id }),
    db.from("meeting_alerts").select("id, anchor, minutes, ministry_ids, message, sent_at, skipped, run_items(title)").eq("meeting_id", id).order("created_at"),
    quitaCanciones ? db.from("songs").select("id, title, default_key").eq("active", true).order("title").limit(500) : Promise.resolve({ data: [] }),
  ]);
  const idsAlerta = [...new Set((alertasR ?? []).flatMap((a) => a.ministry_ids))];
  const { data: nombresDepto } = idsAlerta.length
    ? await db.from("ministries").select("id, name").in("id", idsAlerta)
    : { data: [] as { id: string; name: string }[] };
  const nombreDepto = new Map((nombresDepto ?? []).map((d) => [d.id, d.name]));
  const alertas: AlertaVivo[] = (alertasR ?? []).map((a) => ({
    id: a.id,
    item: (a.run_items as { title: string } | null)?.title ?? "",
    cuando: `${a.anchor === "antes_fin" ? `Faltando ${a.minutes} min de` : `A los ${a.minutes} min de`} ${(a.run_items as { title: string } | null)?.title ?? "un punto"}`,
    mensaje: a.message,
    departamentos: a.ministry_ids.map((m) => nombreDepto.get(m) ?? "").filter(Boolean).join(", "),
    enviada: a.skipped ? null : a.sent_at,
    omitida: a.skipped,
  }));
  const proyeccion = new Map((proyR.data ?? []).map((p) => [p.run_item_id, p]));
  const esLiderDepto = alcancesAsignar.some((a) => a.scope_type === null || a.scope_type === "departamento");

  const items: ItemVivo[] = (itemsR.data ?? []).map((i) => ({
    id: i.id, kind: i.kind, title: i.title, duration_sec: i.duration_sec, notes: i.notes,
    song_id: i.song_id, song_key: i.song_key, actual_start: i.actual_start, actual_end: i.actual_end,
    planned_duration_sec: i.planned_duration_sec ?? i.duration_sec, removed: !!i.removed_at,
    proyectado: m.status === "publicada" || m.status === "en_vivo" ? proyeccion.get(i.id)?.starts_at ?? null : null,
  }));
  // Fin proyectado (con atrasos y ajustes) frente al planeado.
  const fines = (proyR.data ?? []).map((p) => p.ends_at).filter((x): x is string => !!x).sort();
  const finProyectado = m.status === "publicada" || m.status === "en_vivo" ? fines.at(-1) ?? null : null;
  const finPlaneado = m.starts_at
    ? new Date(Date.parse(m.starts_at) + items.reduce((t, i) => t + i.planned_duration_sec, 0) * 1000).toISOString()
    : null;
  // Una reunión del día "terminó" cuando el punto actual ya está en una
  // posterior, o cuando la reunión se cerró o pasó el final del orden.
  const posicion = new Map((itemsR.data ?? []).map((i) => [i.id, i.sort]));
  const sortActual = m.current_item_id ? posicion.get(m.current_item_id) ?? null : null;
  const acabo = m.status === "cerrada" || (m.status === "en_vivo" && m.actual_start !== null && m.current_item_id === null);
  const filasJ = jornadasR ?? [];
  const jornadas: JornadaConteo[] = filasJ.map((j, k) => {
    const siguiente = filasJ[k + 1];
    return {
      id: j.jornada_item_id, titulo: j.titulo, cantidad: j.count, quien: j.registrado_por,
      terminada: acabo || (j.jornada_item_id !== null && !!siguiente && sortActual !== null && sortActual >= siguiente.sort),
    };
  });
  const verAsistentes = (puedeContar === true && ["en_vivo", "cerrada", "publicada"].includes(m.status)) || jornadas.some((j) => j.cantidad !== null);

  const cambios: CambioVivo[] = (cambiosR.data ?? []).map((c) => ({
    id: c.id, kind: c.kind, minutes: c.minutes, item_title: c.item_title, created_at: c.created_at,
    categoria: c.reason_category, motivo: c.reason, quien: (c.profiles as { full_name: string | null } | null)?.full_name ?? null,
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
        subtitulo={<span className="inline-block first-letter:uppercase">{fechaLarga(m.meeting_date)}</span>}
        volver={{ href: `/servir/reuniones/${id}`, label: "Reunión" }}
      >
        <EstadoChip status={m.status} />
      </Encabezado>
      {verAsistentes && <Asistentes meetingId={m.id} jornadas={jornadas} editable={puedeContar === true} />}
      <VivoPanel
        meeting={{ id: m.id, status: m.status, current_item_id: m.current_item_id, actual_start: m.actual_start, cerrada: !!m.attendance_closed_at, delay_minutes: m.delay_minutes }}
        items={items}
        mio={mio}
        equipo={equipo}
        asistencia={asistencia}
        puede={{ vivo: puedeVivo, cerrarAsistencia: puedeAsistencia, confirmar: puedeConfirmar, quitarCanciones: quitaCanciones }}
        assignmentIds={(asignR.data ?? []).map((a) => a.id)}
        cambios={cambios}
        finProyectado={finProyectado}
        finPlaneado={finPlaneado}
        canciones={(cancionesR.data ?? []) as { id: string; title: string; default_key: string | null }[]}
        avisos={{
          departamentos: (deptosAviso ?? []).map((d) => ({ id: d.ministry_id, nombre: d.nombre })),
          personas: (personasAviso ?? []).map((x) => ({ id: x.person_id, nombre: x.nombre, ministry_id: x.ministry_id, asignado: x.asignado, con_cuenta: x.con_cuenta })),
          todos: puedeVivo || alcancesAsignar.length > 0,
        }}
        alertas={alertas}
      />
      {m.report && <ReporteReunion reporte={m.report as unknown as Reporte} />}
    </Pagina>
  );
}
