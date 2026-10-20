"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Donacion } from "../_lib/types";
import type { SvGrupo, SvMiembro } from "@/app/servicio/_lib/types";
import {
  CONCEPTOS, MES3, money, moneyShort, suma, donantes, esDar, esEfe,
  metodo, fmtFecha, ordenConcepto, cap, niceMax,
  donDe, shiftDon, periodoActualDon, etiquetaDon, esFuturoDon, chartData,
  type DonPer,
} from "../_lib/don-logic";

// ── Types ──────────────────────────────────────────────────────────────────

type Sheet =
  | null
  | { type: "listado"; filtros?: Partial<{ o: string; t: string; gid: string; k: string; titulo: string }> }
  | { type: "grupo"; gid: string }
  | { type: "importar" };

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number) { return v.toFixed(1).replace(".", ",") + "%"; }
function cssPct(v: number) { return v.toFixed(2) + "%"; }

function BarRow({ label, value, total, n }: { label: string; value: number; total: number; n: number }) {
  const p = total ? (value / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline gap-3 text-sm">
        <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
          {money(value)} <span style={{ color: "var(--color-faint)" }}>· {pct(p)} · {n}</span>
        </span>
      </div>
      <div className="h-[8px] rounded-full overflow-hidden" style={{ background: "var(--color-line)" }}>
        <div className="h-full rounded-full" style={{ width: cssPct(p), background: "var(--color-accent)" }} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DonacionesShell({
  donaciones: allDon,
  grupos,
  miembros,
  readOnly = false,
}: {
  donaciones: Donacion[];
  grupos: SvGrupo[];
  miembros: SvMiembro[];
  readOnly?: boolean;
}) {
  const [per, setPer]         = useState<DonPer>("mes");
  const [{ y, i }, setPeriod] = useState<{ y: number; i: number }>(() => {
    const actual = periodoActualDon("mes");
    if (allDon.length === 0) return actual;
    if (donDe(allDon, "mes", actual.y, actual.i).length > 0) return actual;
    // Retroceder hasta encontrar un mes con datos (máx 24 meses)
    let { y, i } = actual;
    for (let n = 0; n < 24; n++) {
      [y, i] = shiftDon("mes", y, i, -1);
      if (donDe(allDon, "mes", y, i).length > 0) return { y, i };
    }
    return actual;
  });
  const [origen, setOrigen]   = useState<"todo" | "dar" | "form">("todo");
  const [rankTab, setRankTab] = useState<"monto" | "frecuencia">("monto");
  const [sheet, setSheet]     = useState<Sheet>(null);
  const [sheetQ, setSheetQ]   = useState("");
  const [sheetO, setSheetO]   = useState("");
  const [sheetT, setSheetT]   = useState("");
  const [sheetG, setSheetG]   = useState("");
  const [sheetAllDon, setSheetAllDon]         = useState(false);
  const [sheetCustomLista, setSheetCustomLista] = useState<Donacion[] | null>(null);
  const [toast, setToast]       = useState<string | null>(null);
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [, startTransition]     = useTransition();

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }
  function closeSheet() { setSheet(null); setSheetAllDon(false); setSheetCustomLista(null); }
  function openCustomSheet(customLista: Donacion[], titulo: string) {
    setSheetQ(""); setSheetO(""); setSheetT(""); setSheetG("");
    setSheetAllDon(false);
    setSheetCustomLista(customLista);
    setSheet({ type: "listado", filtros: { titulo } });
  }
  function changePer(p: DonPer) {
    setPer(p);
    const actual = periodoActualDon(p);
    if (allDon.length === 0 || donDe(allDon, p, actual.y, actual.i).length > 0) { setPeriod(actual); return; }
    let { y, i } = actual;
    for (let n = 0; n < 24; n++) {
      [y, i] = shiftDon(p, y, i, -1);
      if (donDe(allDon, p, y, i).length > 0) { setPeriod({ y, i }); return; }
    }
    setPeriod(actual);
  }
  function shiftP(dir: number) { const [ny, ni] = shiftDon(per, y, i, dir); setPeriod({ y: ny, i: ni }); }
  const nextShift = shiftDon(per, y, i, 1);

  const grupoMap = new Map(grupos.map((g) => [g.id, g]));
  // Enriquece con nombre de grupo
  const don = allDon.map((d) => ({ ...d, g: d.gid ? (grupoMap.get(d.gid)?.nombre ?? "") : "" }));

  function pasaOrigen(d: Donacion) {
    if (origen === "todo") return true;
    if (origen === "dar") return esDar(d) || esEfe(d); // Módulo Dar + efectivo
    return !esDar(d) && !esEfe(d); // "form": otros (camisetas, eventos…)
  }
  function donDePer(overrideOrigen = false) {
    return donDe(don, per, y, i).filter((d) => overrideOrigen || pasaOrigen(d));
  }

  const lista = donDePer();
  const [py, pi] = shiftDon(per, y, i, -1);
  const listaPrev = donDe(don, per, py, pi).filter(pasaOrigen);
  const total = suma(lista), totalPrev = suma(listaPrev);
  const delta = totalPrev > 0 ? ((total - totalPrev) / totalPrev) * 100 : null;
  const { bars, labels, title: chartTitle } = chartData(lista, per, y, i);
  const chartMax = Math.max(...bars.map((b) => b.v), 1);

  // ── Filtered list for sheet ──────────────────────────────────────────────
  function listadoFiltrado(f?: Sheet & { type: "listado" }) {
    const filtros = f?.filtros ?? {};
    // sheetCustomLista: pre-filtered list (En línea card, Efectivo card, registry donor)
    // sheetAllDon: bypass period filter (legacy, kept for future use)
    const base = sheetCustomLista ?? (sheetAllDon ? don : donDePer(!!filtros.o));
    return base.filter((d) =>
      (sheetCustomLista ? true : (!filtros.k || d.k === filtros.k)) &&
      (!filtros.o   || d.o  === filtros.o) &&
      (!filtros.t   || d.t  === filtros.t) &&
      (!filtros.gid || d.gid === filtros.gid) &&
      (!sheetQ || (d.n + " " + d.id + " " + (d.ref ?? "") + " " + metodo(d.met) + " " + (d.e ?? "") + " " + (d.doc ?? "")).toLowerCase().includes(sheetQ.toLowerCase())) &&
      (!sheetO || d.o === sheetO) &&
      (!sheetT || d.t === sheetT) &&
      (!sheetG || (sheetG === "__sin__" ? !d.gid : d.gid === sheetG))
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const etiq = etiquetaDon(per, y, i);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <span className="eyebrow">Donaciones RSG</span>
          <h1 className="text-[22px] font-semibold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>
            Módulo Dar
          </h1>
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
              onClick={() => setSheet({ type: "importar" })}
            >
              Importar datos
            </button>
            <VincularBtn onDone={(msg) => showToast(msg)} />
          </>
        )}
      </div>

      {/* ── Period controls ──────────────────────────────────────────────── */}
      <div className="px-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
            {(["mes","trimestre","semestre","anio"] as DonPer[]).map((p) => (
              <button key={p} type="button" onClick={() => changePer(p)}
                className="px-3 py-1.5 text-xs font-semibold"
                style={{ background: per === p ? "var(--color-accent)" : "var(--color-surface)", color: per === p ? "var(--color-accent-ink)" : "var(--color-muted)" }}
              >
                {p === "mes" ? "Mes" : p === "trimestre" ? "Trim." : p === "semestre" ? "Sem." : "Año"}
              </button>
            ))}
          </div>
          {/* Origen filter */}
          <div className="flex rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
            {(["todo","dar","form"] as const).map((o) => (
              <button key={o} type="button" onClick={() => setOrigen(o)}
                className="px-3 py-1.5 text-xs font-semibold"
                style={{ background: origen === o ? "var(--color-surface-2)" : "var(--color-surface)", color: origen === o ? "var(--color-ink)" : "var(--color-muted)" }}
              >
                {o === "todo" ? "Todo" : o === "dar" ? "Diezmos y ofrendas" : "Formularios"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftP(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-[8px] border text-lg"
            style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          >‹</button>
          <span className="text-sm font-semibold min-w-[160px] text-center" style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>
            {etiq}
          </span>
          <button type="button" onClick={() => shiftP(1)}
            className="w-9 h-9 flex items-center justify-center rounded-[8px] border text-lg"
            style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
            disabled={esFuturoDon(per, nextShift[0], nextShift[1])}
          >›</button>
        </div>
      </div>

      <div className="px-4 pb-24 flex flex-col gap-4">
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.4fr)" }}>
          {/* Total card */}
          <button
            type="button"
            className="rounded-[16px] p-5 flex flex-col gap-3 text-left w-full"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
            onClick={() => { setSheetQ(""); setSheetO(""); setSheetT(""); setSheetG(""); setSheet({ type: "listado" }); }}
          >
            <span className="text-xs font-semibold opacity-80 uppercase tracking-wide">
              {origen === "dar" ? "Diezmos y ofrendas" : origen === "form" ? "Formularios" : "Recaudado"} en el {PER_LABEL[per]}
            </span>
            <span className="font-bold leading-none" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,6vw,44px)" }}>
              {money(total)}
            </span>
            {delta !== null ? (
              <span className="text-sm flex items-center gap-2">
                <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                  {delta >= 0 ? "+" : ""}{delta.toFixed(1).replace(".", ",")}%
                </span>
                <span className="opacity-80">frente a {etiquetaDon(per, py, pi).split(" · ")[0]} ({moneyShort(totalPrev)})</span>
              </span>
            ) : (
              <span className="text-sm opacity-70">Sin datos del periodo anterior</span>
            )}
            <div className="grid grid-cols-3 gap-px rounded-[10px] overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.2)" }}>
              {[
                { label: "donaciones", value: lista.length.toLocaleString("es-CO") },
                { label: "donantes",   value: donantes(lista).toLocaleString("es-CO") },
                { label: "promedio",   value: moneyShort(lista.length ? total / lista.length : 0) },
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-2.5 flex flex-col gap-1" style={{ background: "rgba(0,0,0,0.12)" }}>
                  <span className="font-bold text-[15px]" style={{ fontFamily: "var(--font-display)" }}>{value}</span>
                  <span className="text-[11px] opacity-80">{label}</span>
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold opacity-80 flex items-center gap-1">
              Ver registro completo →
            </span>
          </button>

          {/* Chart */}
          <div className="rounded-[16px] p-5 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{chartTitle}</span>
              {bars.length > 0 && (
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {(() => { const best = bars.reduce((a, b) => b.v > a.v ? b : a, bars[0]); return best.v ? "Mayor: " + best.t + " · " + moneyShort(best.v) : "Sin donaciones"; })()}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: bars.length * 22 }}>
                <div className="relative flex items-end gap-[3px] border-b" style={{ height: 200, borderColor: "var(--color-line)", paddingTop: 48 }}>
                  {/* guide lines */}
                  <div className="absolute left-0 right-0 top-0 text-[10px] flex flex-col justify-between h-full pointer-events-none">
                    <span style={{ color: "var(--color-faint)" }}>{moneyShort(chartMax)}</span>
                    <span style={{ color: "var(--color-faint)" }}>{moneyShort(chartMax / 2)}</span>
                  </div>
                  {bars.map((b, idx) => {
                    const isActive = activeBar === idx;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col justify-end h-full relative group"
                        style={{ minWidth: 18, cursor: b.v > 0 ? "pointer" : "default" }}
                        onClick={() => b.v > 0 && setActiveBar(isActive ? null : idx)}
                      >
                        {b.v > 0 && (
                          <div
                            className="rounded-t-[3px] transition-opacity"
                            style={{
                              height: `${Math.sqrt(b.v / chartMax) * 100}%`,
                              background: "var(--color-accent)",
                              minHeight: 10,
                              opacity: activeBar !== null && !isActive ? 0.4 : 1,
                            }}
                          />
                        )}
                        {b.v > 0 && (
                          <div
                            className={`absolute top-1 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap text-[11px] font-semibold px-2 py-1.5 rounded-[6px] pointer-events-none transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
                          >
                            {b.t}<br />{money(b.v)} · {b.n} {b.n === 1 ? "aporte" : "aportes"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-[3px] mt-1" style={{ fontSize: 10, color: "var(--color-faint)" }}>
                  {labels.map((l, k) => <span key={k} className="flex-1 text-center truncate" style={{ minWidth: 18 }}>{l}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Por vincular ─────────────────────────────────────────────── */}
        {!readOnly && <CardPorVincular donaciones={allDon} miembros={miembros} grupos={grupos} />}

        {/* ── Conceptos ────────────────────────────────────────────────── */}
        <CardConceptos lista={lista.filter((d) => esDar(d) || esEfe(d))} onFilter={(t) => { setSheetQ(""); setSheetO(""); setSheetT(t); setSheetG(""); setSheet({ type: "listado", filtros: { t, titulo: t } }); }} />

        {/* ── En línea y efectivo ──────────────────────────────────────── */}
        <CardEfectivo
          lista={lista}
          etiq={cap(etiq.split(" · ")[0])}
          onOpen={(subLista, titulo) => openCustomSheet(subLista.slice().sort((a, b) => b.f.localeCompare(a.f)), titulo)}
        />

        {/* ── Discipulados ─────────────────────────────────────────────── */}
        <CardGrupos
          lista={donDePer(true).filter((d) => esDar(d) || esEfe(d))}
          grupos={grupos}
          miembros={miembros}
          etiq={cap(etiq.split(" · ")[0])}
          onGrupo={(gid) => { setSheetQ(""); setSheetO(""); setSheetT(""); setSheetG(""); setSheet({ type: "grupo", gid }); }}
        />

        {/* ── Ranking ──────────────────────────────────────────────────── */}
        <CardRanking
          lista={lista}
          etiq={cap(etiq.split(" · ")[0])}
          rankTab={rankTab}
          onRankTab={setRankTab}
          onDonante={(k, n) => { setSheetQ(""); setSheetO(""); setSheetT(""); setSheetG(""); setSheetAllDon(false); setSheet({ type: "listado", filtros: { k, titulo: n } }); }}
        />

        {/* ── Registro global de donantes ──────────────────────────────── */}
        <CardRegistroDonantes
          lista={lista}
          onDonante={(subLista, nombre) => openCustomSheet(subLista.slice().sort((a, b) => b.f.localeCompare(a.f)), nombre)}
        />
      </div>

      {/* ── Sheet ───────────────────────────────────────────────────────── */}
      {sheet && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.45)" }} onClick={closeSheet} />
          <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col" style={{ width: "min(640px, 100vw)", background: "var(--color-bg)", boxShadow: "-8px 0 30px rgba(0,0,0,0.2)" }}>

            {/* Sheet header */}
            <div className="flex-none px-5 pt-5 pb-4 border-b flex flex-col gap-3" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="eyebrow mb-0.5">{sheet.type === "importar" ? "Administración" : sheetAllDon ? "Historial completo" : "Registro · " + etiq}</p>
                  <h2 className="font-bold text-lg" style={{ color: "var(--color-ink)" }}>
                    {sheet.type === "importar" ? "Importar donaciones" : sheet.type === "grupo" ? (grupoMap.get(sheet.gid)?.nombre ?? "Grupo") : ((sheet as { type: "listado"; filtros?: { titulo?: string } }).filtros?.titulo ?? "Donaciones")}
                  </h2>
                </div>
                <button onClick={closeSheet} className="w-8 h-8 flex items-center justify-center rounded-full text-xl flex-none" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>×</button>
              </div>
              {sheet.type === "listado" && (
                <div className="flex gap-2 flex-wrap">
                  <input value={sheetQ} onChange={(e) => setSheetQ(e.target.value)} placeholder="Buscar donante, referencia o método" className="input flex-1 text-sm" style={{ minWidth: 180 }} />
                  <select value={sheetO} onChange={(e) => setSheetO(e.target.value)} className="input text-sm">
                    <option value="">Todos los orígenes</option>
                    {[...new Set(donDePer(true).map((d) => d.o))].sort().map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={sheetT} onChange={(e) => setSheetT(e.target.value)} className="input text-sm">
                    <option value="">Todos los conceptos</option>
                    {[...new Set(lista.map((d) => d.t))].sort((a, b) => ordenConcepto(a) - ordenConcepto(b)).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={sheetG} onChange={(e) => setSheetG(e.target.value)} className="input text-sm">
                    <option value="">Todos los discipulados</option>
                    {grupos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    <option value="__sin__">Sin discipulado</option>
                  </select>
                </div>
              )}
            </div>

            {/* Sheet body */}
            <div className="flex-1 overflow-auto">
              {sheet.type === "importar" && (
                <ImportarPane onDone={(msg) => { closeSheet(); showToast(msg); startTransition(() => {}); }} />
              )}
              {sheet.type === "listado" && (
                <ListadoPane
                  lista={listadoFiltrado(sheet as Sheet & { type: "listado" })}
                  grupos={grupoMap}
                />
              )}
              {sheet.type === "grupo" && (
                <GrupoPane
                  lista={donDePer(true).filter((d) => (esDar(d) || esEfe(d)) && (d.gid === sheet.gid || !!(d.sg?.[sheet.gid])))}
                  miembros={miembros.filter((m) => m.grupo_id === sheet.gid)}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-sm font-semibold px-4 py-2.5 rounded-[12px] shadow-lg pointer-events-none"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)", maxWidth: 340, textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const PER_LABEL: Record<DonPer, string> = { mes: "mes", trimestre: "trimestre", semestre: "semestre", anio: "año" };

// ── Sub-components ──────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ color: "var(--color-faint)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function CardConceptos({ lista, onFilter }: { lista: Donacion[]; onFilter: (t: string) => void }) {
  const [open, setOpen] = useState(true);
  const total = suma(lista);
  const pares = CONCEPTOS.map((c) => {
    const sub = lista.filter((d) => d.t === c);
    return { c, v: suma(sub), n: sub.length };
  });
  return (
    <div className="rounded-[16px] flex flex-col" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
      <button type="button" className="flex justify-between items-center gap-2 p-5 text-left w-full" onClick={() => setOpen(o => !o)}>
        <h2 className="font-bold text-[15px]" style={{ color: "var(--color-ink)" }}>Diezmos y ofrendas por concepto</h2>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>{money(total)}</span>
          <Chevron open={open} />
        </div>
      </button>
      {open && (total === 0 ? (
        <p className="text-sm text-center px-5 pb-5" style={{ color: "var(--color-muted)" }}>Sin donaciones en este periodo</p>
      ) : (
        <div className="flex flex-col gap-3 px-5 pb-5">
          {pares.filter((p) => p.v > 0 || CONCEPTOS.includes(p.c)).map(({ c, v, n }) => (
            <button key={c} type="button" className="text-left" onClick={() => onFilter(c)}>
              <BarRow label={c} value={v} total={total} n={n} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function CardEfectivo({ lista, etiq, onOpen }: {
  lista: Donacion[];
  etiq: string;
  onOpen: (subLista: Donacion[], titulo: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const lin = lista.filter((d) => !esEfe(d));
  const efe = lista.filter(esEfe);
  const T = suma(lista), a = suma(lin), b = suma(efe);
  const pa = T ? (a / T) * 100 : 0, pb = T ? 100 - pa : 0;
  const conceptos = CONCEPTOS.filter((c) => lista.some((d) => d.t === c));

  const subCards = [
    { label: "En línea (Wompi)", v: a, p: pa, list: lin },
    { label: "Efectivo",         v: b, p: pb, list: efe },
  ];

  return (
    <div className="rounded-[16px] flex flex-col" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
      <button type="button" className="flex justify-between items-center gap-2 p-5 text-left w-full flex-wrap" onClick={() => setOpen(o => !o)}>
        <h2 className="font-bold text-[15px]" style={{ color: "var(--color-ink)" }}>En línea y efectivo</h2>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>Diezmos y ofrendas · {etiq}</span>
          <Chevron open={open} />
        </div>
      </button>
      {open && (T === 0 ? (
        <p className="text-sm text-center px-5 pb-5" style={{ color: "var(--color-muted)" }}>Sin diezmos ni ofrendas en este periodo</p>
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-5">
          {/* Mini-cards — tocar abre el popup/sheet con el listado */}
          <div className="grid grid-cols-2 gap-3">
            {subCards.map(({ label, v, p, list }) => (
              <button
                key={label}
                type="button"
                onClick={() => onOpen(list, label)}
                className="rounded-[12px] p-4 flex flex-col gap-1.5 text-left"
                style={{ border: "1px solid var(--color-line)", background: "var(--color-surface)" }}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>{label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ color: "var(--color-faint)", flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
                <span className="font-bold text-[20px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>{money(v)}</span>
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{pct(p)} · {donantes(list)} donantes</span>
              </button>
            ))}
          </div>

          {/* Barra proporcional */}
          <div className="h-[10px] rounded-full overflow-hidden flex" style={{ background: "var(--color-surface-2)" }}>
            <div style={{ width: cssPct(pa), background: "var(--color-accent)" }} />
            <div style={{ width: cssPct(pb), background: "var(--color-line)" }} />
          </div>

          {/* Tabla por concepto */}
          {conceptos.length > 0 && (
            <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: "var(--color-line)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                    <th className="text-left px-3 py-2 text-xs font-semibold">Concepto</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold">En línea</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold">Efectivo</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptos.map((c) => {
                    const x = suma(lin.filter((d) => d.t === c)), yv = suma(efe.filter((d) => d.t === c));
                    return (
                      <tr key={c} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                        <td className="px-3 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>{c}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{money(x)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{money(yv)}</td>
                        <td className="px-3 py-2 text-right font-bold font-mono text-xs">{money(x + yv)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
                    <td className="px-3 py-2 font-bold" style={{ color: "var(--color-ink)" }}>Total</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-xs">{money(a)}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-xs">{money(b)}</td>
                    <td className="px-3 py-2 text-right font-bold font-mono text-xs">{money(T)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CardGrupos({ lista, grupos, miembros, etiq, onGrupo }: {
  lista: Donacion[]; grupos: SvGrupo[]; miembros: SvMiembro[]; etiq: string; onGrupo: (gid: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const enGrupo = (d: Donacion, gid: string) => d.gid === gid || !!(d.sg?.[gid]);
  const sin = lista.filter((d) => !d.gid && !Object.keys(d.sg ?? {}).length);
  const filas = grupos.map((g) => {
    const l = lista.filter((d) => enGrupo(d, g.id));
    const activos = new Set(l.map((d) => d.sg?.[g.id] ?? d.di)).size;
    return { g, total: suma(l), n: l.length, activos, miembros: miembros.filter((m) => m.grupo_id === g.id).length };
  }).sort((a, b) => b.total - a.total);
  // Total sin duplicar: solo donaciones con gid primario asignado
  const totalPrimario = suma(lista.filter((d) => d.gid));

  return (
    <div className="rounded-[16px] flex flex-col" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
      <button type="button" className="flex justify-between items-center gap-2 p-5 text-left w-full flex-wrap" onClick={() => setOpen(o => !o)}>
        <h2 className="font-bold text-[15px]" style={{ color: "var(--color-ink)" }}>Discipulados</h2>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>Diezmos y ofrendas · {etiq}</span>
          <Chevron open={open} />
        </div>
      </button>
      {open && (filas.length === 0 ? (
        <p className="text-sm text-center px-5 pb-5" style={{ color: "var(--color-muted)" }}>Sin datos de discipulados</p>
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-5">

          {/* ── Discípulos vs Resto de la iglesia ── */}
          {(() => {
            const T = suma(lista);
            const pDi = T ? (totalPrimario / T) * 100 : 0;
            const pRe = T ? 100 - pDi : 0;
            const donDi = new Set(lista.filter((d) => d.gid).map((d) => d.k || d.n)).size;
            const donRe = new Set(sin.map((d) => d.k || d.n)).size;
            return (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Discípulos",           v: totalPrimario, p: pDi, nd: donDi, color: "var(--color-accent)" },
                    { label: "Resto de la iglesia",  v: suma(sin),     p: pRe, nd: donRe, color: "var(--color-gold-text)" },
                  ].map(({ label, v, p, nd, color }) => (
                    <div key={label} className="rounded-[12px] p-4 flex flex-col gap-1" style={{ border: "1px solid var(--color-line)" }}>
                      <span className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>{label}</span>
                      <span className="font-bold text-[20px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>{money(v)}</span>
                      <span className="text-xs font-semibold" style={{ color }}>{pct(p)}</span>
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>{nd} donantes</span>
                    </div>
                  ))}
                </div>
                <div className="h-[10px] rounded-full overflow-hidden flex" style={{ background: "var(--color-surface-2)" }}>
                  <div style={{ width: cssPct(pDi), background: "var(--color-accent)", transition: "width 0.3s" }} />
                  <div style={{ width: cssPct(pRe), background: "var(--color-gold)", transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })()}

          {/* ── Tabla por grupo ── */}
          <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: "var(--color-line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Discipulado</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold">Dieron</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold">Aportes</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ g, total, n, activos, miembros: cnt }) => (
                  <tr key={g.id} className="border-t cursor-pointer hover:opacity-80" style={{ borderColor: "var(--color-line)" }} onClick={() => onGrupo(g.id)}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--color-ink)" }}>{g.nombre}</td>
                    <td className="px-3 py-2.5 text-right text-xs" style={{ color: "var(--color-muted)" }}>{activos} de {cnt}</td>
                    <td className="px-3 py-2.5 text-right text-xs" style={{ color: "var(--color-muted)" }}>{n}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs font-mono">{money(total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
                  <td className="px-3 py-2 font-bold" colSpan={3} style={{ color: "var(--color-ink)" }}>Total en discipulados</td>
                  <td className="px-3 py-2 text-right font-bold text-xs font-mono">{money(totalPrimario)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// Normalize name for matching (same logic as svNorm / svNombreClave in sv-logic)
function normDon(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function claveDon(n: string): string | null {
  const p = normDon(n).split(" ").filter(Boolean);
  if (p.length < 2) return null;
  return p[0] + " " + p[Math.min(2, p.length - 1)];
}

type DonCluster = { nombre: string; total: number; count: number; conceptos: string[]; list: Donacion[] };

function clusterDonantes(lista: Donacion[]): DonCluster[] {
  const clusters: { names: string[]; list: Donacion[] }[] = [];
  const keyToIdx = new Map<string, number>(); // d.k → cluster index

  for (const d of lista) {
    // 1. If this donor key already maps to a cluster, use it
    if (d.k && keyToIdx.has(d.k)) {
      const c = clusters[keyToIdx.get(d.k)!];
      c.list.push(d);
      if (!c.names.includes(d.n)) c.names.push(d.n);
      continue;
    }

    // 2. Try to find a matching cluster by name
    const kD = normDon(d.n);
    const claveD = claveDon(d.n);
    let found = -1;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      for (const cn of c.names) {
        const kC = normDon(cn);
        if (
          kD === kC ||
          (kD.length >= 8 && (kD.startsWith(kC + " ") || kC.startsWith(kD + " "))) ||
          (claveD !== null && claveDon(cn) === claveD)
        ) { found = i; break; }
      }
      if (found !== -1) break;
    }

    if (found !== -1) {
      const c = clusters[found];
      c.list.push(d);
      if (!c.names.includes(d.n)) c.names.push(d.n);
      if (d.k) keyToIdx.set(d.k, found);
    } else {
      const idx = clusters.length;
      clusters.push({ names: [d.n], list: [d] });
      if (d.k) keyToIdx.set(d.k, idx);
    }
  }

  return clusters.map((c) => {
    const nombre = c.names.reduce((b, n) => n.length > b.length ? n : b, "");
    const total = c.list.reduce((s, d) => s + (d.m ?? 0), 0);
    const conceptos = [...new Set(c.list.map((d) => d.t).filter(Boolean))];
    return { nombre, total, count: c.list.length, conceptos, list: c.list };
  }).sort((a, b) => b.total - a.total);
}

function CardRegistroDonantes({ lista, onDonante }: {
  lista: Donacion[];
  onDonante: (subLista: Donacion[], nombre: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState("");

  const clusters = useMemo(() => clusterDonantes(lista), [lista]);

  const qNorm = normDon(q);
  const filtered = q
    ? clusters.filter((r) => normDon(r.nombre).includes(qNorm))
    : clusters;
  const shown = filtered.slice(0, 100);

  return (
    <div className="rounded-[16px] flex flex-col" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
      <button type="button" className="flex justify-between items-center gap-2 p-5 text-left w-full flex-wrap" onClick={() => setOpen(o => !o)}>
        <h2 className="font-bold text-[15px]" style={{ color: "var(--color-ink)" }}>Registro de donantes</h2>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>{clusters.length} donantes en el periodo</span>
          <Chevron open={open} />
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-5 pb-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar donante…"
            className="input text-sm"
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-muted)" }}>Sin resultados</p>
          ) : (
            <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
              {shown.map((r, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onDonante(r.list, r.nombre)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b hover:opacity-80"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  <span className="text-xs font-semibold w-6 text-right flex-none"
                    style={{ color: idx < 3 ? "var(--color-accent)" : "var(--color-faint)" }}>
                    {idx + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-sm block truncate" style={{ color: "var(--color-ink)" }}>{r.nombre}</span>
                    <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {r.count} donación{r.count !== 1 ? "es" : ""} · {r.conceptos.join(", ")}
                    </span>
                  </span>
                  <span className="text-sm font-semibold font-mono flex-none" style={{ color: "var(--color-ink)" }}>
                    {money(r.total)}
                  </span>
                </button>
              ))}
              {filtered.length > 100 && (
                <p className="text-xs px-4 py-2.5 text-center" style={{ color: "var(--color-faint)" }}>
                  Mostrando 100 de {filtered.length} donantes
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CardRanking({ lista, etiq, rankTab, onRankTab, onDonante }: {
  lista: Donacion[]; etiq: string; rankTab: "monto" | "frecuencia";
  onRankTab: (t: "monto" | "frecuencia") => void;
  onDonante: (k: string, n: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const porDonante = [...new Map(lista.map((d) => [d.k, d])).entries()].map(([k, first]) => {
    const sub = lista.filter((d) => d.k === k);
    return { k, n: first.n, total: suma(sub), veces: sub.length };
  });
  const orden = rankTab === "monto"
    ? porDonante.sort((a, b) => b.total - a.total || b.veces - a.veces)
    : porDonante.sort((a, b) => b.veces - a.veces || b.total - a.total);
  const top = orden.slice(0, 10);
  const max = top.length ? (rankTab === "monto" ? top[0].total : top[0].veces) : 1;

  return (
    <div className="rounded-[16px] flex flex-col" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
      <div className="flex justify-between items-center gap-2 p-5 flex-wrap">
        <h2 className="font-bold text-[15px]" style={{ color: "var(--color-ink)" }}>Ranking de donantes</h2>
        <div className="flex items-center gap-2 flex-none">
          <div className="flex rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
            {(["monto","frecuencia"] as const).map((t) => (
              <button key={t} type="button" onClick={() => onRankTab(t)}
                className="px-3 py-1 text-xs font-semibold"
                style={{ background: rankTab === t ? "var(--color-surface-2)" : "var(--color-surface)", color: rankTab === t ? "var(--color-ink)" : "var(--color-muted)" }}
              >
                {t === "monto" ? "Por monto" : "Por frecuencia"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(o => !o)} className="w-6 h-6 flex items-center justify-center">
            <Chevron open={open} />
          </button>
        </div>
      </div>
      {open && (top.length === 0 ? (
        <p className="text-sm text-center px-5 pb-5" style={{ color: "var(--color-muted)" }}>Sin donaciones en este periodo</p>
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-5">
          <ol className="grid gap-0.5">
            {top.map((d, idx) => {
              const v = rankTab === "monto" ? d.total : d.veces;
              const w = max ? (v / max) * 100 : 0;
              return (
                <li key={d.k}>
                  <button type="button" onClick={() => onDonante(d.k, d.n)}
                    className="w-full grid items-center gap-2.5 px-2 py-2 rounded-[8px] text-left hover:opacity-80"
                    style={{ gridTemplateColumns: "26px minmax(0,1fr) auto" }}
                  >
                    <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: idx < 3 ? "var(--color-accent-soft)" : "var(--color-surface-2)", color: idx < 3 ? "var(--color-accent)" : "var(--color-muted)" }}>
                      {idx + 1}
                    </span>
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="font-semibold text-sm truncate" style={{ color: "var(--color-ink)" }}>{d.n}</span>
                      <div className="h-[4px] rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                        <div style={{ width: `${w}%`, background: "var(--color-accent)", height: "100%" }} />
                      </div>
                    </span>
                    <span className="text-right text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                      {rankTab === "monto" ? money(d.total) : `${d.veces} veces`}
                      <span className="block text-xs font-normal" style={{ color: "var(--color-muted)" }}>
                        {rankTab === "monto" ? `${d.veces} donaciones` : money(d.total)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-xs" style={{ color: "var(--color-faint)" }}>{porDonante.length} donantes en {etiq}</p>
        </div>
      ))}
    </div>
  );
}

// ── Sheet panes ─────────────────────────────────────────────────────────────

function ListadoPane({ lista, grupos }: { lista: Donacion[]; grupos: Map<string, SvGrupo> }) {
  const total = suma(lista);
  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
        {lista.length} donaciones · Total {money(total)}
      </p>
      {lista.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--color-muted)" }}>Sin donaciones con estos filtros</p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: "var(--color-line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
                <th className="text-left px-3 py-2 text-xs font-semibold whitespace-nowrap">Fecha</th>
                <th className="text-left px-3 py-2 text-xs font-semibold">Donante</th>
                <th className="text-left px-3 py-2 text-xs font-semibold">Concepto</th>
                <th className="text-left px-3 py-2 text-xs font-semibold">Método</th>
                <th className="text-left px-3 py-2 text-xs font-semibold">Discipulado</th>
                <th className="text-right px-3 py-2 text-xs font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-3 py-2 text-xs font-mono whitespace-nowrap" style={{ color: "var(--color-muted)" }}>{fmtFecha(d.f)}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{d.n}</span>
                    {(d.e || d.doc) && <div className="text-xs" style={{ color: "var(--color-muted)" }}>{[d.doc, d.e].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{d.t || (esEfe(d) ? "Efectivo" : "Formulario")}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--color-muted)" }}>{metodo(d.met)}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--color-muted)" }}>{d.gid ? (grupos.get(d.gid)?.nombre ?? "—") : "—"}</td>
                  <td className="px-3 py-2 text-right font-bold text-xs font-mono">{money(d.m)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
                <td className="px-3 py-2 font-bold" colSpan={5} style={{ color: "var(--color-ink)" }}>Total · {lista.length}</td>
                <td className="px-3 py-2 text-right font-bold font-mono text-xs">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function GrupoPane({ lista, miembros }: { lista: Donacion[]; miembros: SvMiembro[] }) {
  const filas = miembros.map((m) => {
    // d.di: grupo primario  |  d.sg[grupo_id]: membresía secundaria en este grupo
    const l = lista.filter((d) => d.di === m.id || d.sg?.[m.grupo_id] === m.id);
    const f: Record<string, number> = {};
    CONCEPTOS.forEach((c) => { f[c] = suma(l.filter((d) => d.t === c)); });
    return { m, total: suma(l), veces: l.length, ult: l.reduce((a, d) => d.f > a ? d.f : a, ""), ...f };
  }).sort((a, b) => b.total - a.total || a.m.nombre.localeCompare(b.m.nombre, "es"));

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-[10px] border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              <th className="text-left px-3 py-2 text-xs font-semibold">Discípulo</th>
              {CONCEPTOS.map((c) => <th key={c} className="text-right px-3 py-2 text-xs font-semibold">{c}</th>)}
              <th className="text-right px-3 py-2 text-xs font-semibold">Veces</th>
              <th className="text-right px-3 py-2 text-xs font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.m.id} className="border-t" style={{ borderColor: "var(--color-line)", opacity: f.total ? 1 : 0.45 }}>
                <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--color-ink)" }}>{f.m.nombre}</td>
                {CONCEPTOS.map((c) => <td key={c} className="px-3 py-2.5 text-right text-xs font-mono">{(f as unknown as Record<string, number>)[c] ? money((f as unknown as Record<string, number>)[c]) : "—"}</td>)}
                <td className="px-3 py-2.5 text-right text-xs">{f.veces || "—"}</td>
                <td className="px-3 py-2.5 text-right font-bold text-xs font-mono">{f.total ? money(f.total) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
              <td className="px-3 py-2 font-bold" style={{ color: "var(--color-ink)" }}>{filas.length} discípulos</td>
              {CONCEPTOS.map((c) => <td key={c} className="px-3 py-2 text-right font-bold text-xs font-mono">{money(filas.reduce((a, f) => a + ((f as unknown as Record<string, number>)[c] || 0), 0))}</td>)}
              <td className="px-3 py-2 text-right font-bold text-xs">{filas.reduce((a, f) => a + f.veces, 0)}</td>
              <td className="px-3 py-2 text-right font-bold text-xs font-mono">{money(filas.reduce((a, f) => a + f.total, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function VincularBtn({ onDone }: { onDone: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    try {
      const { donVincularAction } = await import("../actions");
      const r = await donVincularAction();
      onDone(`Vinculadas: ${r.vinculadas} · Sin match: ${r.sin_match}`);
    } catch (e) {
      onDone("Error al vincular: " + String(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      disabled={loading}
      className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
      onClick={handleClick}
    >
      {loading ? "Vinculando…" : "Vincular discípulos"}
    </button>
  );
}

function ImportarPane({ onDone }: { onDone: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setStatus(null);
    try {
      const { donImportarAction } = await import("../actions");
      const fd = new FormData(); fd.set("datos", text);
      const r = await donImportarAction(fd);
      const parts = [`${r.importadas} importadas`];
      if (r.repetidas) parts.push(`${r.repetidas} repetidas`);
      if (r.autovinculadas) parts.push(`${r.autovinculadas} vinculadas automáticamente`);
      if (r.sin_match) parts.push(`${r.sin_match} por vincular`);
      onDone(parts.join(" · "));
    } catch (err) {
      setStatus({ ok: false, msg: (err as Error).message });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        En el panel de Hostinger, ve a <strong>Configuración → Exportar al Portal RSG</strong> y descarga el archivo JSON. Abre el archivo, copia todo su contenido y pégalo aquí.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='[{"id":"...","f":"2026-01-01T12:00:00Z","m":100000,...}]'
        className="input font-mono text-xs"
        style={{ minHeight: 200, resize: "vertical" }}
        required
      />
      {status && (
        <p className="text-sm font-semibold" style={{ color: status.ok ? "var(--color-up)" : "var(--color-down)" }}>
          {status.msg}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={loading || !text.trim()}>
        {loading ? "Importando…" : "Importar"}
      </button>
    </form>
  );
}

// ── CardPorVincular ─────────────────────────────────────────────────────────

function normTok(s: string): string[] {
  const STOP = new Set(["de","del","la","las","los","y","da","do"]);
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").filter(t => t.length >= 2 && !STOP.has(t));
}

function computeSugs(nombre: string, miembros: SvMiembro[]): Array<{ m: SvMiembro; score: number }> {
  const dt = normTok(nombre);
  if (dt.length < 2) return [];
  const hits: Array<{ m: SvMiembro; score: number }> = [];
  for (const m of miembros) {
    const xt = normTok(m.nombre);
    if (!xt.length) continue;
    let matched = 0; let hasPri = false;
    for (let i = 0; i < xt.length; i++) {
      const t = xt[i];
      let best = 0;
      for (const d of dt) {
        if (t === d) best = 1;
        else if (Math.min(t.length, d.length) >= 3 && (t.startsWith(d) || d.startsWith(t))) best = Math.max(best, 0.85);
      }
      if (best >= 0.75) { matched++; if (i === 0) hasPri = true; }
    }
    if (!hasPri || matched < Math.min(2, xt.length)) continue;
    hits.push({ m, score: matched / xt.length });
  }
  // Deduplicate by member id
  const seen = new Map<string, typeof hits[0]>();
  for (const h of hits.sort((a, b) => b.score - a.score))
    if (!seen.has(h.m.id)) seen.set(h.m.id, h);
  return [...seen.values()].slice(0, 3);
}

function FilaPorVincular({
  d,
  miembros,
  grupoMap,
  onVincular,
  onExterno,
}: {
  d: Donacion;
  miembros: SvMiembro[];
  grupoMap: Map<string, SvGrupo>;
  onVincular: (di: string, gid: string) => void;
  onExterno: () => void;
}) {
  const [busq, setBusq] = useState("");
  const [pending, setPending] = useState(false);
  const sugs = useMemo(() => computeSugs(d.n, miembros), [d.n, miembros]);
  const resultados = useMemo(() =>
    busq.trim().length >= 2
      ? miembros.filter(m => m.nombre.toLowerCase().includes(busq.toLowerCase())).slice(0, 8)
      : [],
    [busq, miembros]);

  const esDoc = /^\d{6,}$/.test(d.n.trim());

  return (
    <div className="flex flex-col gap-2 py-3 border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
      {/* Row header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm truncate" style={{ color: esDoc ? "var(--color-muted)" : "var(--color-ink)" }}>
            {d.n}
            {esDoc && <span className="ml-1 text-[11px] font-normal" style={{ color: "var(--color-faint)" }}>(doc)</span>}
          </span>
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {money(d.m)} · {metodo(d.met)} · {fmtFecha(d.f).split(" · ")[0]}
          </span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => { setPending(true); onExterno(); }}
          className="flex-none text-[11px] font-semibold px-2 py-1 rounded-[6px]"
          style={{ background: "var(--color-surface-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}
        >
          Externo
        </button>
      </div>

      {/* Auto-suggestions */}
      {sugs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sugs.map(({ m }) => {
            const g = grupoMap.get(m.grupo_id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={pending}
                onClick={() => { setPending(true); onVincular(m.id, m.grupo_id); }}
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
              >
                {m.nombre}
                {g && <span className="font-normal opacity-70"> · {g.nombre}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Manual search */}
      <div className="relative">
        <input
          value={busq}
          onChange={e => setBusq(e.target.value)}
          placeholder="Buscar miembro para vincular…"
          className="input text-sm w-full"
          style={{ paddingRight: 8 }}
        />
        {resultados.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-[10px] overflow-hidden z-20 flex flex-col"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
          >
            {resultados.map(m => {
              const g = grupoMap.get(m.grupo_id);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={pending}
                  onClick={() => { setBusq(""); setPending(true); onVincular(m.id, m.grupo_id); }}
                  className="flex items-center gap-2 px-3 py-2.5 text-left hover:opacity-75"
                  style={{ borderBottom: "1px solid var(--color-line)" }}
                >
                  <span className="font-semibold text-sm flex-1" style={{ color: "var(--color-ink)" }}>{m.nombre}</span>
                  {g && <span className="text-xs flex-none" style={{ color: "var(--color-muted)" }}>{g.nombre}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CardPorVincular({
  donaciones,
  miembros,
  grupos,
}: {
  donaciones: Donacion[];
  miembros: SvMiembro[];
  grupos: SvGrupo[];
}) {
  const pendientes = donaciones.filter(d => !d.di && !d.ext);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const visibles = pendientes.filter(d => !done.has(d.id));
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const grupoMap = useMemo(() => new Map(grupos.map(g => [g.id, g])), [grupos]);

  if (pendientes.length === 0) return null;

  async function vincular(donId: string, di: string, gid: string) {
    setDone(prev => new Set([...prev, donId]));
    const { donVincularManualAction } = await import("../actions");
    await donVincularManualAction(donId, di, gid);
    router.refresh();
  }

  async function marcarExterno(donId: string) {
    setDone(prev => new Set([...prev, donId]));
    const { donMarcarExternoAction } = await import("../actions");
    await donMarcarExternoAction(donId);
    router.refresh();
  }

  return (
    <div className="rounded-[16px] flex flex-col" style={{ background: "var(--color-surface)", border: "1px solid var(--color-gold)" }}>
      <button type="button" className="flex justify-between items-center gap-2 p-5 text-left w-full" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[15px]" style={{ color: "var(--color-ink)" }}>Por vincular</h2>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}
          >
            {visibles.length} de {pendientes.length}
          </span>
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="px-5 pb-5">
          {visibles.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-muted)" }}>
              Todas vinculadas en esta sesión. Se actualizarán al recargar.
            </p>
          ) : (
            <div className="flex flex-col">
              {visibles.map(d => (
                <FilaPorVincular
                  key={d.id}
                  d={d}
                  miembros={miembros}
                  grupoMap={grupoMap}
                  onVincular={(di, gid) => vincular(d.id, di, gid)}
                  onExterno={() => marcarExterno(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
