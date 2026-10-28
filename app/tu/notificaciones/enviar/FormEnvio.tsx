"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { enviarMasivoForm, type EstadoEnvio } from "@/lib/notificaciones/acciones";

export type OpcionAudiencia = { valor: string; etiqueta: string; grupo: string };

export function FormEnvio({ opciones }: { opciones: OpcionAudiencia[] }) {
  const [estado, accion, enviando] = useActionState<EstadoEnvio, FormData>(enviarMasivoForm, null);
  const [programar, setProgramar] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) { form.current?.reset(); setProgramar(false); }
  }, [estado]);

  const grupos = [...new Set(opciones.map((o) => o.grupo))];

  return (
    <form ref={form} action={accion} className="card p-4 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="field-label">Para</span>
        <select name="audiencia" required className="input" defaultValue={opciones.length === 1 ? opciones[0].valor : ""}>
          {opciones.length > 1 && <option value="" disabled>Elige a quién</option>}
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {opciones.filter((o) => o.grupo === g).map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">Título</span>
        <input name="titulo" required maxLength={80} className="input" placeholder="Ensayo el sábado" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">Mensaje</span>
        <textarea name="mensaje" required maxLength={500} rows={4} className="input py-3" placeholder="Nos vemos a las 3:00 p. m. en el auditorio." />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">Enlace (opcional)</span>
        <input name="enlace" className="input" placeholder="/servir/mis-servicios" pattern="/[^/].*|/" />
        <span className="text-[12px]" style={{ color: "var(--color-faint)" }}>Una página del portal que se abre al tocar el aviso.</span>
      </label>

      <label className="flex items-center gap-3 min-h-[44px]">
        <input type="checkbox" checked={programar} onChange={(e) => setProgramar(e.target.checked)} className="w-5 h-5 accent-[var(--color-accent)]" />
        <span className="text-[15px]" style={{ color: "var(--color-ink)" }}>Programar para más tarde</span>
      </label>
      {programar && (
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Fecha y hora (Bogotá)</span>
          <input type="datetime-local" name="programar" required className="input" />
        </label>
      )}

      {estado && (
        <p role={estado.ok ? "status" : "alert"} className="text-[14px]" style={{ color: estado.ok ? "var(--color-up)" : "var(--color-down)" }}>
          {estado.mensaje}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn-primary disabled:opacity-60">
        {enviando ? "Enviando…" : programar ? "Programar aviso" : "Enviar ahora"}
      </button>
    </form>
  );
}
