import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { permisos, servirClient, usuarioActual } from "./_lib/db";
import { horaBogota, hoyBogota } from "./_lib/fechas";
import { BotonEnlace, Encabezado, ESTADOS, EstadoChip, Pagina, PuntoColor } from "./_components/ui";
import { Filtros } from "./_components/Filtros";

export const metadata = { title: "Reuniones · Servir" };

type Fila = {
  id: string;
  name: string;
  meeting_date: string;
  starts_at: string | null;
  status: string;
  meeting_type_id: string | null;
};

const ESTADOS_VALIDOS = new Set(ESTADOS.map((e) => e.value as string));

function etiquetaMes(fecha: string): string {
  const s = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FilaReunion({ r, tipo }: { r: Fila; tipo?: { name: string; color: string | null } }) {
  const d = new Date(`${r.meeting_date}T12:00:00Z`);
  const dia = d.toLocaleDateString("es-CO", { day: "numeric", timeZone: "UTC" });
  const semana = d.toLocaleDateString("es-CO", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return (
    <li>
      <Link
        href={`/servir/reuniones/${r.id}`}
        prefetch={false}
        className="flex items-center gap-3 px-3 py-3 rounded-[var(--radius-control)] transition hover:bg-[var(--color-surface-2)]"
        style={{ opacity: r.status === "cancelada" ? 0.6 : 1 }}
      >
        <div className="w-11 flex-none flex flex-col items-center leading-none">
          <span className="text-[11px] uppercase font-semibold" style={{ color: "var(--color-muted)" }}>{semana}</span>
          <span className="text-[20px] font-semibold tabular mt-0.5">{dia}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold truncate" style={{ textDecoration: r.status === "cancelada" ? "line-through" : undefined }}>
            {r.name}
          </p>
          <p className="text-[13px] flex items-center gap-1.5 min-w-0" style={{ color: "var(--color-muted)" }}>
            <PuntoColor color={tipo?.color ?? null} size={8} />
            <span className="truncate">{tipo?.name ?? "Sin tipo"}</span>
            {r.starts_at && <span className="tabular flex-none">· {horaBogota(r.starts_at)}</span>}
          </p>
        </div>
        <EstadoChip status={r.status} />
        <Icon name="chevron-right" size={16} className="hidden md:block" style={{ color: "var(--color-faint)" }} />
      </Link>
    </li>
  );
}

function PorMes({ filas, tipos }: { filas: Fila[]; tipos: Map<string, { name: string; color: string | null }> }) {
  const grupos: { mes: string; filas: Fila[] }[] = [];
  for (const r of filas) {
    const mes = etiquetaMes(r.meeting_date);
    if (grupos.at(-1)?.mes !== mes) grupos.push({ mes, filas: [] });
    grupos.at(-1)!.filas.push(r);
  }
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => (
        <div key={g.mes} className="flex flex-col gap-1">
          <h3 className="eyebrow px-3">{g.mes}</h3>
          <ul className="flex flex-col">
            {g.filas.map((r) => <FilaReunion key={r.id} r={r} tipo={r.meeting_type_id ? tipos.get(r.meeting_type_id) : undefined} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string }>;
}) {
  const params = await searchParams;
  const supabase = await servirClient();
  if (!(await usuarioActual(supabase))) redirect("/login");

  const hoy = hoyBogota();
  const tipoFiltro = params.tipo ?? "";
  const estadoFiltro = params.estado && ESTADOS_VALIDOS.has(params.estado) ? params.estado : "";

  // RLS decide qué reuniones existen para cada quien: un servidor sin
  // permiso solo ve las que tiene asignadas.
  const consulta = (proximas: boolean) => {
    let q = supabase
      .from("meetings")
      .select("id, name, meeting_date, starts_at, status, meeting_type_id")
      .order("meeting_date", { ascending: proximas })
      .order("starts_at", { ascending: proximas, nullsFirst: false });
    q = proximas ? q.gte("meeting_date", hoy) : q.lt("meeting_date", hoy);
    if (tipoFiltro === "sin_tipo") q = q.is("meeting_type_id", null);
    else if (tipoFiltro) q = q.eq("meeting_type_id", tipoFiltro);
    if (estadoFiltro) q = q.eq("status", estadoFiltro);
    return q.limit(proximas ? 200 : 150);
  };

  const [{ data: proximas }, { data: anteriores }, { data: tiposData }, puede] = await Promise.all([
    consulta(true),
    consulta(false),
    supabase.from("meeting_types").select("id, name, color, active").order("sort").order("name"),
    permisos(supabase),
  ]);

  const tipos = new Map((tiposData ?? []).map((t) => [t.id, { name: t.name, color: t.color }]));
  const filtrando = !!(tipoFiltro || estadoFiltro);

  return (
    <Pagina>
      <Encabezado
        titulo="Reuniones"
        subtitulo={puede.planear ? "Crea, ordena y publica las reuniones de la iglesia." : "Las reuniones donde sirves y su orden."}
      >
        {puede.plantillas && <BotonEnlace href="/servir/plantillas">Tipos y plantillas</BotonEnlace>}
        {puede.importar && (
          <BotonEnlace href="/servir/reuniones/importar">
            <Icon name="paperclip" size={16} />
            Importar PDF
          </BotonEnlace>
        )}
        {puede.planear && (
          <BotonEnlace href="/servir/reuniones/nueva" primario>
            <Icon name="plus" size={16} />
            Nueva reunión
          </BotonEnlace>
        )}
      </Encabezado>

      <Filtros tipos={(tiposData ?? []).map((t) => ({ id: t.id, name: t.name }))} estados={ESTADOS} />

      <section className="card p-2 md:p-4 flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold px-3 pt-2">Próximas</h2>
        {(proximas ?? []).length === 0 ? (
          <p className="text-[14px] px-3 pb-4" style={{ color: "var(--color-muted)" }}>
            {filtrando ? "No hay próximas reuniones con estos filtros." : "No hay próximas reuniones."}
          </p>
        ) : (
          <PorMes filas={proximas as Fila[]} tipos={tipos} />
        )}
      </section>

      {(anteriores ?? []).length > 0 && (
        <details className="card p-2 md:p-4 group">
          <summary className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer list-none">
            <span className="text-[17px] font-semibold">Anteriores</span>
            <span className="inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--color-muted)" }}>
              {(anteriores ?? []).length}{(anteriores ?? []).length >= 150 ? "+" : ""}
              <Icon name="chevron-down" size={16} className="transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="pt-2">
            <PorMes filas={anteriores as Fila[]} tipos={tipos} />
          </div>
        </details>
      )}
    </Pagina>
  );
}
