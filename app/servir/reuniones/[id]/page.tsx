import { notFound, redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import type { TipoItemOrden } from "@/lib/servir/contratos";
import { guardarOrden } from "../actions";
import { permisos, servirClient, usuarioActual } from "../_lib/db";
import { fechaLarga, horaBogota } from "../_lib/fechas";
import { BotonEnlace, Encabezado, EstadoChip, Pagina, PuntoColor } from "../_components/ui";
import { EditorOrden } from "../_components/EditorOrden";
import { AccionesReunion } from "./AccionesReunion";

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

export default async function ReunionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const { data: m } = await supabase
    .from("meetings")
    .select("id, name, meeting_date, starts_at, ends_at, status, notes, meeting_type_id, template_id, origin, meeting_types(name, color)")
    .eq("id", id)
    .maybeSingle();
  // RLS: si no la puede ver, para él no existe.
  if (!m) notFound();

  const [{ data: items }, { data: cambios }, { data: canciones }, puede, plantilla] = await Promise.all([
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
  ]);

  const tipo = m.meeting_types as { name: string; color: string | null } | null;
  const editableOrden = puede.planear && m.status !== "cerrada" && m.status !== "cancelada";
  const guardar = guardarOrden.bind(null, id);

  return (
    <Pagina>
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
        />
      )}

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
          {m.notes && (
            <section className="card p-4 md:p-5 flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold">Notas</h2>
              <p className="text-[14px] whitespace-pre-line" style={{ color: "var(--color-muted)" }}>{m.notes}</p>
            </section>
          )}
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
    </Pagina>
  );
}
