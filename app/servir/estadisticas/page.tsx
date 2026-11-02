import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
import type { EstadisticaReunion, SaludServidor, Semaforo } from "@/lib/servir/contratos";
import { fechaCorta, hoyBogota, sumarDias } from "@/app/servir/reuniones/_lib/fechas";
import { Encabezado, Pagina, PuntoColor, SinAcceso } from "@/app/servir/reuniones/_components/ui";
import { FiltrosEstadisticas } from "./_components/FiltrosEstadisticas";
import { PERIODOS } from "./_lib/periodos";
import { Cifra, SEMAFORO, SemaforoChip, minutos, pct } from "./_components/ui";
import { Ajustes } from "./_components/Ajustes";
import { AnalisisAtrasos } from "./_components/AnalisisAtrasos";
import { MOTIVOS } from "@/app/servir/reuniones/_components/ReporteReunion";

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
  const vista = p.vista === "salud" ? "salud" : p.vista === "atrasos" ? "atrasos" : "reuniones";
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
          <Link href={qs("atrasos")} className="segmented-link" aria-current={vista === "atrasos" ? "page" : undefined}>Atrasos</Link>
        </nav>
        <FiltrosEstadisticas tipos={tiposR.data ?? []} departamentos={depsR.data ?? []} conTipo={vista === "reuniones"} />
      </div>

      {vista === "atrasos" ? (
        <Atrasos desde={desde} hoy={hoy} />
      ) : vista === "reuniones" ? (
        <Reuniones
          filas={(await db.rpc("estadisticas_reuniones", {
            p_desde: desde, p_hasta: hoy,
            ...(tipoId ? { p_meeting_type_id: tipoId } : {}),
            ...(depId ? { p_ministry_id: depId } : {}),
          })).data ?? []}
          desde={desde}
          hoy={hoy}
        />
      ) : null}
      {vista === "reuniones" && <AsistentesPeriodo desde={desde} hoy={hoy} tipoId={tipoId} />}
      {vista === "salud" && (
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
        <Cifra titulo="Aceptación" valor={pct(sum("aceptadas"), sum("aceptadas") + sum("rechazadas"))} detalle={`${sum("rechazadas")} ${sum("rechazadas") === 1 ? "rechazo" : "rechazos"} · ${sum("pendientes")} sin responder`} />
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

// Atrasos por motivo: lo que se registra al sumar minutos en vivo. Abajo, el
// último informe de Claude del periodo y el botón para pedir uno nuevo.
async function Atrasos({ desde, hoy }: { desde: string; hoy: string }) {
  const db = await createClient();
  const [{ data: porMotivo }, { data: motivos }, { data: informes }] = await Promise.all([
    db.rpc("estadisticas_atrasos", { p_desde: desde, p_hasta: hoy }),
    db.rpc("motivos_atraso", { p_desde: desde, p_hasta: hoy }),
    db.from("delay_reports").select("id, desde, hasta, content, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(1),
  ]);
  const filas = porMotivo ?? [];
  const total = filas.reduce((a, f) => a + (f.minutos ?? 0), 0);
  const reuniones = new Set((motivos ?? []).map((m) => `${m.fecha}|${m.reunion}`)).size;
  const etiqueta = (c: string) => MOTIVOS.find((m) => m.value === c)?.label ?? "Sin motivo";
  const informe = informes?.[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Cifra titulo="Minutos de atraso" valor={total} detalle={`desde ${fechaCorta(desde)}`} />
        <Cifra titulo="Reuniones con atraso" valor={reuniones} />
        <Cifra titulo="Causa principal" valor={filas[0] ? etiqueta(filas[0].categoria) : "—"} detalle={filas[0] ? `${filas[0].minutos} min` : undefined} />
      </div>

      <section className="card p-4 md:p-5 flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Por motivo</h2>
        {filas.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
            Todavía no hay atrasos con motivo en este periodo. Se registran al sumar minutos o anunciar un atraso en vivo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filas.map((f) => (
              <li key={f.categoria} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span style={{ color: "var(--color-ink)" }}>{etiqueta(f.categoria)}</span>
                  <span className="tabular" style={{ color: "var(--color-muted)" }}>{f.minutos} min · {f.veces} {f.veces === 1 ? "vez" : "veces"}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${total ? Math.max(4, (100 * f.minutos) / total) : 0}%`, background: "var(--color-gold-text)" }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 md:p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold">Análisis</h2>
          <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            Lee los motivos y las notas del periodo y propone qué cambiar. Se guarda; pide uno nuevo cuando haya más reuniones.
          </p>
        </div>
        <AnalisisAtrasos desde={desde} hasta={hoy} hayDatos={(motivos ?? []).length > 0} />
        {informe && (
          <article className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
            <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>
              {fechaCorta(informe.desde)} a {fechaCorta(informe.hasta)} · pedido por {(informe.profiles as { full_name: string | null } | null)?.full_name ?? "alguien"}
            </p>
            <div className="text-[14px] whitespace-pre-line leading-relaxed" style={{ color: "var(--color-ink)" }}>{informe.content}</div>
          </article>
        )}
      </section>

      {(motivos ?? []).length > 0 && (
        <section className="card p-4 md:p-5 flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">Detalle</h2>
          <ul className="flex flex-col">
            {(motivos ?? []).slice(0, 50).map((m, i) => (
              <li key={i} className="flex gap-3 py-1.5 text-[13px] border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
                <span className="tabular flex-none w-[56px]" style={{ color: "var(--color-muted)" }}>{fechaCorta(m.fecha)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ color: "var(--color-ink)" }}>+{m.minutos} min · {etiqueta(m.categoria)}{m.nota ? `: ${m.nota}` : ""}</span>
                  <span className="block" style={{ color: "var(--color-muted)" }}>{m.reunion}{m.punto ? ` · ${m.punto}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Asistentes de cada reunión del día (lo registra Protocolo en vivo). Por
// tipo: promedio de la primera, segunda… reunión; y las últimas fechas.
async function AsistentesPeriodo({ desde, hoy, tipoId }: { desde: string; hoy: string; tipoId?: string }) {
  const db = await createClient();
  const { data } = await db.rpc("asistentes_reuniones", { p_desde: desde, p_hasta: hoy });
  const filas = (data ?? []).filter((f) => !tipoId || f.meeting_type_id === tipoId);
  if (filas.length === 0) {
    return (
      <section className="card p-4 md:p-5 flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold">Asistentes</h2>
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          Todavía no hay asistentes registrados en este periodo. Los registra el líder de Protocolo en vivo, al terminar cada reunión.
        </p>
      </section>
    );
  }
  const total = filas.reduce((a, f) => a + f.asistentes, 0);
  const promedio = Math.round(total / filas.length);
  const porDia = new Map<string, { fecha: string; reunion: string; jornadas: { titulo: string; n: number; asistentes: number }[] }>();
  for (const f of filas) {
    const d = porDia.get(f.meeting_id) ?? { fecha: f.fecha, reunion: f.reunion, jornadas: [] };
    d.jornadas.push({ titulo: f.jornada, n: f.n, asistentes: f.asistentes });
    porDia.set(f.meeting_id, d);
  }
  const porTipo = new Map<string, Map<number, number[]>>();
  for (const f of filas) {
    const t = porTipo.get(f.tipo ?? "Sin tipo") ?? new Map<number, number[]>();
    t.set(f.n, [...(t.get(f.n) ?? []), f.asistentes]);
    porTipo.set(f.tipo ?? "Sin tipo", t);
  }
  const prom = (l: number[]) => Math.round(l.reduce((a, b) => a + b, 0) / l.length);

  return (
    <section className="card p-4 md:p-5 flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold">Asistentes</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Cifra titulo="Asistentes en el periodo" valor={total} detalle={`${porDia.size} ${porDia.size === 1 ? "fecha" : "fechas"}`} />
        <Cifra titulo="Promedio por reunión" valor={promedio} detalle={`${filas.length} reuniones con conteo`} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="eyebrow">Promedio por tipo</h3>
        <ul className="flex flex-col">
          {[...porTipo].map(([tipo, js]) => (
            <li key={tipo} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-[14px] border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
              <span style={{ color: "var(--color-ink)" }}>{tipo}</span>
              <span className="tabular" style={{ color: "var(--color-muted)" }}>
                {[...js].sort(([a], [b]) => a - b).map(([n, l]) => js.size > 1 ? `${n}.ª ${prom(l)}` : `${prom(l)}`).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="eyebrow">Últimas fechas</h3>
        <ul className="flex flex-col">
          {[...porDia.values()].slice(0, 12).map((d, i) => (
            <li key={i} className="flex gap-3 py-1.5 text-[13px] border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
              <span className="tabular flex-none w-[64px]" style={{ color: "var(--color-muted)" }}>{fechaCorta(d.fecha)}</span>
              <span className="flex-1 min-w-0 truncate" style={{ color: "var(--color-ink)" }}>{d.reunion}</span>
              <span className="tabular flex-none" style={{ color: "var(--color-ink)" }}>
                {d.jornadas.sort((a, b) => a.n - b.n).map((j) => j.asistentes).join(" + ")}
                {d.jornadas.length > 1 ? ` = ${d.jornadas.reduce((a, j) => a + j.asistentes, 0)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
