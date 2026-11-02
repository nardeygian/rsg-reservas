"use client";

import { useState, useTransition } from "react";
import { registrarAsistentes } from "./actions";

export type JornadaConteo = {
  id: string | null;          // nulo: el orden no tiene "Inicio de reunión"
  titulo: string;
  cantidad: number | null;
  quien: string | null;
  terminada: boolean;         // ya pasó: toca registrar
};

// Número de asistentes de cada reunión del día. Lo escribe el líder de
// Protocolo (o quien conduce); los demás lo ven.
export function Asistentes({ meetingId, jornadas, editable }: { meetingId: string; jornadas: JornadaConteo[]; editable: boolean }) {
  const pendientes = jornadas.filter((j) => j.terminada && j.cantidad === null);
  return (
    <section className="card p-4 flex flex-col gap-3" style={editable && pendientes.length ? { borderColor: "var(--color-gold-text)" } : undefined}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>Asistentes</h2>
        {editable && pendientes.length > 0 && (
          <p className="text-[13px] font-medium" style={{ color: "var(--color-gold-text)" }}>
            Registra los asistentes de {pendientes.map((j) => j.titulo).join(" y ")}.
          </p>
        )}
      </div>
      <ul className="flex flex-col">
        {jornadas.map((j) => <Fila key={j.id ?? "unica"} meetingId={meetingId} jornada={j} editable={editable} />)}
      </ul>
      {jornadas.length > 1 && jornadas.every((j) => j.cantidad !== null) && (
        <p className="text-[13px] tabular" style={{ color: "var(--color-muted)" }}>
          Total del día: {jornadas.reduce((a, j) => a + (j.cantidad ?? 0), 0)}
        </p>
      )}
    </section>
  );
}

function Fila({ meetingId, jornada, editable }: { meetingId: string; jornada: JornadaConteo; editable: boolean }) {
  const [valor, setValor] = useState(jornada.cantidad?.toString() ?? "");
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();
  const n = Number(valor);
  const cambio = valor !== "" && valor !== (jornada.cantidad?.toString() ?? "");
  return (
    <li className="flex flex-col gap-1 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-[14px] truncate" style={{ color: "var(--color-ink)" }}>{jornada.titulo}</span>
        {editable ? (
          <form className="flex items-center gap-1.5" onSubmit={(e) => {
            e.preventDefault();
            setError("");
            start(async () => { const r = await registrarAsistentes(meetingId, jornada.id, n); if (!r.ok) setError(r.error); });
          }}>
            <input className="input w-[92px] min-h-[40px] tabular text-right" inputMode="numeric" placeholder="0" value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label={`Asistentes de ${jornada.titulo}`} />
            <button type="submit" className="btn-primary min-h-[40px] px-3" aria-busy={pendiente} disabled={pendiente || !cambio}>Guardar</button>
          </form>
        ) : (
          <span className="text-[15px] font-semibold tabular" style={{ color: "var(--color-ink)" }}>{jornada.cantidad ?? "—"}</span>
        )}
      </div>
      {jornada.quien && (
        <span className="text-[12px]" style={{ color: "var(--color-faint)" }}>Registró {jornada.quien}</span>
      )}
      {error && <span role="alert" className="text-[12px]" style={{ color: "var(--color-critical)" }}>{error}</span>}
    </li>
  );
}
