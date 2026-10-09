"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  svConteo, svEnPeriodo, svFmt, svHoyISO, svNombreLimpio, svTipo, svDiaLargo,
  enrichReuniones, etiqueta, etiquetaCorta, shiftPeriodo, periodoActual, esFuturo,
  MESES, MES3,
} from "../_lib/sv-logic";
import {
  svSyncAction, svReunionCrearAction,
} from "../actions";
import type { SvData, SvPer, SvReunionUI } from "../_lib/types";
import { ReunionSheet } from "./ReunionSheet";
import { ServidorSheet } from "./ServidorSheet";

type Sheet =
  | null
  | { type: "reunion"; rid: string }
  | { type: "servidor"; sid: string };

export function ServicioShell({ svData, canEdit }: { svData: SvData; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [per, setPer]         = useState<SvPer>("mes");
  const [{ y, i }, setPeriod] = useState(() => periodoActual("mes"));
  const [svTipoF, setSvTipoF] = useState<"" | "min" | "serv">("");
  const [svQ, setSvQ]         = useState("");
  const [sheet, setSheet]     = useState<Sheet>(null);
  const [toast, setToast]     = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [nuevaErr, setNuevaErr]   = useState("");

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
  const contT       = svConteo(reusP);
  const cont        = new Map([...contT].filter(([, x]) => x.u.size));

  const tot   = (k: "min" | "serv" | "aus") => [...contT.values()].reduce((a, x) => a + x[k].size, 0);
  const gente = (k: "min" | "serv") => [...cont.values()].filter(x => x[k].size).length;
  const pasadas = reusP.filter(r => r.fecha <= hoy);

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
    <div className="flex flex-col" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Period bar */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 flex-wrap">
        {/* Per selector */}
        <div className="flex rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
          {(["mes", "trimestre", "semestre", "anio"] as SvPer[]).map(p => (
            <button
              key={p}
              type="button"
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                background: per === p ? "var(--color-accent)" : "var(--color-surface)",
                color: per === p ? "var(--color-accent-ink)" : "var(--color-muted)",
              }}
              onClick={() => changePer(p)}
            >
              {p === "mes" ? "Mes" : p === "trimestre" ? "Trim." : p === "semestre" ? "Sem." : "Año"}
            </button>
          ))}
        </div>
        {/* Prev / label / next */}
        <div className="flex items-center gap-2">
          <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }} onClick={() => shiftP(-1)}>‹</button>
          <span className="text-sm font-semibold min-w-[120px] text-center" style={{ color: "var(--color-ink)" }}>{etiqueta(per, y, i)}</span>
          <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }} onClick={() => shiftP(1)} disabled={esFuturo(per, ...shiftPeriodo(per, y, i, 1))}>›</button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-24">

        {/* Hoy */}
        <HoyCard reusHoy={reusHoy} hoy={hoy} reuniones={reuniones} onOpen={(rid) => setSheet({ type: "reunion", rid })} canEdit={canEdit} />

        {/* Resumen */}
        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className="px-4 pt-4 pb-2 border-b" style={{ borderColor: "var(--color-line)" }}>
            <h2 className="font-bold text-base" style={{ color: "var(--color-ink)" }}>Servicio en {etiquetaCorta(per, y, i)}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>Varios roles en una reunión cuentan como un solo servicio</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
            {[
              { label: "Reuniones de ministerio", val: tot("min"), sub: `servicios · ${gente("min")} personas · ${listados("min")}`, color: "var(--color-accent)" },
              { label: "Servolución",              val: tot("serv"), sub: `servicios · ${gente("serv")} personas · ${listados("serv")}`, color: "var(--color-gold)" },
              { label: "Personas que sirvieron",  val: cont.size, sub: `de ${Object.keys(svData.servidores).length} servidores · ${tot("aus")} ${tot("aus") === 1 ? "ausencia" : "ausencias"} · ${reusP.length - pasadas.length} por venir`, color: "var(--color-ink)" },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="px-4 py-3 flex flex-col gap-0.5">
                <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>{label}</span>
                <span className="text-3xl font-bold leading-none" style={{ color }}>{val}</span>
                <span className="text-xs" style={{ color: "var(--color-faint)" }}>{sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reuniones */}
        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className="px-4 pt-4 pb-3 border-b flex flex-col gap-2" style={{ borderColor: "var(--color-line)" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-bold text-base" style={{ color: "var(--color-ink)" }}>Reuniones y actividades</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Type filter */}
                <div className="flex rounded-[8px] overflow-hidden text-xs" style={{ border: "1px solid var(--color-line)" }}>
                  {(["", "min", "serv"] as const).map(t => (
                    <button key={t} type="button"
                      className="px-2.5 py-1.5 font-semibold"
                      style={{ background: svTipoF === t ? "var(--color-accent)" : "var(--color-surface)", color: svTipoF === t ? "var(--color-accent-ink)" : "var(--color-muted)" }}
                      onClick={() => setSvTipoF(t)}
                    >{t === "" ? "Todas" : t === "min" ? "Ministerio" : "Servolución"}</button>
                  ))}
                </div>
                {canEdit && (
                  <>
                    <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[8px]" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }} onClick={handleSync} disabled={syncing}>
                      {syncing ? "Actualizando…" : "Actualizar calendario"}
                    </button>
                    <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[8px]" style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }} onClick={() => setShowNueva(v => !v)}>
                      Agregar reunión
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs" style={{ color: svData.sync_error ? "var(--color-down)" : "var(--color-muted)" }}>{estadoSync}</p>
          </div>

          {showNueva && (
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

          {reusV.length > 0 ? (
            <div className="overflow-x-auto">
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
                  {reusV.map(r => (
                    <ReuniónRow key={r.id} r={r} hoy={hoy} onOpen={() => setSheet({ type: "reunion", rid: r.id })} canEdit={canEdit} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
              No hay actividades{svTipoF ? " de este tipo" : ""} en el periodo.
            </div>
          )}
        </div>

        {/* Servidores */}
        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className="px-4 pt-4 pb-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: "var(--color-line)" }}>
            <h2 className="font-bold text-base flex-1" style={{ color: "var(--color-ink)" }}>Servidores</h2>
            <input
              type="search" value={svQ} onChange={e => setSvQ(e.target.value)}
              placeholder="Buscar servidor" aria-label="Buscar servidor"
              className="input text-sm" style={{ maxWidth: 220 }}
            />
          </div>
          {servidoresFiltrados.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                    <th className="text-left px-4 py-2 text-xs font-semibold">Servidor</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold">Reuniones</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold">Servolución</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold">Ausencias</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold hidden sm:table-cell">Roles</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold hidden sm:table-cell">Último servicio</th>
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
                      <td className="px-4 py-2.5 text-xs hidden sm:table-cell" style={{ color: "var(--color-muted)" }}>{f.roles.join(", ") || "—"}</td>
                      <td className="px-4 py-2.5 text-xs hidden sm:table-cell" style={{ color: "var(--color-faint)" }}>{f.ult ? svFmt(f.ult) : "No sirvió en el periodo"}</td>
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
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
              {Object.keys(svData.servidores).length ? "Ningún servidor con ese nombre." : "Aún no hay servidores. Aparecen al cargar el listado de una reunión."}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-sm font-semibold px-4 py-2.5 rounded-[12px] shadow-lg pointer-events-none"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)", maxWidth: 340, textAlign: "center" }}>
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
      <div className="rounded-[16px] p-4 flex items-center justify-between gap-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Hoy · {svDiaLargo(hoy)}</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
            No hay reuniones para hoy.{prox ? ` La próxima es "${svNombreLimpio(prox.nombre)}", el ${svDiaLargo(prox.fecha).toLowerCase()}.` : ""}
          </p>
        </div>
        {canEdit && (
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[8px] flex-none whitespace-nowrap"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
            onClick={() => { const el = document.querySelector("[data-agregar-reunion]") as HTMLButtonElement; el?.click(); }}>
            Agregar una hoy
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}>
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
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{svNombreLimpio(r.nombre)}</p>
                <p className="text-xs opacity-75">{svTipo(r) === "serv" ? "Servolución" : r.seccion || "Ministerio"} · {est}</p>
              </div>
              {canEdit && (
                <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[8px] flex-none"
                  style={{ background: r.cargada ? "rgba(255,255,255,0.15)" : "white", color: r.cargada ? "white" : "var(--color-accent)" }}
                  onClick={() => onOpen(r.id)}>
                  {r.cargada ? "Ver o corregir" : "Subir listado"}
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
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
            style={{ background: r.cargada ? "var(--color-surface-2)" : "var(--color-accent)", color: r.cargada ? "var(--color-ink)" : "var(--color-accent-ink)", border: r.cargada ? "1px solid var(--color-line)" : "none" }}
            onClick={e => { e.stopPropagation(); onOpen(); }}>
            {r.cargada ? "Ver o corregir" : "Subir listado"}
          </button>
        )}
      </td>
    </tr>
  );
}
