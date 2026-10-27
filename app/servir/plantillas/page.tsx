import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { permisos, servirClient, usuarioActual } from "../reuniones/_lib/db";
import { DIAS } from "../reuniones/_lib/fechas";
import { BotonEnlace, Encabezado, Pagina, PuntoColor, SinAcceso } from "../reuniones/_components/ui";
import { NuevaPlantilla } from "./NuevaPlantilla";

export const metadata = { title: "Tipos y plantillas · Servir" };

type Plantilla = { id: string; name: string; version: number; meeting_type_id: string | null; items: number };

// Agrupa por nombre: la versión más alta primero, las demás quedan como historial.
function porNombre(lista: Plantilla[]) {
  const m = new Map<string, Plantilla[]>();
  for (const p of lista) m.set(p.name, [...(m.get(p.name) ?? []), p]);
  return [...m.values()].map((v) => v.sort((a, b) => b.version - a.version));
}

function ListaPlantillas({ lista, porDefecto }: { lista: Plantilla[]; porDefecto: string | null }) {
  if (lista.length === 0) return <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>Sin plantillas.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {porNombre(lista).map(([ult, ...viejas]) => (
        <li key={ult.id} className="flex flex-col">
          <Link href={`/servir/plantillas/${ult.id}`} className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-[var(--radius-control)] hover:bg-[var(--color-surface-2)]">
            <span className="text-[14px] font-medium flex-1 min-w-0 truncate">{ult.name}</span>
            {ult.id === porDefecto && <span className="chip chip-accent">Por defecto</span>}
            <span className="text-[12px] tabular flex-none" style={{ color: "var(--color-muted)" }}>v{ult.version} · {ult.items} ítems</span>
          </Link>
          {viejas.length > 0 && (
            <p className="text-[12px] pl-0" style={{ color: "var(--color-faint)" }}>
              Versiones anteriores:{" "}
              {viejas.map((v, i) => (
                <span key={v.id}>
                  {i > 0 && ", "}
                  <Link href={`/servir/plantillas/${v.id}`} className="underline">v{v.version}</Link>
                  {v.id === porDefecto && " (por defecto)"}
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function PlantillasPage() {
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");
  const puede = await permisos(supabase);

  if (!puede.plantillas && !puede.verTodas) {
    return (
      <Pagina>
        <Encabezado titulo="Tipos y plantillas" volver={{ href: "/servir/reuniones", label: "Reuniones" }} />
        <SinAcceso texto="Solo Planeación y los pastores de ministerio administran tipos y plantillas." />
      </Pagina>
    );
  }

  const [{ data: tipos }, { data: plantillasData }, { data: ministerios }] = await Promise.all([
    supabase
      .from("meeting_types")
      .select("id, name, color, counting, kind, usual_weekday, usual_time, duration_min, default_template_id, ministry_id, active")
      .order("sort")
      .order("name"),
    supabase.from("meeting_templates").select("id, name, version, meeting_type_id, run_sheet").order("name"),
    supabase.from("ministries").select("id, name"),
  ]);

  const plantillas: Plantilla[] = (plantillasData ?? []).map((p) => ({
    id: p.id, name: p.name, version: p.version, meeting_type_id: p.meeting_type_id,
    items: Array.isArray(p.run_sheet) ? p.run_sheet.length : 0,
  }));
  const ministerio = new Map((ministerios ?? []).map((m) => [m.id, m.name]));
  const sueltas = plantillas.filter((p) => !p.meeting_type_id);
  const activos = (tipos ?? []).filter((t) => t.active);
  const inactivos = (tipos ?? []).filter((t) => !t.active);

  const tarjeta = (t: NonNullable<typeof tipos>[number]) => (
    <article key={t.id} className="card p-4 md:p-5 flex flex-col gap-3" style={{ opacity: t.active ? 1 : 0.65 }}>
      <div className="flex items-start gap-3">
        <span className="pt-1.5"><PuntoColor color={t.color} size={12} /></span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-semibold">{t.name}</h3>
          <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            {[
              t.ministry_id ? ministerio.get(t.ministry_id) : null,
              t.counting === "serv" ? "Cuenta como Servolución" : "Cuenta como ministerio",
              t.usual_weekday != null ? DIAS[t.usual_weekday] : null,
              t.usual_time?.slice(0, 5),
              t.duration_min ? `${t.duration_min} min` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        {puede.plantillas && (
          <Link href={`/servir/plantillas/tipos/${t.id}`} className="icon-btn" aria-label={`Editar ${t.name}`}>
            <Icon name="chevron-right" size={16} />
          </Link>
        )}
      </div>
      <ListaPlantillas lista={plantillas.filter((p) => p.meeting_type_id === t.id)} porDefecto={t.default_template_id} />
      <div className="flex flex-wrap gap-2">
        {puede.plantillas && <NuevaPlantilla meetingTypeId={t.id} sugerido={t.name} />}
        {puede.planear && t.active && (
          <Link href={`/servir/reuniones/nueva?tipo=${t.id}`} className="h-9 px-3 rounded-full text-[13px] font-semibold inline-flex items-center gap-1"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
            <Icon name="calendar-plus" size={14} />
            Crear reunión
          </Link>
        )}
      </div>
    </article>
  );

  return (
    <Pagina>
      <Encabezado
        titulo="Tipos y plantillas"
        subtitulo="Cada tipo guarda lo que se repite; su plantilla por defecto prellena las reuniones nuevas."
        volver={{ href: "/servir/reuniones", label: "Reuniones" }}
      >
        {puede.plantillas && (
          <BotonEnlace href="/servir/plantillas/tipos/nuevo" primario>
            <Icon name="plus" size={16} />
            Nuevo tipo
          </BotonEnlace>
        )}
      </Encabezado>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activos.map(tarjeta)}</div>

      <section className="card p-4 md:p-5 flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold">Plantillas sin tipo</h2>
        <ListaPlantillas lista={sueltas} porDefecto={null} />
        {puede.plantillas && <div><NuevaPlantilla meetingTypeId={null} sugerido="" /></div>}
      </section>

      {inactivos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-[15px] font-semibold">
            Tipos inactivos ({inactivos.length})
            <Icon name="chevron-down" size={16} className="transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pt-3">{inactivos.map(tarjeta)}</div>
        </details>
      )}
    </Pagina>
  );
}
