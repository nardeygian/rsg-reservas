"use client";

import { useState, useTransition } from "react";
import { guardarEspacios } from "../actions";
import { EspaciosSelector, type EspacioOpcion, type EstadoReserva, type ValorEspacios } from "../_components/EspaciosSelector";

// Espacios de la reunión con su montaje y desmonte. Si la reunión está
// publicada, guardar reserva, mueve o libera en Reservas en el mismo paso.
export function EspaciosReunion({
  meetingId, espacios, inicial, inicio, fin, status, reservas, editable,
}: {
  meetingId: string;
  espacios: EspacioOpcion[];
  inicial: ValorEspacios;
  inicio: string | null;
  fin: string | null;
  status: string;
  reservas: Record<string, EstadoReserva>;
  editable: boolean;
}) {
  const [valor, setValor] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendiente, start] = useTransition();
  const cambio = JSON.stringify({ ...valor, space_ids: [...valor.space_ids].sort() }) !== JSON.stringify({ ...inicial, space_ids: [...inicial.space_ids].sort() });
  const publicada = status === "publicada" || status === "en_vivo" || status === "cerrada";

  function guardar() {
    setError(null); setOk(null);
    start(async () => {
      const r = await guardarEspacios(meetingId, valor);
      if (!r.ok) setError(r.error);
      else setOk(publicada ? "Listo. Reservas ya muestra estos espacios ocupados." : "Guardado. Se reservan al publicar la reunión.");
    });
  }

  // Lo que se muestra en el selector: espacios activos y los ya escogidos
  // aunque luego se hayan desactivado.
  const visibles = espacios;

  return (
    <section className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>Espacios</h2>
        {!publicada && valor.space_ids.length > 0 && <span className="chip chip-gold">Se reservan al publicar</span>}
      </div>
      <EspaciosSelector
        espacios={visibles}
        valor={valor}
        onChange={(v) => { setValor(v); setOk(null); }}
        inicio={inicio}
        fin={fin}
        meetingId={meetingId}
        reservas={reservas}
        editable={editable && !pendiente}
        nota={editable ? undefined : "Solo Planeación, un pastor de sede o un super admin cambian espacios, montaje y desmonte."}
      />
      {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
      {ok && <p role="status" className="text-[14px] font-medium" style={{ color: "var(--color-up)" }}>{ok}</p>}
      {editable && (
        <button type="button" className="btn-primary self-start" disabled={!cambio || pendiente} onClick={guardar}>
          {pendiente ? "Guardando…" : "Guardar espacios"}
        </button>
      )}
    </section>
  );
}
