"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { borrarBloqueo, guardarBloqueo } from "@/app/servir/equipo/_lib/acciones";
import { Aviso } from "@/app/servir/equipo/_components/ui";

export type BloqueoFila = { id: string; rango: string; reason: string | null };

// Fechas en que no puedo servir. Mi líder las ve al asignar.
export function Bloqueos({ bloqueos, hoy }: { bloqueos: BloqueoFila[]; hoy: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [err, setErr] = useState("");
  const [pendiente, start] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    start(async () => {
      const r = await guardarBloqueo({ starts_on: desde, ends_on: hasta || desde, reason: motivo });
      if (r.ok) { setDesde(""); setHasta(""); setMotivo(""); setAbierto(false); } else setErr(r.error);
    });
  }

  function borrar(id: string) {
    setErr("");
    start(async () => { const r = await borrarBloqueo(id); if (!r.ok) setErr(r.error); });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="eyebrow flex-1">Fechas en que no puedo</h2>
        {!abierto && (
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-[14px]" style={{ color: "var(--color-accent)" }} onClick={() => setAbierto(true)}>
            <Icon name="plus" size={14} /> Agregar
          </button>
        )}
      </div>

      {err && <Aviso texto={err} onClose={() => setErr("")} />}

      {abierto && (
        <form onSubmit={guardar} className="card px-4 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="field-label">Desde</span>
              <input type="date" className="input" min={hoy} value={desde} onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} required />
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="field-label">Hasta</span>
              <input type="date" className="input" min={desde || hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Motivo (opcional)</span>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Viaje, exámenes…" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" className="btn-primary" disabled={pendiente || !desde}>Guardar</button>
            <button type="button" className="btn-secondary" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {bloqueos.length === 0 && !abierto ? (
        <p className="card px-4 py-4 text-[14px]" style={{ color: "var(--color-muted)" }}>
          No tienes fechas bloqueadas. Si vas a viajar o no puedes servir, márcalo aquí para que tu líder no te asigne.
        </p>
      ) : bloqueos.length > 0 && (
        <ul className="card divide-y overflow-hidden">
          {bloqueos.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 min-h-[56px]" style={{ borderColor: "var(--color-line)" }}>
              <Icon name="lock" style={{ color: "var(--color-down)" }} />
              <span className="flex-1 min-w-0 py-2">
                <span className="block text-[15px]" style={{ color: "var(--color-ink)" }}>{b.rango}</span>
                {b.reason && <span className="block text-[13px] truncate" style={{ color: "var(--color-muted)" }}>{b.reason}</span>}
              </span>
              <button type="button" className="icon-btn" aria-label={`Borrar bloqueo ${b.rango}`} disabled={pendiente} onClick={() => borrar(b.id)}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
