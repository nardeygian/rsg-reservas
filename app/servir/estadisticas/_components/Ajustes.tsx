"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/app/servir/equipo/_components/ui";
import { guardarAjustes } from "../actions";

type Valores = { sobrecargado_desde: number; alejandose_hasta: number; inactivo_semanas: number; ventana_dias: number };

const CAMPOS: { k: keyof Valores; t: string; min: number; max: number }[] = [
  { k: "sobrecargado_desde", t: "Sobrecargado desde (servicios)", min: 1, max: 30 },
  { k: "alejandose_hasta", t: "Alejándose con (servicios o menos)", min: 0, max: 29 },
  { k: "inactivo_semanas", t: "Inactivo tras (semanas sin servir)", min: 1, max: 52 },
  { k: "ventana_dias", t: "Ventana (días)", min: 7, max: 120 },
];

export function Ajustes({ ajustes }: { ajustes: Valores }) {
  const [abierto, setAbierto] = useState(false);
  const [v, setV] = useState<Valores>(ajustes);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pendiente, start] = useTransition();

  if (!abierto) {
    return (
      <button type="button" className="btn-secondary self-start" onClick={() => setAbierto(true)}>Ajustar umbrales</button>
    );
  }
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>Umbrales del semáforo</h2>
      {err && <Aviso texto={err} onClose={() => setErr("")} />}
      {ok && <Aviso texto={ok} tipo="ok" onClose={() => setOk("")} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAMPOS.map((c) => (
          <label key={c.k} className="flex flex-col gap-1.5">
            <span className="field-label">{c.t}</span>
            <input type="number" inputMode="numeric" className="input" min={c.min} max={c.max} value={v[c.k]}
              onChange={(e) => setV((x) => ({ ...x, [c.k]: Number(e.target.value) }))} />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={pendiente}
          onClick={() => { setErr(""); setOk(""); start(async () => { const r = await guardarAjustes(v); if (r.ok) setOk("Umbrales guardados."); else setErr(r.error); }); }}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => { setAbierto(false); setV(ajustes); }}>Cerrar</button>
      </div>
    </section>
  );
}
