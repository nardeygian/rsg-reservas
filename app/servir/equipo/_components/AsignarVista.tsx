"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { SugerenciaAsignacion } from "@/lib/servir/contratos";
import { asignar, cancelarAsignacion, sugerirServidores } from "../_lib/acciones";
import { Aviso, Avatar, EstadoChip, Hoja } from "./ui";

export type AsignadoFila = {
  id: string;
  person_id: string;
  full_name: string;
  status: string;
  decline_reason: string | null;
  checklist: { hechos: number; total: number } | null;   // null: RLS no lo deja ver
};
export type PosicionAsignar = { id: string; name: string; requeridas: number | null; asignados: AsignadoFila[] };

export function AsignarVista({ meetingId, reunionNombre, posiciones, editable }: {
  meetingId: string;
  reunionNombre: string;
  posiciones: PosicionAsignar[];
  editable: boolean;
}) {
  const [abierta, setAbierta] = useState<PosicionAsignar | null>(null);
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();

  function quitar(id: string) {
    setError("");
    start(async () => { const r = await cancelarAsignacion(id); if (!r.ok) setError(r.error); });
  }

  if (posiciones.length === 0) {
    return (
      <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
        Tu equipo aún no tiene posiciones. Créalas en Mi equipo › Posiciones.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Aviso texto={error} onClose={() => setError("")} />}
      <ul className="grid gap-2 md:grid-cols-2">
        {posiciones.map((p) => {
          const activos = p.asignados.filter((a) => a.status !== "rechazada");
          const falta = p.requeridas != null && activos.length < p.requeridas;
          return (
            <li key={p.id} className="card px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{p.name}</span>
                  {p.requeridas != null && (
                    <span className="block text-[12px] tabular" style={{ color: falta ? "var(--color-gold-text)" : "var(--color-muted)" }}>
                      {activos.length} de {p.requeridas} {falta ? "· falta cubrir" : "· cubierta"}
                    </span>
                  )}
                </span>
                {editable && (
                  <button type="button" className="btn-secondary min-h-[40px] px-3 text-[14px]" onClick={() => setAbierta(p)}>
                    <Icon name="plus" size={14} /> Asignar
                  </button>
                )}
              </div>
              {p.asignados.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>Sin asignar</p>
              ) : (
                <ul className="flex flex-col">
                  {p.asignados.map((a) => (
                    <li key={a.id} className="flex items-center gap-2.5 min-h-[48px] py-1">
                      <Avatar nombre={a.full_name} size={30} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] truncate" style={{ color: "var(--color-ink)" }}>{a.full_name}</span>
                        {a.status === "rechazada" && a.decline_reason && (
                          <span className="block text-[12px] truncate" style={{ color: "var(--color-down)" }}>“{a.decline_reason}”</span>
                        )}
                        {a.status === "aceptada" && a.checklist && a.checklist.total > 0 && (
                          <span className="block text-[12px] tabular" style={{ color: a.checklist.hechos === a.checklist.total ? "var(--color-up)" : "var(--color-muted)" }}>
                            Checklist {a.checklist.hechos}/{a.checklist.total}
                          </span>
                        )}
                      </span>
                      <EstadoChip estado={a.status} />
                      {editable && (
                        <button type="button" className="icon-btn" aria-label={`Quitar a ${a.full_name}`} disabled={pendiente} onClick={() => quitar(a.id)}>
                          <Icon name="close" size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {abierta && (
        <SugerenciasHoja meetingId={meetingId} reunionNombre={reunionNombre} posicion={abierta} onClose={() => setAbierta(null)} />
      )}
    </div>
  );
}

function SugerenciasHoja({ meetingId, reunionNombre, posicion, onClose }: {
  meetingId: string; reunionNombre: string; posicion: PosicionAsignar; onClose: () => void;
}) {
  const [lista, setLista] = useState<SugerenciaAsignacion[] | null>(null);
  const [err, setErr] = useState("");
  const [cargando, startCarga] = useTransition();
  const [pendiente, start] = useTransition();

  useEffect(() => {
    startCarga(async () => {
      const r = await sugerirServidores(meetingId, posicion.id);
      if (r.ok) setLista(r.data); else setErr(r.error);
    });
  }, [meetingId, posicion.id]);

  function elegir(s: SugerenciaAsignacion) {
    setErr("");
    start(async () => {
      const r = await asignar(meetingId, s.person_id, posicion.id);
      if (r.ok) onClose(); else setErr(r.error);
    });
  }

  return (
    <Hoja titulo={posicion.name} subtitulo={`Asignar · ${reunionNombre}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {err && <Aviso texto={err} />}
        {(cargando || lista === null) && !err && (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-[52px] rounded-[var(--radius-control)] animate-pulse" style={{ background: "var(--color-surface-2)" }} />)}
          </div>
        )}
        {lista && lista.length === 0 && (
          <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
            Nadie más del equipo tiene esta posición. Márcala en la ficha de cada persona (Mi equipo › Miembros).
          </p>
        )}
        {lista && lista.length > 0 && (
          <>
            <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>Primero quien está libre y ha servido menos este mes.</p>
            <ul className="flex flex-col">
              {lista.map((s) => (
                <li key={s.person_id}>
                  <button type="button" disabled={pendiente} onClick={() => elegir(s)}
                    className="w-full flex items-center gap-3 min-h-[56px] py-2 text-left rounded-[var(--radius-control)] px-2 -mx-2 transition hover:bg-[var(--color-surface-2)]"
                    style={s.bloqueado ? { opacity: 0.6 } : undefined}>
                    <Avatar nombre={s.full_name} size={34} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px]" style={{ color: "var(--color-ink)" }}>{s.full_name}</span>
                      <span className="block text-[12px] tabular" style={{ color: "var(--color-muted)" }}>
                        {s.servicios_mes} {s.servicios_mes === 1 ? "servicio" : "servicios"} este mes
                      </span>
                    </span>
                    {s.bloqueado && <span className="chip chip-down flex-none"><Icon name="lock" size={11} style={{ marginRight: 4 }} />No puede</span>}
                    {!s.bloqueado && s.ya_asignado && <span className="chip chip-gold flex-none">Ya sirve</span>}
                    {!s.bloqueado && !s.ya_asignado && <Icon name="plus" style={{ color: "var(--color-accent)" }} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Hoja>
  );
}
