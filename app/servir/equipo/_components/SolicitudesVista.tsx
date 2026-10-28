"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { responderSolicitud } from "@/app/servir/unirme/actions";
import { Aviso, Avatar } from "./ui";

export type SolicitudFila = { id: string; nombre: string; mensaje: string | null; fecha: string };

// Quién pidió unirse al departamento. Aprobar lo une a su persona y lo
// deja en el equipo; rechazar le avisa con la nota (si se escribe una).
export function SolicitudesVista({ solicitudes }: { solicitudes: SolicitudFila[] }) {
  const [err, setErr] = useState("");
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const [pendiente, start] = useTransition();

  function responder(id: string, aprobar: boolean) {
    setErr("");
    start(async () => {
      const r = await responderSolicitud(id, aprobar, aprobar ? undefined : nota);
      if (!r.ok) { setErr(r.error); return; }
      setHechas((h) => new Set(h).add(id));
      setRechazando(null); setNota("");
    });
  }

  const vista = solicitudes.filter((s) => !hechas.has(s.id));
  if (vista.length === 0) {
    return (
      <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
        No hay solicitudes pendientes. Quien entre al portal con Google o Apple y escoja este departamento aparecerá aquí.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {err && <Aviso texto={err} onClose={() => setErr("")} />}
      <ul className="grid gap-2 md:grid-cols-2">
        {vista.map((s) => (
          <li key={s.id} className="card px-4 py-3 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar nombre={s.nombre} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{s.nombre}</p>
                <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>Pidió unirse el {s.fecha}</p>
                {s.mensaje && <p className="text-[14px] mt-1" style={{ color: "var(--color-ink)" }}>“{s.mensaje}”</p>}
              </div>
            </div>
            {rechazando === s.id ? (
              <div className="flex flex-col gap-2">
                <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300}
                  placeholder="Nota para la persona (opcional)" autoFocus aria-label="Nota para la persona" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-primary" style={{ background: "var(--color-down)" }} disabled={pendiente} onClick={() => responder(s.id, false)}>No aprobar</button>
                  <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => setRechazando(null)}>Volver</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-primary" disabled={pendiente} onClick={() => responder(s.id, true)}>
                  <Icon name="check" /> Aprobar
                </button>
                <button type="button" className="btn-secondary" disabled={pendiente} onClick={() => { setRechazando(s.id); setNota(""); }}>
                  No aprobar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
