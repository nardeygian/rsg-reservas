"use client";

import { PeriodPicker, Chevron, type PeriodOption } from "@/app/_components/ui/PeriodPicker";
import { CommunitySwitch } from "@/app/_components/ui/CommunitySwitch";

import { useState, useTransition, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  svConteo, svEnPeriodo, svFmt, svHoyISO, svNombreLimpio, svTipo, svDiaLargo,
  enrichReuniones, etiqueta, etiquetaCorta, shiftPeriodo, periodoActual, esFuturo,
  MESES, MES3,
} from "../_lib/sv-logic";
import {
  svSyncAction, svReunionCrearAction,
} from "../actions";
import type { SvData, SvPer, SvReunionUI, SvGrupo, SvMiembro } from "../_lib/types";
import { ReunionSheet } from "./ReunionSheet";
import { ServidorSheet } from "./ServidorSheet";
import { GrupoSheet } from "./GrupoSheet";

type Sheet =
  | null
  | { type: "reunion"; rid: string }
  | { type: "servidor"; sid: string }
  | { type: "grupo"; gid: string };

export function ServicioShell({ svData, canEdit, showCommunity = false }: { svData: SvData; canEdit: boolean; showCommunity?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [per, setPer]         = useState<SvPer>("mes");
  const [{ y, i }, setPeriod] = useState(() => periodoActual("mes"));
  const [svTipoF, setSvTipoF] = useState<"" | "min" | "serv">("");
  const [svQ, setSvQ]         = useState("");
  const [sheet, setSheet]     = useState<Sheet>(null);
  const [toast, setToast]     = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showNueva, setShowNueva]       = useState(false);
  const [showPast, setShowPast]         = useState(false);
  const [nuevaErr, setNuevaErr]         = useState("");
  const [openReuniones, setOpenReuniones] = useState(true);
  const [openServidores, setOpenServidores] = useState(true);

  useEffect(() => {
    const rid = searchParams.get("rid");
    if (rid) setSheet({ type: "reunion", rid });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sheet) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sheet]);


  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function refresh(msg?: string) {
    startTransition(() => { router.refresh(); });
    if (msg) showToast(msg);
  }

  function changePer(p: SvPer) {
    setPer(p);
    setPeriod(periodoActual(p));
  }

  function shiftP(dir: number) {
    const [ny, ni] = shiftPeriodo(per, y, i, dir);
    setPeriod({ y: ny, i: ni });
  }

  const reuniones   = enrichReuniones(svData).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, "es"));
  const hoy         = svHoyISO();
  const reusP       = reuniones.filter(r => svEnPeriodo(r.fecha, per, y, i));
  const reusV       = svTipoF ? reusP.filter(r => svTipo(r) === svTipoF) : reusP;
  const reusHoy     = reuniones.filter(r => r.fecha === hoy).sort((a, b) => svTipo(a).localeCompare(svTipo(b)));
  // Por defecto solo se ven las reuniones de hoy en adelante; las anteriores quedan
  // detrás de "Ver reuniones anteriores". Si el periodo ya pasó, se ven todas.
  const proximas    = reusV.filter(r => r.fecha >= hoy);
  const anteriores  = reusV.filter(r => r.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ocultaPasadas = proximas.length > 0 && anteriores.length > 0;
  const reusLista   = !ocultaPasadas ? reusV : showPast ? [...proximas, ...anteriores] : proximas;
  const primeraPasada = ocultaPasadas && showPast ? anteriores[0]?.id : undefined;
  const sinListadoPasadas = anteriores.filter(r => !r.cargada).length;
  const contT       = svConteo(reusP);
  const cont        = new Map([...contT].filter(([, x]) => x.u.size));

  const tot   = (k: "min" | "serv" | "aus") => [...contT.values()].reduce((a, x) => a + x[k].size, 0);
  const gente = (k: "min" | "serv") => [...cont.values()].filter(x => x[k].size).length;
  const pasadas    = reusP.filter(r => r.fecha <= hoy);
  const nMinReus   = reusP.filter(r => svTipo(r) === "min").length;
  const nServReus  = reusP.filter(r => svTipo(r) === "serv").length;

  const listados = (t: "min" | "serv") => {
    const p = reusP.filter(r => svTipo(r) === t && r.fecha <= hoy);
    return `${p.filter(r => r.cargada).length} de ${p.length} con listado`;
  };

  const servidores = Object.values(svData.servidores)
    .map(s => {
      const x = contT.get(s.id);
      return { s, min: x ? x.min.size : 0, serv: x ? x.serv.size : 0, aus: x ? x.aus.size : 0, roles: x ? [...x.roles] : [], ult: x ? x.ult : "" };
    })
    .sort((a, b) => (b.min + b.serv) - (a.min + a.serv) || a.s.nombre.localeCompare(b.s.nombre, "es"));

  const svQ_norm = svQ.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const servidoresFiltrados = svQ
    ? servidores.filter(f => f.s.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(svQ_norm))
    : servidores;

  async function handleSync() {
    setSyncing(true);
    const r = await svSyncAction();
    setSyncing(false);
    if (r.ok) refresh(`Calendario actualizado: ${r.reuniones} reuniones`);
    else showToast(`Error: ${r.error}`);
  }

  async function handleNuevaReunion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setNuevaErr("");
    try {
      const r = await svReunionCrearAction(fd);
      setShowNueva(false);
      refresh();
      setSheet({ type: "reunion", rid: r.id });
    } catch (err) {
      setNuevaErr((err as Error).message);
    }
  }

  const sync_ts = svData.sync
    ? new Date(svData.sync * 1000).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" })
    : null;

  const estadoSync = svData.sync_error
    ? `Error: ${svData.sync_error}`
    : sync_ts
    ? `Calendario RSG de Asana · actualizado ${sync_ts}`
    : "Calendario RSG de Asana · aún sin sincronizar";

  return (
    <div className="flex flex-col" style={{ maxWidth: 1180, margin: "0 auto" }}>
      {/* Encabezado */}
      <header className="flex flex-col gap-4 px-4 pt-6 pb-3">
        <h1 className="page-title">{showCommunity ? "Comunidad" : "Servicio"}</h1>
        {showCommunity && <CommunitySwitch active="servidores" />}
        <PeriodPicker
          options={[
            { id: "mes", label: "Mes" },
            { id: "trimestre", label: "Trim." },
            { id: "semestre", label: "Sem." },
            { id: "anio", label: "Año" },
          ] as PeriodOption<SvPer>[]}
          value={per}
          onChange={changePer}
          label={etiqueta(per, y, i)}
          onPrev={() => shiftP(-1)}
          onNext={() => shiftP(1)}
          nextDisabled={esFuturo(per, ...shiftPeriodo(per, y, i, 1))}
        />
      </header>

      <div className="flex flex-col gap-4 px-4 pb-24">

        {/* Hoy */}
        <HoyCard reusHoy={reusHoy} hoy={hoy} reuniones={reuniones} onOpen={(rid) => setSheet({ type: "reunion", rid })} canEdit={canEdit} />

        {/* Resumen: bloque de marca, igual que en Inicio y Dar */}
        <section className="brand-hero p-5 flex flex-col gap-4" aria-label={`Servicio en ${etiquetaCorta(per, y, i)}`}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-85">Servicio en {etiquetaCorta(per, y, i)}</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Ministerio",  val: nMinReus,  sub: `${gente("min")} sirvieron` },
              { label: "Servolución", val: nServReus, sub: `${gente("serv")} sirvieron` },
              { label: "Servidores",  val: cont.size, sub: `de ${Object.keys(svData.servidores).length}` },
            ].map(({ label, val, sub }) => (
              <div key={label} className="brand-hero-tile px-3 py-3 flex flex-col gap-0.5 min-w-0">
                <span className="text-[28px] font-semibold leading-none tabular tracking-[-0.03em]">{val}</span>
                <span className="text-[12px] font-medium truncate opacity-90">{label}</span>
                <span className="text-[11px] truncate opacity-70">{sub}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] opacity-75">
            Listados: {listados("min")} en ministerio · {listados("serv")} en Servolución · {tot("aus")} {tot("aus") === 1 ? "ausencia" : "ausencias"} · {reusP.length - pasadas.length} por venir
          </p>
        </section>

        {/* Reuniones */}
        <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className={`px-4 pt-4 pb-3 flex flex-col gap-2 ${openReuniones ? "border-b" : ""}`} style={{ borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="flex items-center gap-2 font-semibold text-[17px] tracking-[-0.01em]" style={{ color: "var(--color-ink)", background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={() => setOpenReuniones(v => !v)} aria-expanded={openReuniones}>
                Reuniones
                <span style={{ color: "var(--color-muted)", transform: openReuniones ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", display: "inline-flex" }}>
                  <Chevron dir="down" />
                </span>
              </button>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button type="button" className="icon-btn" onClick={handleSync} disabled={syncing} aria-label="Actualizar desde el calendario de Asana" title="Actualizar desde el calendario de Asana">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      style={syncing ? { animation: "spin 1s linear infinite" } : undefined}>
                      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
                    </svg>
                  </button>
                  <button type="button" className="icon-btn icon-btn-accent" onClick={() => setShowNueva(v => !v)} aria-label="Agregar reunión" title="Agregar reunión">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              )}
            </div>
            <div className="segmented self-start" role="group" aria-label="Tipo de reunión">
              {(["", "min", "serv"] as const).map(t => (
                <button key={t} type="button" aria-pressed={svTipoF === t} onClick={() => setSvTipoF(t)}>
                  {t === "" ? "Todas" : t === "min" ? "Ministerio" : "Servolución"}
                </button>
              ))}
            </div>
            <p className="text-[12px]" style={{ color: svData.sync_error ? "var(--color-down)" : "var(--color-faint)" }}>{syncing ? "Actualizando…" : estadoSync}</p>
          </div>

          {openReuniones && showNueva && (
            <form onSubmit={handleNuevaReunion} className="flex items-end gap-2 flex-wrap px-4 py-3 border-b" style={{ borderColor: "var(--color-line)", background: "var(--color-bg)" }}>
              <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Nombre</label>
                <input name="nombre" required placeholder="Ej. Reunión Central" className="input text-sm" />
              </div>
              <div className="flex flex-col gap-1 w-[140px]">
                <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Fecha</label>
                <input name="fecha" type="date" required defaultValue={hoy} className="input text-sm" />
              </div>
              <button type="submit" className="btn-primary text-sm px-4 py-2">Agregar</button>
              {nuevaErr && <p className="w-full text-xs" style={{ color: "var(--color-down)" }}>{nuevaErr}</p>}
            </form>
          )}

          {openReuniones && (reusV.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="block sm:hidden divide-y" style={{ borderColor: "var(--color-line)" }}>
                {reusLista.map(r => {
                  const tipo = svTipo(r);
                  const sirv = r.filas.filter(f => !f.aus).length;
                  const aus  = r.filas.filter(f => f.aus).length;
                  return (
                    <Fragment key={r.id}>
                    {r.id === primeraPasada && (
                      <div className="px-4 pt-4 pb-1.5 text-[12px] font-semibold" style={{ color: "var(--color-muted)" }}>Anteriores</div>
                    )}
                    <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" style={{ borderColor: "var(--color-line)" }} onClick={() => setSheet({ type: "reunion", rid: r.id })}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-ink)" }}>{svNombreLimpio(r.nombre)}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{svFmt(r.fecha)} · {tipo === "serv" ? "Servolución" : r.seccion || "Ministerio"}</p>
                      </div>
                      <div className="flex-none text-right">
                        {r.cargada ? (
                          <span className="text-xs font-semibold" style={{ color: "var(--color-up)" }}>{sirv} sirv.{aus > 0 ? <span style={{ color: "var(--color-muted)", fontWeight: "normal" }}> {aus} aus.</span> : ""}</span>
                        ) : r.fecha <= hoy ? (
                          <span className="text-xs font-semibold" style={{ color: "var(--color-gold-text)" }}>Sin listado</span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--color-faint)" }}>Por venir</span>
                        )}
                      </div>
                    </div>
                    </Fragment>
                  );
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                      <th className="text-left px-4 py-2 text-xs font-semibold">Fecha</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold">Reunión</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold">Tipo</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">Listado</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reusLista.map(r => (
                      <Fragment key={r.id}>
                        {r.id === primeraPasada && (
                          <tr><td colSpan={5} className="px-4 pt-4 pb-1.5 text-[12px] font-semibold" style={{ color: "var(--color-muted)" }}>Anteriores</td></tr>
                        )}
                        <ReuniónRow r={r} hoy={hoy} onOpen={() => setSheet({ type: "reunion", rid: r.id })} canEdit={canEdit} />
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {ocultaPasadas && (
                <button type="button" onClick={() => setShowPast(v => !v)}
                  className="w-full px-4 py-3.5 border-t flex items-center justify-center gap-2 text-[14px] font-semibold"
                  style={{ color: "var(--color-accent)" }} aria-expanded={showPast}>
                  {showPast
                    ? "Ocultar reuniones anteriores"
                    : `Ver reuniones anteriores (${anteriores.length})`}
                  {!showPast && sinListadoPasadas > 0 && (
                    <span className="chip chip-gold">{sinListadoPasadas} sin listado</span>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
              No hay actividades{svTipoF ? " de este tipo" : ""} en el periodo.
            </div>
          ))}
        </div>

        {/* Servidores */}
        <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className={`px-4 pt-4 pb-3 flex items-center gap-3 flex-wrap ${openServidores ? "border-b" : ""}`} style={{ borderColor: "var(--color-line)" }}>
            <button type="button" className="flex items-center gap-2 font-bold text-base" style={{ color: "var(--color-ink)", background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={() => setOpenServidores(v => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                style={{ color: "var(--color-muted)", transform: openServidores ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Servidores
            </button>
            {openServidores && (
              <input
                type="search" value={svQ} onChange={e => setSvQ(e.target.value)}
                placeholder="Buscar servidor" aria-label="Buscar servidor"
                className="input text-sm" style={{ maxWidth: 220 }}
              />
            )}
          </div>
          {openServidores && (servidoresFiltrados.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="block sm:hidden divide-y" style={{ borderColor: "var(--color-line)" }}>
                {servidoresFiltrados.map(f => (
                  <div key={f.s.id} className="px-4 py-3 flex items-center gap-3 cursor-pointer" style={{ opacity: f.min + f.serv === 0 ? 0.5 : 1, borderColor: "var(--color-line)" }} onClick={() => setSheet({ type: "servidor", sid: f.s.id })}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-ink)" }}>{f.s.nombre}</p>
                      {f.roles.length > 0 && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-muted)" }}>{f.roles.join(", ")}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-none">
                      {f.min > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>{f.min}</span>}
                      {f.serv > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>{f.serv}</span>}
                      {f.aus > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}>{f.aus}</span>}
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2 flex gap-3 text-xs font-semibold" style={{ background: "var(--color-bg)", color: "var(--color-muted)", borderTop: "2px solid var(--color-line)" }}>
                  <span>{servidoresFiltrados.filter(f => f.min + f.serv > 0).length} sirvieron</span>
                  <span style={{ color: "var(--color-ink)" }}>Reun. {servidoresFiltrados.reduce((a, f) => a + f.min, 0)}</span>
                  <span style={{ color: "var(--color-gold)" }}>Serv. {servidoresFiltrados.reduce((a, f) => a + f.serv, 0)}</span>
                </div>
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                      <th className="text-left px-4 py-2 text-xs font-semibold">Servidor</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">Reuniones</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">Servolución</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">Ausencias</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold">Roles</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold">Último servicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servidoresFiltrados.map(f => (
                      <tr
                        key={f.s.id}
                        className="cursor-pointer hover:bg-[var(--color-bg)] border-t"
                        style={{ borderColor: "var(--color-line)", opacity: f.min + f.serv === 0 ? 0.5 : 1 }}
                        onClick={() => setSheet({ type: "servidor", sid: f.s.id })}
                      >
                        <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--color-ink)" }}>{f.s.nombre}</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: "var(--color-ink)" }}>{f.min}</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: "var(--color-gold)" }}>{f.serv}</td>
                        <td className="px-4 py-2.5 text-right">
                          {f.aus > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}>{f.aus}</span> : <span style={{ color: "var(--color-faint)" }}>0</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-muted)" }}>{f.roles.join(", ") || "—"}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-faint)" }}>{f.ult ? svFmt(f.ult) : "No sirvió en el periodo"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--color-bg)", borderTop: "2px solid var(--color-line)" }}>
                      <td className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--color-muted)" }}>{servidoresFiltrados.filter(f => f.min + f.serv > 0).length} personas sirvieron</td>
                      <td className="px-4 py-2 text-right font-bold text-xs" style={{ color: "var(--color-ink)" }}>{servidoresFiltrados.reduce((a, f) => a + f.min, 0)}</td>
                      <td className="px-4 py-2 text-right font-bold text-xs" style={{ color: "var(--color-gold)" }}>{servidoresFiltrados.reduce((a, f) => a + f.serv, 0)}</td>
                      <td colSpan={3} className="px-4 py-2 text-right font-bold text-xs" style={{ color: "var(--color-down)" }}>{servidoresFiltrados.reduce((a, f) => a + f.aus, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
              {Object.keys(svData.servidores).length ? "Ningún servidor con ese nombre." : "Aún no hay servidores. Aparecen al cargar el listado de una reunión."}
            </div>
          ))}
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 text-sm font-semibold px-4 py-2.5 rounded-[var(--radius-card)] shadow-lg pointer-events-none"
          style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))", background: "var(--color-ink)", color: "var(--color-bg)", maxWidth: 340, textAlign: "center" }}>
          {toast}
        </div>
      )}

      {/* Sheets */}
      {sheet?.type === "reunion" && (
        <ReunionSheet
          rid={sheet.rid}
          svData={svData}
          canEdit={canEdit}
          onClose={() => setSheet(null)}
          onSaved={(msg) => { setSheet(null); refresh(msg); }}
        />
      )}
      {sheet?.type === "servidor" && (
        <ServidorSheet
          sid={sheet.sid}
          svData={svData}
          canEdit={canEdit}
          onClose={() => setSheet(null)}
          onSaved={(msg) => { setSheet(null); refresh(msg); }}
          onOpenReunion={(rid) => setSheet({ type: "reunion", rid })}
        />
      )}
      {sheet?.type === "grupo" && (() => {
        const g = (svData.grupos ?? {})[sheet.gid];
        if (!g) return null;
        const ms = Object.values(svData.miembros ?? {}).filter(m => m.grupo_id === g.id);
        return (
          <GrupoSheet
            grupo={g}
            miembros={ms}
            onClose={() => setSheet(null)}
            onSaved={(msg) => { setSheet(null); refresh(msg); }}
          />
        );
      })()}
    </div>
  );
}

/* ---- HoyCard ---- */
function HoyCard({ reusHoy, hoy, reuniones, onOpen, canEdit }: {
  reusHoy: SvReunionUI[];
  hoy: string;
  reuniones: SvReunionUI[];
  onOpen: (rid: string) => void;
  canEdit: boolean;
}) {
  const listos = reusHoy.filter(r => r.cargada).length;
  const prox   = reuniones.filter(r => r.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  if (!reusHoy.length) {
    return (
      <div className="rounded-[var(--radius-card)] p-4 flex items-center justify-between gap-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Hoy · {svDiaLargo(hoy)}</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
            No hay reuniones para hoy.{prox ? ` La próxima es "${svNombreLimpio(prox.nombre)}", el ${svDiaLargo(prox.fecha).toLowerCase()}.` : ""}
          </p>
        </div>
        {canEdit && (
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-control)] flex-none whitespace-nowrap"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
            onClick={() => { const el = document.querySelector("[data-agregar-reunion]") as HTMLButtonElement; el?.click(); }}>
            Agregar una hoy
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] overflow-hidden" style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}>
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Hoy · {svDiaLargo(hoy)}</p>
          <p className="text-2xl font-bold leading-tight">{reusHoy.length === 1 ? "1 reunión" : `${reusHoy.length} reuniones`}</p>
        </div>
        <div className="flex flex-col items-end gap-1 pt-1">
          <span className="text-xs opacity-80">{listos === reusHoy.length ? "Todos los listados cargados" : `${listos} de ${reusHoy.length} con listado`}</span>
          <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(listos / reusHoy.length * 100)}%`, background: "white" }} />
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2 mt-2">
        {reusHoy.map(r => {
          const sirv = r.filas.filter(f => !f.aus).length;
          const aus  = r.filas.length - sirv;
          const est  = r.cargada ? `${sirv} ${sirv === 1 ? "sirvió" : "sirvieron"}${aus ? ` · ${aus} ${aus === 1 ? "ausente" : "ausentes"}` : ""}` : "Falta el listado";
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2.5" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{svNombreLimpio(r.nombre)}</p>
                <p className="text-xs opacity-75">{svTipo(r) === "serv" ? "Servolución" : r.seccion || "Ministerio"} · {est}</p>
              </div>
              {canEdit && (
                <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-control)] flex-none"
                  style={{ background: r.cargada ? "rgba(255,255,255,0.15)" : "white", color: r.cargada ? "white" : "var(--color-accent)" }}
                  onClick={() => onOpen(r.id)}>
                  {r.cargada ? "Ver" : "Subir listado"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- ReuniónRow ---- */
function ReuniónRow({ r, hoy, onOpen, canEdit }: { r: SvReunionUI; hoy: string; onOpen: () => void; canEdit: boolean }) {
  const sirv = r.filas.filter(f => !f.aus).length;
  const aus  = r.filas.filter(f => f.aus).length;
  const tipo = svTipo(r);

  return (
    <tr
      className="border-t cursor-pointer hover:bg-[var(--color-bg)]"
      style={{ borderColor: "var(--color-line)" }}
      onClick={onOpen}
    >
      <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "var(--color-muted)" }}>{svFmt(r.fecha)}</td>
      <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--color-ink)" }}>{svNombreLimpio(r.nombre)}</td>
      <td className="px-4 py-2.5">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: tipo === "serv" ? "var(--color-gold-soft)" : "var(--color-accent-soft)", color: tipo === "serv" ? "var(--color-gold-text)" : "var(--color-accent)" }}>
          {tipo === "serv" ? "Servolución" : r.seccion || "Ministerio"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-xs">
        {r.cargada ? (
          <span>
            <span className="font-semibold" style={{ color: "var(--color-up)" }}>{sirv} sirvieron</span>
            {aus > 0 && <span className="ml-1 font-semibold" style={{ color: "var(--color-down)" }}>{aus} {aus === 1 ? "ausente" : "ausentes"}</span>}
          </span>
        ) : r.fecha <= hoy ? (
          <span className="font-semibold" style={{ color: "var(--color-gold-text)" }}>Falta el listado</span>
        ) : (
          <span style={{ color: "var(--color-faint)" }}>Por venir</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {canEdit && (
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-control)]"
            style={{ background: r.cargada ? "var(--color-surface-2)" : "var(--color-accent)", color: r.cargada ? "var(--color-ink)" : "var(--color-accent-ink)", border: r.cargada ? "1px solid var(--color-line)" : "none" }}
            onClick={e => { e.stopPropagation(); onOpen(); }}>
            {r.cargada ? "Ver" : "Subir listado"}
          </button>
        )}
      </td>
    </tr>
  );
}
