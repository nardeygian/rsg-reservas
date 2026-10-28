import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
import type { EstadisticaReunion, SaludServidor, Semaforo } from "@/lib/servir/contratos";
import { fechaCorta, hoyBogota, sumarDias } from "@/app/servir/reuniones/_lib/fechas";
import { Encabezado, Pagina, PuntoColor, SinAcceso } from "@/app/servir/reuniones/_components/ui";
import { FiltrosEstadisticas, PERIODOS } from "./_components/FiltrosEstadisticas";
import { Cifra, SEMAFORO, SemaforoChip, minutos, pct } from "./_components/ui";
import { Ajustes } from "./_components/Ajustes";

export const metadata = { title: "Estadísticas · Servir" };

const DIAS: Record<string, number> = { mes: 0, trimestre: 90, semestre: 182, anio: 365 };

// Tablero de reuniones y salud del servidor. Cada quien ve su alcance: las
// funciones de la base filtran con can_see_person_stats (pastores y
// Planeación todo; líderes su departamento o área; líder de discipulado sus
// discípulos que sirven).
export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; periodo?: string; tipo?: string; dep?: string }>;
}) {
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login?next=/servir/estadisticas");

  const { data: puede } = await db.rpc("puede_ver_estadisticas");
  if (!puede) {
    return (
      <Pagina>
        <Encabezado titulo="Estadísticas" />
        <SinAcceso texto="Las estadísticas de Servir son para pastores, Planeación y líderes." />
      </Pagina>
    );
  }

  const p = await searchParams;
  const vista = p.vista === "salud" ? "salud" : "reuniones";
  const periodo = PERIODOS.some((x) => x.value === p.periodo) ? p.periodo! : "trimestre";
  const hoy = hoyBogota();
  const desde = periodo === "mes" ? `${hoy.slice(0, 8)}01` : sumarDias(hoy, -DIAS[periodo]);
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  const tipoId = uuid(p.tipo);
  const depId = uuid(p.dep);

  const [tiposR, depsR, planearR, ajustesR] = await Promise.all([
    db.from("meeting_types").select("id, name").eq("active", true).order("sort").order("name"),
    db.from("ministries").select("id, name").eq("type", "departamento").order("name"),
    db.rpc("has_global_permission", { p_permission: "servir.planear" }),
    db.from("servir_ajustes").select("*").maybeSingle(),
  ]);

  const qs = (v: string) => {
    const n = new URLSearchParams();
    n.set("vista", v);
    if (p.periodo) n.set("periodo", periodo);
    if (tipoId) n.set("tipo", tipoId);
    if (depId) n.set("dep", depId);
    return `/servir/estadisticas?${n.toString()}`;
  };

  return (
    <Pagina>
      <Encabezado titulo="Estadísticas" subtitulo="Cómo están las reuniones y la salud de los servidores" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav className="segmented self-start" aria-label="Estadísticas">
          <Link href={qs("reuniones")} className="segmented-link" aria-current={vista === "reuniones" ? "page" : undefined}>Reuniones</Link>
          <Link href={qs("salud")} className="segmented-link" aria-current={vista === "salud" ? "page" : undefined}>Salud del equipo</Link>
        </nav>
        <FiltrosEstadisticas tipos={tiposR.data ?? []} departamentos={depsR.data ?? []} conTipo={vista === "reuniones"} />
      </div>

      {vista === "reuniones" ? (
        <Reuniones
          filas={(await db.rpc("estadisticas_reuniones", {
            p_desde: desde, p_hasta: hoy,
            ...(tipoId ? { p_meeting_type_id: tipoId } : {}),
            ...(depId ? { p_ministry_id: depId } : {}),
          })).data ?? []}
          desde={desde}
          hoy={hoy}
        />
      ) : (
        <Salud
          filas={((await db.rpc("salud_servidores", depId ? { p_ministry_id: depId } : {})).data ?? []) as SaludServidor[]}
          ajustes={ajustesR.data}
          puedeAjustar={planearR.data === true}
        />
      )}
    </Pagina>
  );
}

function Reuniones({ filas, desde, hoy }: { filas: EstadisticaReunion[]; desde: string; hoy: string }) {
  const hechas = filas.filter((f) => f.status !== "cancelada" && f.meeting_date <= hoy);
  const canceladas = filas.filter((f) => f.status === "cancelada");
  const reprogramadas = filas.filter((f) => f.reprogramaciones > 0);
  const sum = (k: keyof EstadisticaReunion, lista = hechas) => lista.reduce((a, f) => a + (Number(f[k]) || 0), 0);
  const conRespuesta = hechas.filter((f) => f.horas_respuesta !== null);
  const horas = conRespuesta.length ? conRespuesta.reduce((a, f) => a + Number(f.horas_respuesta), 0) / conRespuesta.length : null;
  const marcadas = sum("asistio") + sum("tarde") + sum("ausente");

  const porTipo = new Map<string, { nombre: string; color: string | null; filas: EstadisticaReunion[] }>();
  for (const f of filas) {
    const k = f.meeting_type_id ?? "sin";
    const g = porTipo.get(k) ?? { nombre: f.tipo ?? "Sin tipo", color: f.color, filas: [] };
    g.filas.push(f);
    porTipo.set(k, g);
  }

  if (filas.length === 0) {
    return <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>No hay reuniones del {fechaCorta(desde)} a hoy con estos filtros.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Cifra titulo="Realizadas" valor={hechas.length} detalle={`del ${fechaCorta(desde)} a hoy`} />
        <Cifra titulo="Canceladas" valor={canceladas.length} />
        <Cifra titulo="Reprogramadas" valor={reprogramadas.length} detalle={`${sum("reprogramaciones", filas)} cambios de fecha`} />
        <Cifra titulo="Cobertura" valor={pct(sum("aceptadas"), sum("requeridas"))} detalle={`${sum("aceptadas")} aceptadas de ${sum("requeridas")} requeridas`} />
        <Cifra titulo="Aceptación" valor={pct(sum("aceptadas"), sum("aceptadas") + sum("rechazadas"))} detalle={`${sum("rechazadas")} rechazos · ${sum("pendientes")} sin responder`} />
        <Cifra titulo="Tiempo en responder" valor={horas === null ? "—" : `${Math.round(horas)} h`} detalle="promedio" />
        <Cifra titulo="Asistencia" valor={pct(sum("asistio") + sum("tarde"), marcadas)} detalle={`${sum("tarde")} tarde · ${sum("ausente")} ausentes`} />
        <Cifra titulo="Checklists" valor={pct(sum("checklist_hechos"), sum("checklist_total"))} detalle={`${sum("checklist_hechos")} de ${sum("checklist_total")} puntos`} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Por tipo de reunión</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px]" style={{ color: "var(--color-muted)" }}>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium text-right">Realizadas</th>
                <th className="px-3 py-2 font-medium text-right">Canceladas</th>
                <th className="px-3 py-2 font-medium text-right">Cobertura</th>
                <th className="px-3 py-2 font-medium text-right">Asistencia</th>
                <th className="px-4 py-2 font-medium text-right">Duración real / plan</th>
              </tr>
            </thead>
            <tbody>
              {[...porTipo.values()].sort((a, b) => b.filas.length - a.filas.length).map((g) => {
                const h = g.filas.filter((f) => f.status !== "cancelada" && f.meeting_date <= hoy);
                const s = (k: keyof EstadisticaReunion) => h.reduce((a, f) => a + (Number(f[k]) || 0), 0);
                const conReal = h.filter((f) => f.duracion_real_seg !== null);
                const real = conReal.length ? conReal.reduce((a, f) => a + Number(f.duracion_real_seg), 0) / conReal.length : null;
                const plan = conReal.length ? conReal.reduce((a, f) => a + f.duracion_plan_seg, 0) / conReal.length : null;
                return (
                  <tr key={g.nombre} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><PuntoColor color={g.color} />{g.nombre}</span></td>
                    <td className="px-3 py-2.5 text-right tabular">{h.length}</td>
                    <td className="px-3 py-2.5 text-right tabular">{g.filas.filter((f) => f.status === "cancelada").length}</td>
                    <td className="px-3 py-2.5 text-right tabular">{pct(s("aceptadas"), s("requeridas"))}</td>
                    <td className="px-3 py-2.5 text-right tabular">{pct(s("asistio") + s("tarde"), s("asistio") + s("tarde") + s("ausente"))}</td>
                    <td className="px-4 py-2.5 text-right tabular">{real === null ? "—" : `${minutos(real)} / ${minutos(plan)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Reuniones</h2>
        <ul className="card overflow-hidden">
          {[...filas].reverse().map((f) => (
            <li key={f.meeting_id} className="border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
              <Link href={`/servir/reuniones/${f.meeting_id}`} className="px-4 py-3 flex items-center gap-3 min-h-[56px] card-hover">
                <PuntoColor color={f.color} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium truncate" style={{ color: "var(--color-ink)" }}>{f.name}</span>
                  <span className="block text-[12px]" style={{ color: "var(--color-muted)" }}>
                    {fechaCorta(f.meeting_date)}
                    {f.status === "cancelada" ? ` · Cancelada${f.motivo_cancelacion ? `: ${f.motivo_cancelacion}` : ""}` : ""}
                    {f.reprogramaciones > 0 ? ` · Reprogramada ${f.reprogramaciones === 1 ? "una vez" : `${f.reprogramaciones} veces`}` : ""}
                  </span>
                </span>
                {f.status !== "cancelada" && (
                  <span className="text-[12px] tabular text-right flex-none" style={{ color: "var(--color-muted)" }}>
                    {f.aceptadas}{f.requeridas ? `/${f.requeridas}` : ""} aceptadas
                    <br />
                    {f.asistio + f.tarde} asistieron
                  </span>
                )}
                <Icon name="chevron-right" size={14} style={{ color: "var(--color-faint)" }} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Salud({ filas, ajustes, puedeAjustar }: {
  filas: SaludServidor[];
  ajustes: { sobrecargado_desde: number; alejandose_hasta: number; inactivo_semanas: number; ventana_dias: number } | null;
  puedeAjustar: boolean;
}) {
  const orden: Semaforo[] = ["sobrecargado", "alejandose", "inactivo", "sano"];
  const cuenta = (s: Semaforo) => filas.filter((f) => f.semaforo === s).length;
  const ventana = ajustes?.ventana_dias ?? 30;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {orden.map((s) => (
          <Cifra key={s} titulo={SEMAFORO[s].texto} valor={cuenta(s)} detalle={SEMAFORO[s].ayuda} />
        ))}
      </div>

      {ajustes && (
        <p className="text-[13px] px-1" style={{ color: "var(--color-muted)" }}>
          En los últimos {ventana} días: sobrecargado desde {ajustes.sobrecargado_desde} servicios, alejándose con {ajustes.alejandose_hasta} o menos
          (o si rechaza la mitad o más), inactivo tras {ajustes.inactivo_semanas} semanas sin servir.
        </p>
      )}

      {filas.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>No hay servidores en tu alcance con estos filtros.</p>
      ) : (
        <ul className="card overflow-hidden">
          {[...filas].sort((a, b) => orden.indexOf(a.semaforo) - orden.indexOf(b.semaforo) || a.full_name.localeCompare(b.full_name)).map((f) => (
            <li key={f.person_id} className="border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
              <Link href={`/servir/estadisticas/servidor/${f.person_id}`} className="px-4 py-3 flex items-center gap-3 min-h-[60px] card-hover">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium truncate" style={{ color: "var(--color-ink)" }}>{f.full_name}</span>
                  <span className="block text-[12px] truncate" style={{ color: "var(--color-muted)" }}>
                    {f.departamentos.join(" · ") || "Sin equipo"}
                    {` · ${f.servicios_ventana} en ${ventana} días`}
                    {f.ultima_fecha ? ` · última vez ${fechaCorta(f.ultima_fecha)}` : " · nunca ha servido"}
                    {f.racha_semanas > 1 ? ` · ${f.racha_semanas} semanas seguidas` : ""}
                  </span>
                </span>
                <SemaforoChip s={f.semaforo} />
                <Icon name="chevron-right" size={14} style={{ color: "var(--color-faint)" }} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {puedeAjustar && ajustes && <Ajustes ajustes={ajustes} />}
    </div>
  );
}
