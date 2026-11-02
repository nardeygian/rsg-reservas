"use client";

import { useState, useTransition } from "react";
import { analizarAtrasosDelPeriodo } from "../actions";

// Botón para pedirle a Claude el informe del periodo. El informe se guarda
// y la página lo muestra; solo se paga cuando alguien lo pide.
export function AnalisisAtrasos({ desde, hasta, hayDatos }: { desde: string; hasta: string; hayDatos: boolean }) {
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();
  return (
    <div className="flex flex-col gap-1.5 items-start">
      <button type="button" className="btn-primary" aria-busy={pendiente} disabled={pendiente || !hayDatos}
        onClick={() => { setError(""); start(async () => { const r = await analizarAtrasosDelPeriodo(desde, hasta); if (!r.ok) setError(r.error); }); }}>
        {pendiente ? "Analizando… (puede tardar un minuto)" : "Analizar"}
      </button>
      {!hayDatos && <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>No hay atrasos con motivo en este periodo.</p>}
      {error && <p role="alert" className="text-[13px]" style={{ color: "var(--color-critical)" }}>{error}</p>}
    </div>
  );
}
