"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { marcarChecklist, responderAsignacion } from "@/app/servir/equipo/_lib/acciones";
import { Aviso, EstadoChip, MOMENTO_TEXTO } from "@/app/servir/equipo/_components/ui";

export type ServicioFila = {
  id: string;
  meeting_id: string;
  status: string;
  decline_reason: string | null;
  fecha: string;               // ya formateada en Bogotá
  reunion: string;
  posicion: string;
  departamento: string;
  pasado: boolean;
  checklist: { id: string; moment: string; text: string; done: boolean }[];
  orden: { id: string; title: string; kind: string; duration_sec: number; mia: boolean }[];
};

const MOMENTOS = ["antes", "durante", "despues"];

export function ServicioTarjeta({ s }: { s: ServicioFila }) {
  const [pendiente, start] = useTransition();
  const [err, setErr] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [verOrden, setVerOrden] = useState(false);
  // Optimista: el punto se marca al tocar y se revierte si falla.
  const [hechos, setHechos] = useState(() => new Set(s.checklist.filter((c) => c.done).map((c) => c.id)));

  function responder(aceptar: boolean) {
    setErr("");
    start(async () => {
      const r = await responderAsignacion(s.id, aceptar, aceptar ? undefined : motivo);
      if (!r.ok) setErr(r.error); else { setRechazando(false); setMotivo(""); }
    });
  }

  function marcar(id: string) {
    const hecho = !hechos.has(id);
    setHechos((h) => { const n = new Set(h); if (hecho) n.add(id); else n.delete(id); return n; });
    setErr("");
    start(async () => {
      const r = await marcarChecklist(id, hecho);
      if (!r.ok) {
        setErr(r.error);
        setHechos((h) => { const n = new Set(h); if (hecho) n.delete(id); else n.add(id); return n; });
      }
    });
  }

  const total = s.checklist.length;
  const listo = total > 0 && hechos.size === total;

  return (
    <article className="card px-4 py-4 flex flex-col gap-3" style={listo ? { borderColor: "var(--color-up)" } : undefined}>
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium capitalize" style={{ color: "var(--color-muted)" }}>{s.fecha}</p>
          <h3 className="text-[17px] font-semibold leading-snug" style={{ color: "var(--color-ink)" }}>
            <Link href={`/servir/reuniones/${s.meeting_id}`} className="hover:underline">{s.reunion}</Link>
          </h3>
          <p className="text-[14px]" style={{ color: "var(--color-ink)" }}>
            {s.posicion} <span style={{ color: "var(--color-muted)" }}>· {s.departamento}</span>
          </p>
        </div>
        {listo ? <span className="chip chip-up flex-none"><Icon name="check" size={12} style={{ marginRight: 4 }} />Listo</span> : <EstadoChip estado={s.status} />}
      </header>

      {err && <Aviso texto={err} />}

      {!s.pasado && s.status === "pendiente" && !rechazando && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" disabled={pendiente} onClick={() => responder(true)}>
            <Icon name="check" /> Aceptar
          </button>
          <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setRechazando(true)}>
            No puedo
          </button>
        </div>
      )}

      {rechazando && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">¿Por qué no puedes? (opcional, lo ve tu líder)</span>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Estoy de viaje" autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-primary" style={{ background: "var(--color-down)" }} disabled={pendiente} onClick={() => responder(false)}>Rechazar</button>
            <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setRechazando(false)}>Volver</button>
          </div>
        </div>
      )}

      {s.status === "rechazada" && (
        <div className="flex items-center gap-2 flex-wrap text-[13px]" style={{ color: "var(--color-muted)" }}>
          <span className="flex-1">Rechazaste{s.decline_reason ? `: “${s.decline_reason}”` : "."}</span>
          {!s.pasado && <button type="button" className="btn-ghost min-h-[40px] px-3 text-[14px]" disabled={pendiente} onClick={() => responder(true)}>Sí puedo</button>}
        </div>
      )}

      {s.status === "aceptada" && total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="field-label flex-1">Tu checklist</p>
            <span className="text-[12px] tabular" style={{ color: listo ? "var(--color-up)" : "var(--color-muted)" }}>{hechos.size}/{total}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(hechos.size / total) * 100}%`, background: "var(--color-up)" }} />
          </div>
          {MOMENTOS.map((m) => {
            const items = s.checklist.filter((c) => c.moment === m);
            if (!items.length) return null;
            return (
              <div key={m} className="flex flex-col">
                <p className="eyebrow pt-1">{MOMENTO_TEXTO[m]}</p>
                {items.map((c) => {
                  const on = hechos.has(c.id);
                  return (
                    <button key={c.id} type="button" role="checkbox" aria-checked={on} onClick={() => marcar(c.id)} disabled={s.pasado}
                      className="flex items-center gap-3 min-h-[44px] text-left">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-none transition"
                        style={on ? { background: "var(--color-up)", color: "var(--color-accent-ink)" } : { border: "1.5px solid var(--color-line-strong)" }}>
                        {on && <Icon name="check" size={14} strokeWidth={2.6} />}
                      </span>
                      <span className="text-[15px]" style={{ color: on ? "var(--color-muted)" : "var(--color-ink)", textDecoration: on ? "line-through" : undefined }}>{c.text}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {s.orden.length > 0 && (
        <div className="flex flex-col">
          <button type="button" className="flex items-center gap-2 min-h-[40px] text-[14px] font-medium" style={{ color: "var(--color-accent)" }} onClick={() => setVerOrden((v) => !v)} aria-expanded={verOrden}>
            <Icon name={verOrden ? "chevron-up" : "chevron-down"} size={14} /> Orden de la reunión ({s.orden.length})
          </button>
          {verOrden && (
            <ol className="flex flex-col">
              {s.orden.map((o, i) => (
                <li key={o.id} className="flex items-center gap-3 min-h-[36px] text-[14px]" style={{ fontWeight: o.kind === "encabezado" ? 600 : undefined }}>
                  <span className="w-5 text-right tabular text-[12px]" style={{ color: "var(--color-faint)" }}>{o.kind === "encabezado" ? "" : i + 1}</span>
                  <span className="flex-1" style={{ color: "var(--color-ink)" }}>{o.title}</span>
                  {o.mia && <span className="chip chip-accent">Tú</span>}
                  {o.duration_sec > 0 && <span className="tabular text-[12px]" style={{ color: "var(--color-muted)" }}>{Math.round(o.duration_sec / 60)} min</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );
}
