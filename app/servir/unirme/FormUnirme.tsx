"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { Aviso } from "@/app/servir/equipo/_components/ui";
import { cancelarSolicitud, solicitarUnirse } from "./actions";

export type SolicitudPropia = {
  id: string;
  ministry_id: string;
  departamento: string;
  status: string;
  nota: string | null;
  fecha: string;
};

type Departamento = { id: string; name: string; estado: "miembro" | "pendiente" | null };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Esperando respuesta", clase: "chip-gold" },
  aprobada: { texto: "Aprobada", clase: "chip-up" },
  rechazada: { texto: "No aprobada", clase: "chip-down" },
};

export function FormUnirme({ departamentos, solicitudes }: { departamentos: Departamento[]; solicitudes: SolicitudPropia[] }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pendiente, start] = useTransition();

  function enviar() {
    if (!elegido) return;
    setErr(""); setOk("");
    start(async () => {
      const r = await solicitarUnirse(elegido, mensaje);
      if (!r.ok) { setErr(r.error); return; }
      setOk("Listo. Te avisaremos cuando el líder responda.");
      setElegido(null); setMensaje("");
    });
  }

  function cancelar(id: string) {
    setErr(""); setOk("");
    start(async () => {
      const r = await cancelarSolicitud(id);
      if (!r.ok) setErr(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {err && <Aviso texto={err} onClose={() => setErr("")} />}
      {ok && <Aviso texto={ok} tipo="ok" onClose={() => setOk("")} />}

      {solicitudes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow px-1">Tus solicitudes</h2>
          <ul className="card divide-y" style={{ borderColor: "var(--color-line)" }}>
            {solicitudes.map((s) => (
              <li key={s.id} className="px-4 py-3 flex items-center gap-3 min-h-[56px]">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{s.departamento}</span>
                  <span className="block text-[13px]" style={{ color: "var(--color-muted)" }}>
                    {s.fecha}{s.nota ? ` · ${s.nota}` : ""}
                  </span>
                </span>
                <span className={`chip ${ESTADO[s.status]?.clase ?? "chip-muted"} flex-none`}>{ESTADO[s.status]?.texto ?? s.status}</span>
                {s.status === "pendiente" && (
                  <button type="button" className="btn-ghost min-h-[40px] px-3 text-[14px]" disabled={pendiente} onClick={() => cancelar(s.id)}>
                    Cancelar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {solicitudes.some((s) => s.status === "aprobada") && (
            <Link href="/servir/mis-servicios" className="text-[14px] font-semibold inline-flex items-center gap-1 px-1" style={{ color: "var(--color-accent)" }}>
              Ver mis servicios <Icon name="arrow-right" size={14} />
            </Link>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow px-1">Departamentos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Departamento">
          {departamentos.map((d) => {
            const activo = elegido === d.id;
            const bloqueado = d.estado !== null;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={bloqueado || pendiente}
                onClick={() => setElegido(d.id)}
                className="card px-4 min-h-[56px] flex items-center gap-3 text-left disabled:opacity-60"
                style={activo ? { borderColor: "var(--color-accent)", boxShadow: "0 0 0 1px var(--color-accent)" } : undefined}
              >
                <span className="flex-1 text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{d.name}</span>
                {d.estado === "miembro" && <span className="chip chip-up">Ya estás</span>}
                {d.estado === "pendiente" && <span className="chip chip-gold">Pendiente</span>}
                {activo && <Icon name="check-circle" size={20} style={{ color: "var(--color-accent)" }} />}
              </button>
            );
          })}
        </div>
      </section>

      {elegido && (
        <section className="card p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Mensaje para el líder (opcional)</span>
            <textarea
              className="input min-h-[88px] py-2"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              maxLength={500}
              placeholder="Por ejemplo: toco guitarra y puedo los domingos"
            />
          </label>
          <button type="button" className="btn-primary" disabled={pendiente} onClick={enviar}>
            {pendiente ? "Enviando…" : "Enviar solicitud"}
          </button>
        </section>
      )}
    </div>
  );
}
