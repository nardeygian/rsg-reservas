import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import type { TipoItemOrden } from "@/lib/servir/contratos";
import { guardarOrden } from "../actions";
import { permisos, servirClient, usuarioActual } from "../_lib/db";
import { fechaLarga, horaBogota, hoyBogota } from "../_lib/fechas";
import { BotonEnlace, Encabezado, EstadoChip, Pagina, PuntoColor } from "../_components/ui";
import { EditorOrden } from "../_components/EditorOrden";
import { AccionesReunion } from "./AccionesReunion";
import { EspaciosReunion } from "./EspaciosReunion";
import { ReporteReunion, type Reporte } from "../_components/ReporteReunion";
import { ActualizarEnVivo } from "@/app/_components/ActualizarEnVivo";
import { misEquipos } from "../../equipo/_lib/datos";
import { ServidoresReunion } from "./ServidoresReunion";
import { AvisosAutomaticos, type AvisoAuto } from "./AvisosAutomaticos";
import { Asistentes } from "../../[id]/vivo/Asistentes";

export const metadata = { title: "Reunión · Servir" };

const CAMBIO: Record<string, string> = {
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
  restaurada: "Restaurada",
};

function cuando(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota",
  });
}

export default async function ReunionPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const [{ id }, { vista }] = await Promise.all([params, searchParams]);
  // Una reunión que no existe o que no puede ver (p. ej. un servidor no
  // asignado) lleva al Inicio.
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/");
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const { data: m } = await supabase
    .from("meetings")
    .select("id, name, meeting_date, starts_at, ends_at, status, notes, meeting_type_id, template_id, origin, setup_minutes, teardown_minutes, report, meeting_types(name, color)")
    .eq("id", id)
    .maybeSingle();
  // RLS: si no la puede ver, para él no existe.
  if (!m) redirect("/");

  // Todo en paralelo: cada consulta es un viaje a la base y aquí no
  // dependen unas de otras.
  const [
    { data: items }, { data: cambios }, { data: canciones }, puede, plantilla, { data: espacios }, { data: escogidos }, { data: reservas }, { data: montajeGlobal },
    equipos, { data: superAdmin }, { data: conteos }, { data: puedeContar }, { data: avisosR }, { data: deptosR },
  ] = await Promise.all([
    supabase
      .from("run_items")
      .select("id, sort, kind, title, duration_sec, song_id, responsible_position_id")
      .eq("meeting_id", id)
      .order("sort"),
    supabase
      .from("meeting_changes")
      .select("id, change, previous_date, new_date, previous_starts_at, new_starts_at, reason, created_at")
      .eq("meeting_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("songs").select("id, title").eq("active", true).order("title").limit(500),
    permisos(supabase),
    m.template_id
      ? supabase.from("meeting_templates").select("name, version").eq("id", m.template_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    supabase.from("spaces").select("id, name, capacity, booking_policy, status").neq("status", "external").order("name"),
    supabase.from("meeting_spaces").select("space_id").eq("meeting_id", id),
    supabase.rpc("reservas_de_reunion", { p_meeting_id: id }),
    supabase.rpc("has_global_permission", { p_permission: "servir.planear" }),
    // Pestaña Servidores: solo para quien tiene algún equipo que asignar.
    misEquipos(supabase),
    supabase.rpc("is_super_admin"),
    supabase.rpc("jornadas_reunion", { p_meeting_id: id }),
    supabase.rpc("puede_registrar_asistentes", { p_meeting_id: id }),
    // Avisos automáticos (RLS: los ve quien ve la reunión; solo Planeación los edita).
    supabase.from("meeting_alerts").select("id, run_item_id, anchor, minutes, ministry_ids, message, sent_at, skipped").eq("meeting_id", id).order("created_at"),
    supabase.from("ministries").select("id, name").eq("type", "departamento").order("name"),
  ]);
  const asignaAlgo = equipos.length > 0;
  const enServidores = asignaAlgo && vista === "servidores";
  const idsEscogidos = (escogidos ?? []).map((e) => e.space_id);
  // Activos, más los ya escogidos aunque luego se hayan deshabilitado.
  const opcionesEspacio = (espacios ?? []).filter((s) => s.status === "active" || idsEscogidos.includes(s.id));

  const tipo = m.meeting_types as { name: string; color: string | null } | null;
  const editableOrden = puede.planear && m.status !== "cerrada" && m.status !== "cancelada";
  const guardar = guardarOrden.bind(null, id);

  return (
    <Pagina>
      <ActualizarEnVivo
        canal={`reunion-${id}`}
        escuchas={[
          { tabla: "meetings", filtro: `id=eq.${id}` },
          { tabla: "run_items", filtro: `meeting_id=eq.${id}` },
          { tabla: "assignments", filtro: `meeting_id=eq.${id}` },
        ]}
      />
      <Encabezado
        titulo={m.name}
        volver={{ href: "/servir/reuniones", label: "Reuniones" }}
        subtitulo={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="first-letter:uppercase">{fechaLarga(m.meeting_date)}</span>
            {m.starts_at && (
              <span className="tabular">· {horaBogota(m.starts_at)}{m.ends_at ? `–${horaBogota(m.ends_at)}` : ""}</span>
            )}
          </span>
        }
      >
        <EstadoChip status={m.status} />
        {(m.status === "publicada" || m.status === "en_vivo" || m.status === "cerrada") && (
          <BotonEnlace href={`/servir/${m.id}/vivo`} primario={m.status === "en_vivo"}>
            {m.status === "cerrada" ? "Asistencia" : "En vivo"}
          </BotonEnlace>
        )}
      </Encabezado>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]" style={{ color: "var(--color-muted)" }}>
        <span className="inline-flex items-center gap-1.5">
          <PuntoColor color={tipo?.color ?? null} />
          {tipo?.name ?? "Sin tipo"}
        </span>
        {plantilla && (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="repeat" size={14} />
            Creada desde {plantilla.name} v{plantilla.version}
          </span>
        )}
        {m.origin === "asana" && <span>Viene de Asana</span>}
      </div>

      {puede.planear && (
        <AccionesReunion
          key={`${m.meeting_date}|${m.starts_at}|${m.ends_at}|${m.status}|${m.name}`}
          reunion={{
            id: m.id, name: m.name, status: m.status, meeting_date: m.meeting_date,
            starts_at: m.starts_at, ends_at: m.ends_at, notes: m.notes,
          }}
          nombrePlantillaSugerido={plantilla?.name ?? tipo?.name ?? m.name}
          // Pasada (o en vivo/cerrada): solo super admin. Futura: también
          // Planeación y pastor de sede (servir.planear global). RLS lo exige.
          puedeBorrar={superAdmin === true || (montajeGlobal === true
            && !["en_vivo", "cerrada"].includes(m.status) && m.meeting_date >= hoyBogota())}
        />
      )}

      {asignaAlgo && (
        <nav className="segmented self-start" aria-label="Secciones de la reunión">
          <Link href={`/servir/reuniones/${m.id}`} className="segmented-link" aria-current={enServidores ? undefined : "page"}>Orden</Link>
          <Link href={`/servir/reuniones/${m.id}?vista=servidores`} className="segmented-link" aria-current={enServidores ? "page" : undefined}>Servidores</Link>
        </nav>
      )}

      {enServidores ? (
        <ServidoresReunion
          meetingId={m.id}
          reunionNombre={m.name}
          templateId={m.template_id}
          equipos={equipos}
          editable={m.status !== "cerrada" && m.status !== "cancelada"}
        />
      ) : (
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start">
        <EditorOrden
          key={(items ?? []).map((i) => i.id).join()}
          inicial={(items ?? []).map((i) => ({
            id: i.id, kind: i.kind as TipoItemOrden, title: i.title, duration_sec: i.duration_sec,
            song_id: i.song_id, responsible_position_id: i.responsible_position_id,
          }))}
          editable={editableOrden}
          startsAt={m.starts_at}
          canciones={canciones ?? []}
          onGuardar={editableOrden ? guardar : undefined}
        />

        <div className="flex flex-col gap-5">
          {(montajeGlobal || idsEscogidos.length > 0) && (
            <EspaciosReunion
              key={`${m.starts_at}|${m.ends_at}|${m.setup_minutes}|${m.teardown_minutes}|${idsEscogidos.join()}`}
              meetingId={m.id}
              espacios={opcionesEspacio}
              inicial={{ space_ids: idsEscogidos, setup_minutes: m.setup_minutes, teardown_minutes: m.teardown_minutes }}
              inicio={m.starts_at}
              fin={m.ends_at}
              status={m.status}
              reservas={Object.fromEntries((reservas ?? []).map((r) => [r.space_id, r]))}
              editable={montajeGlobal === true && (m.status === "borrador" || m.status === "publicada")}
            />
          )}
          {(m.status === "cerrada" || m.status === "en_vivo" || (conteos ?? []).some((j) => j.count !== null)) && (
            <Asistentes meetingId={m.id} editable={puedeContar === true}
              jornadas={(conteos ?? []).map((j) => ({ id: j.jornada_item_id, titulo: j.titulo, cantidad: j.count, quien: j.registrado_por, terminada: m.status === "cerrada" }))} />
          )}
          {puede.planear && (
            <AvisosAutomaticos
              meetingId={m.id}
              avisos={(avisosR ?? []) as AvisoAuto[]}
              puntos={(items ?? []).filter((i) => i.kind !== "encabezado" && i.kind !== "jornada").map((i) => ({ id: i.id, title: i.title }))}
              departamentos={(deptosR ?? []) as { id: string; name: string }[]}
              editable={m.status !== "cerrada" && m.status !== "cancelada"}
            />
          )}
          {m.notes && (
            <section className="card p-4 md:p-5 flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold">Notas</h2>
              <p className="text-[14px] whitespace-pre-line" style={{ color: "var(--color-muted)" }}>{m.notes}</p>
            </section>
          )}
          {m.report && <ReporteReunion reporte={m.report as unknown as Reporte} />}
          <section className="card p-4 md:p-5 flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">Historial de cambios</h2>
            {(cambios ?? []).length === 0 ? (
              <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>Sin cambios de fecha ni cancelaciones.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {(cambios ?? []).map((c) => (
                  <li key={c.id} className="text-[14px] flex flex-col gap-0.5">
                    <span className="font-semibold">{CAMBIO[c.change] ?? c.change}</span>
                    {c.change === "reprogramada" && c.previous_date && c.new_date && (
                      <span style={{ color: "var(--color-muted)" }}>
                        {fechaLarga(c.previous_date)}{c.previous_starts_at ? ` ${horaBogota(c.previous_starts_at)}` : ""}
                        {" → "}
                        {fechaLarga(c.new_date)}{c.new_starts_at ? ` ${horaBogota(c.new_starts_at)}` : ""}
                      </span>
                    )}
                    {c.reason && <span style={{ color: "var(--color-muted)" }}>{c.reason}</span>}
                    <span className="text-[12px]" style={{ color: "var(--color-faint)" }}>{cuando(c.created_at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
      )}
    </Pagina>
  );
}
