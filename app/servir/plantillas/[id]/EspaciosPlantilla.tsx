"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarEspaciosPlantilla } from "../actions";
import { EspaciosSelector, type EspacioOpcion, type ValorEspacios } from "../../reuniones/_components/EspaciosSelector";

// Espacios, montaje y desmonte de la plantilla. "Igual que el tipo" deja la
// plantilla en null y las reuniones toman lo del tipo de reunión.
export function EspaciosPlantilla({
  plantillaId, espacios, propios, delTipo, editable,
}: {
  plantillaId: string;
  espacios: EspacioOpcion[];
  propios: ValorEspacios | null;
  delTipo: ValorEspacios;
  editable: boolean;
}) {
  const router = useRouter();
  const [usarTipo, setUsarTipo] = useState(propios === null);
  const [valor, setValor] = useState<ValorEspacios>(propios ?? delTipo);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, start] = useTransition();

  function guardar() {
    setError(null); setOk(false);
    start(async () => {
      const r = await guardarEspaciosPlantilla(plantillaId, usarTipo ? null : valor);
      if (!r.ok) return setError(r.error);
      setOk(true);
      router.refresh();
    });
  }

  return (
    <section className="card p-4 md:p-5 flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold">Espacios, montaje y desmonte</h2>
      <label className="flex items-center gap-3 text-[14px] cursor-pointer">
        <input type="checkbox" className="accent-[var(--color-accent)]" checked={usarTipo} disabled={!editable}
          onChange={(e) => { setUsarTipo(e.target.checked); if (e.target.checked) setValor(delTipo); setOk(false); }} />
        Igual que el tipo de reunión
      </label>
      <EspaciosSelector
        plantilla
        espacios={espacios}
        valor={usarTipo ? delTipo : valor}
        onChange={(v) => { setValor(v); setOk(false); }}
        inicio={null}
        fin={null}
        editable={editable && !usarTipo && !pendiente}
        nota={editable ? "Las reuniones nuevas con esta plantilla llegan con estos espacios y tiempos." : "Solo Planeación, un pastor de sede o un super admin cambian espacios, montaje y desmonte."}
      />
      {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
      {ok && <p role="status" className="text-[14px] font-medium" style={{ color: "var(--color-up)" }}>Guardado.</p>}
      {editable && <button type="button" className="btn-secondary self-start" disabled={pendiente} onClick={guardar}>Guardar espacios</button>}
    </section>
  );
}
