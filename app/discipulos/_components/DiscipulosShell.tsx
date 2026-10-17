"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  svServiciosGrupo, svTablaDiscipulos, svFmt, svNombreLimpio,
  etiqueta, etiquetaCorta, shiftPeriodo, periodoActual, esFuturo, svEnPeriodo, svNorm,
} from "@/app/servicio/_lib/sv-logic";
import { svMiembroAgregarLiderAction, svMiembroQuitarLiderAction } from "@/app/servicio/actions";
import type { SvData, SvGrupo, SvMiembro, SvServicioItem, SvDiscipuloFila, SvPer } from "@/app/servicio/_lib/types";
import type { Donacion } from "@/app/donaciones/_lib/types";

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

const SV_NOTA = "Una ausencia es cuando la persona estaba asignada y no llegó: no cuenta como servicio. Reuniones y Servolución se cuentan por separado. Servir en varios roles en una misma reunión cuenta como una vez, y las Reuniones Centrales de un mismo domingo cuentan como una.";

export function DiscipulosShell({
  grupo,
  miembros,
  svData,
  donaciones,
  canEdit = false,
}: {
  grupo: SvGrupo;
  miembros: SvMiembro[];
  svData: SvData;
  donaciones: Donacion[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [per, setPer]         = useState<SvPer>("mes");
  const [{ y, i }, setPeriod] = useState(() => periodoActual("mes"));
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [nuevosNombres, setNuevos] = useState("");
  const [addOpen, setAddOpen]      = useState(false);
  const [toast, setToast]          = useState<string | null>(null);
  const [, startTransition]        = useTransition();

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevosNombres.trim()) return;
    const fd = new FormData();
    fd.set("grupo_id", grupo.id);
    fd.set("nombres", nuevosNombres);
    try {
      const r = await svMiembroAgregarLiderAction(fd);
      setNuevos("");
      setAddOpen(false);
      showToast(`${r.count} discípulo${r.count === 1 ? "" : "s"} agregado${r.count === 1 ? "" : "s"}`);
      startTransition(() => router.refresh());
    } catch (err) {
      showToast("Error: " + (err as Error).message);
    }
  }

  async function handleQuitar(miembroId: string) {
    const fd = new FormData();
    fd.set("id", miembroId);
    fd.set("grupo_id", grupo.id);
    try {
      await svMiembroQuitarLiderAction(fd);
      showToast("Discípulo eliminado");
      startTransition(() => router.refresh());
    } catch (err) {
      showToast("Error: " + (err as Error).message);
    }
  }

  function changePer(p: SvPer) {
    setPer(p);
    setPeriod(periodoActual(p));
  }

  function shiftP(dir: number) {
    const [ny, ni] = shiftPeriodo(per, y, i, dir);
    setPeriod({ y: ny, i: ni });
  }

  function toggleOpen(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const servicios = svServiciosGrupo(svData, grupo.id);
  const { filas, sirvieron, totMin, totServ } = svTablaDiscipulos(miembros, servicios, per, y, i);

  const donPorDi = useMemo(() => {
    const nameToId = new Map<string, string>();
    for (const m of miembros) {
      nameToId.set(svNorm(m.nombre), m.id);
    }
    const map = new Map<string, { monto: number; items: Donacion[] }>();
    for (const d of donaciones) {
      const diId = d.di ?? nameToId.get(svNorm(d.n)) ?? null;
      if (!diId) continue;
      if (!svEnPeriodo(d.f.slice(0, 10), per, y, i)) continue;
      const prev = map.get(diId) ?? { monto: 0, items: [] };
      map.set(diId, { monto: prev.monto + (d.m ?? 0), items: [...prev.items, d] });
    }
    return map;
  }, [donaciones, miembros, per, y, i]);

  const totDon = filas.reduce((acc, f) => acc + (donPorDi.get(f.id)?.monto ?? 0), 0);

  const nextShift = shiftPeriodo(per, y, i, 1);

  return (
    <div className="flex flex-col" style={{ maxWidth: 1180, margin: "0 auto" }}>
      {/* Period bar */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 flex-wrap">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}
            onClick={() => shiftP(-1)}
          >‹</button>
          <span className="text-sm font-semibold min-w-[120px] text-center" style={{ color: "var(--color-ink)" }}>
            {etiqueta(per, y, i)}
          </span>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}
            onClick={() => shiftP(1)}
            disabled={esFuturo(per, nextShift[0], nextShift[1])}
          >›</button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-24">
        {/* Header card */}
        <div className="rounded-[16px] px-4 py-4 flex items-center gap-3 justify-between" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div>
            <p className="eyebrow mb-1">Mis discípulos</p>
            <h1 className="font-bold text-xl leading-tight" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              {grupo.nombre}
            </h1>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="text-sm font-semibold px-3 py-2 rounded-[10px] flex-none"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
            >
              + Agregar
            </button>
          )}
        </div>

        {/* Add disciples form */}
        {canEdit && addOpen && (
          <form onSubmit={handleAgregar} className="rounded-[16px] px-4 py-4 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Un nombre por línea. Los que ya existen se omiten.</p>
            <textarea
              value={nuevosNombres}
              onChange={(e) => setNuevos(e.target.value)}
              className="input text-sm"
              rows={4}
              placeholder={"Juan García\nMaría López\nPedro Martínez"}
              required
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm px-4 py-2">Agregar</button>
              <button type="button" onClick={() => { setAddOpen(false); setNuevos(""); }}
                className="text-sm font-semibold px-4 py-2 rounded-[8px]"
                style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Summary chip row */}
        <div className="flex flex-wrap gap-2">
          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
          >
            {sirvieron} de {miembros.length} sirvieron
          </span>
          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "var(--color-surface-2)", color: "var(--color-ink)" }}
          >
            Reuniones <strong>{totMin}</strong>
          </span>
          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}
          >
            Servolución <strong>{totServ}</strong>
          </span>
          {totDon > 0 && (
            <span
              className="text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}
            >
              Donaciones <strong>{fmtCOP(totDon)}</strong>
            </span>
          )}
        </div>

        {/* Disciples list */}
        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "var(--color-line)" }}>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Toca un discípulo para ver el detalle de sus reuniones.
            </p>
          </div>

          {filas.length > 0 ? (
            <div className="divide-y" style={{ ["--tw-divide-opacity" as string]: 1 }}>
              {filas.map(f => (
                <DiscipuloRow
                  key={f.id}
                  fila={f}
                  donInfo={donPorDi.get(f.id)}
                  open={openIds.has(f.id)}
                  onToggle={() => toggleOpen(f.id)}
                  per={etiquetaCorta(per, y, i)}
                  canEdit={canEdit}
                  onRemove={() => handleQuitar(f.id)}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>
              Este discipulado aún no tiene discípulos registrados.
            </div>
          )}

          {/* Totals footer */}
          {filas.length > 0 && (
            <div
              className="px-4 py-3 flex flex-wrap gap-3 text-xs font-semibold border-t"
              style={{ borderColor: "var(--color-line)", background: "var(--color-bg)", color: "var(--color-muted)" }}
            >
              <span>{filas.length} discípulos</span>
              <span>Reuniones <strong style={{ color: "var(--color-ink)" }}>{totMin}</strong></span>
              <span>Servolución <strong style={{ color: "var(--color-gold)" }}>{totServ}</strong></span>
              {totDon > 0 && <span>Donaciones <strong style={{ color: "var(--color-up)" }}>{fmtCOP(totDon)}</strong></span>}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs px-1" style={{ color: "var(--color-faint)" }}>{SV_NOTA}</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-sm font-semibold px-4 py-2.5 rounded-[12px] shadow-lg pointer-events-none"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)", maxWidth: 320, textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function DiscipuloRow({
  fila,
  donInfo,
  open,
  onToggle,
  per,
  canEdit = false,
  onRemove,
}: {
  fila: SvDiscipuloFila;
  donInfo?: { monto: number; items: Donacion[] };
  open: boolean;
  onToggle: () => void;
  per: string;
  canEdit?: boolean;
  onRemove?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  function handleRemoveClick() {
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return; }
    onRemove?.();
  }

  return (
    <div style={{ borderColor: "var(--color-line)" }}>
      {/* Summary row — div wrapper avoids nested-button invalid HTML */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: open ? "var(--color-bg)" : "transparent" }}
      >
        {/* Toggle button takes all remaining space */}
        <button
          type="button"
          className="flex-1 flex flex-col gap-1 text-left min-w-0"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="flex items-center justify-between gap-2 w-full">
            <span className="font-semibold text-sm truncate" style={{ color: "var(--color-ink)" }}>{fila.n}</span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: "var(--color-faint)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
          <span className="flex flex-wrap gap-1 w-full">{/* chips */}
            {fila.min > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}>
                Reuniones {fila.min}
              </span>
            )}
            {fila.serv > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
                Servolución {fila.serv}
              </span>
            )}
            {fila.aus > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}>
                {fila.aus} {fila.aus === 1 ? "ausencia" : "ausencias"}
              </span>
            )}
            {donInfo && donInfo.monto > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}>
                {fmtCOP(donInfo.monto)}
              </span>
            )}
            {fila.min === 0 && fila.serv === 0 && fila.aus === 0 && (!donInfo || donInfo.monto === 0) && (
              <span className="text-xs" style={{ color: "var(--color-faint)" }}>Sin registros</span>
            )}
          </span>
        </button>

        {/* Remove button — separate from toggle, valid HTML */}
        {canEdit && (
          <button
            type="button"
            onClick={handleRemoveClick}
            className="flex-none text-xs font-semibold px-2.5 py-1.5 rounded-[8px] transition"
            style={{
              background: confirming ? "var(--color-down-soft)" : "var(--color-surface-2)",
              color: confirming ? "var(--color-down)" : "var(--color-faint)",
              border: `1px solid ${confirming ? "var(--color-down)" : "var(--color-line)"}`,
              minWidth: 44,
            }}
            aria-label={confirming ? "Confirmar quitar del grupo" : `Quitar a ${fila.n} del grupo`}
          >
            {confirming ? "¿Quitar?" : "Quitar"}
          </button>
        )}
      </div>
      {/* Detail rows */}
      {open && (
        <div className="px-4 pb-3" style={{ background: "var(--color-bg)" }}>
          {fila.det.length > 0 ? (
            <div className="flex flex-col gap-2 pt-1">
              {fila.det.map((item, idx) => (
                <MeetingEntry key={idx} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-xs py-2" style={{ color: "var(--color-muted)" }}>
              No estuvo asignado en ninguna reunión de este periodo.
            </p>
          )}
          {donInfo && donInfo.items.length > 0 && (
            <div className="mt-3 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-muted)" }}>Donaciones</p>
              <div className="flex flex-col">
                {donInfo.items.map((d, idx) => (
                  <DonacionEntry key={idx} don={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingEntry({ item }: { item: SvServicioItem }) {
  const badge = item.aus
    ? { label: "Ausente",     bg: "var(--color-down-soft)",  color: "var(--color-down)" }
    : item.t === "serv"
    ? { label: "Servolución", bg: "var(--color-gold-soft)",  color: "var(--color-gold-text)" }
    : { label: "Sirvió",      bg: "var(--color-up-soft)",    color: "var(--color-up)" };

  return (
    <div className="flex items-start gap-2 py-1.5 border-t first:border-t-0 text-sm" style={{ borderColor: "var(--color-line)" }}>
      <span className="text-xs font-mono whitespace-nowrap pt-0.5" style={{ color: "var(--color-muted)", minWidth: 96 }}>
        {svFmt(item.f).slice(0, 10)}
      </span>
      <span className="flex-1 min-w-0">
        <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{svNombreLimpio(item.r)}</span>
        {item.roles.length > 0 && (
          <span className="block text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{item.roles.join(", ")}</span>
        )}
      </span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full flex-none"
        style={{ background: badge.bg, color: badge.color }}
      >
        {badge.label}
      </span>
    </div>
  );
}

function DonacionEntry({ don }: { don: Donacion }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-t first:border-t-0 text-sm" style={{ borderColor: "var(--color-line)" }}>
      <span className="text-xs font-mono whitespace-nowrap pt-0.5" style={{ color: "var(--color-muted)", minWidth: 96 }}>
        {don.f.slice(0, 10)}
      </span>
      <span className="flex-1 min-w-0 font-semibold" style={{ color: "var(--color-ink)" }}>
        {don.t ?? "Donación"}
      </span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full flex-none"
        style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}
      >
        {fmtCOP(don.m ?? 0)}
      </span>
    </div>
  );
}
