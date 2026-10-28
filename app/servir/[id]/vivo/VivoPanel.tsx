"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import type { EstadoAsistencia } from "@/lib/servir/contratos";
import { marcarChecklist } from "@/app/servir/equipo/_lib/acciones";
import { Aviso, MOMENTO_TEXTO } from "@/app/servir/equipo/_components/ui";
import { avanzarItem, confirmarAsistencia, iniciarReunion, terminarReunion } from "./actions";

export type ItemVivo = {
  id: string; kind: string; title: string; duration_sec: number; notes: string | null;
  song_id: string | null; song_key: string | null; actual_start: string | null; actual_end: string | null;
};
export type MiServicio = { posiciones: string[]; checklist: { id: string; moment: string; text: string; done: boolean }[] };
export type ServidorVivo = {
  person_id: string; nombre: string; posiciones: string[]; departamento: string;
  hechos: number; total: number; visible: boolean;   // visible: RLS devolvió su checklist
};
export type AsistenciaFila = {
  person_id: string; nombre: string; roles: string[]; departamentos: string[];
  respuesta: string | null; hechos: number; total: number;
  estado: EstadoAsistencia | null; confirmada: boolean; nota: string | null;
};

type Props = {
  meeting: { id: string; status: string; current_item_id: string | null; actual_start: string | null; cerrada: boolean };
  items: ItemVivo[];
  mio: MiServicio | null;
  equipo: ServidorVivo[];
  asistencia: AsistenciaFila[];
  puede: { vivo: boolean; cerrarAsistencia: boolean; confirmar: boolean };
  assignmentIds: string[];
};

const MOMENTOS = ["antes", "durante", "despues"];

function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(Math.abs(seg)));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${seg < 0 ? "−" : ""}${h ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

// Cualquier cambio en la reunión, su orden, sus asignaciones o checklists
// vuelve a pedir la página al servidor (RLS filtra de nuevo). Realtime solo
// avisa; no se confía en lo que trae el evento.
function useEnVivo(meetingId: string, assignmentIds: string[]) {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ids = assignmentIds.slice(0, 100).join(",");
  useEffect(() => {
    const sb = createClient();
    const refrescar = () => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => router.refresh(), 400);
    };
    let canal = sb.channel(`vivo-${meetingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings", filter: `id=eq.${meetingId}` }, refrescar)
      .on("postgres_changes", { event: "*", schema: "public", table: "run_items", filter: `meeting_id=eq.${meetingId}` }, refrescar)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments", filter: `meeting_id=eq.${meetingId}` }, refrescar)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `meeting_id=eq.${meetingId}` }, refrescar);
    if (ids) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: "checklist_items", filter: `assignment_id=in.(${ids})` }, refrescar);
    }
    canal.subscribe();
    // Si la pestaña estuvo dormida (celular bloqueado), se pone al día al volver.
    const alVolver = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      if (espera.current) clearTimeout(espera.current);
      document.removeEventListener("visibilitychange", alVolver);
      sb.removeChannel(canal);
    };
  }, [meetingId, ids, router]);
}

function useAhora(activo: boolean) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activo]);
  return ahora;
}

export function VivoPanel({ meeting, items, mio, equipo, asistencia, puede, assignmentIds }: Props) {
  useEnVivo(meeting.id, assignmentIds);
  const enVivo = meeting.status === "en_vivo";
  const ahora = useAhora(enVivo);
  const [err, setErr] = useState("");
  const [pendiente, start] = useTransition();

  const idxActual = items.findIndex((i) => i.id === meeting.current_item_id);
  const actual = idxActual >= 0 ? items[idxActual] : null;
  const transcurrido = actual?.actual_start ? (ahora - Date.parse(actual.actual_start)) / 1000 : 0;
  const restante = actual ? actual.duration_sec - transcurrido : 0;
  const totalReunion = meeting.actual_start ? (ahora - Date.parse(meeting.actual_start)) / 1000 : 0;

  function correr(f: () => Promise<{ ok: boolean; error?: string }>) {
    setErr("");
    start(async () => {
      const r = await f();
      if (!r.ok) setErr(r.error ?? "No se pudo completar.");
    });
  }

  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="flex flex-col gap-5 min-w-0">
        {err && <Aviso texto={err} onClose={() => setErr("")} />}

        {meeting.status === "publicada" && (
          <section className="card p-4 flex flex-col gap-3">
            <p className="text-[15px]" style={{ color: "var(--color-ink)" }}>
              {puede.vivo ? "Cuando empiece la reunión, ábrela en vivo: todos verán el orden y el punto actual." : "La reunión todavía no está en vivo. Aquí verás el punto actual cuando empiece."}
            </p>
            {puede.vivo && (
              <button type="button" className="btn-primary self-start" disabled={pendiente} onClick={() => correr(() => iniciarReunion(meeting.id))}>
                {pendiente ? "Abriendo…" : "Abrir en vivo"}
              </button>
            )}
          </section>
        )}

        {enVivo && (
          <section className="card p-4 flex flex-col gap-3" aria-live="polite" style={{ borderColor: "var(--color-up)" }}>
            <div className="flex items-center gap-2">
              <span className="chip chip-up">En vivo</span>
              <span className="text-[13px] tabular" style={{ color: "var(--color-muted)" }}>Reunión: {reloj(totalReunion)}</span>
            </div>
            {actual ? (
              <>
                <p className="eyebrow">Ahora · {idxActual + 1} de {items.length}</p>
                <h2 className="text-[24px] md:text-[28px] font-semibold leading-tight" style={{ color: "var(--color-ink)" }}>{actual.title}</h2>
                {actual.song_key && <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>Tono {actual.song_key}</p>}
                {actual.duration_sec > 0 && (
                  <p className="text-[34px] font-semibold tabular leading-none" style={{ color: restante < 0 ? "var(--color-down)" : "var(--color-ink)" }}>
                    {reloj(restante)}
                    <span className="text-[14px] font-medium ml-2" style={{ color: "var(--color-muted)" }}>
                      {restante < 0 ? "pasado" : "restante"} de {Math.round(actual.duration_sec / 60)} min
                    </span>
                  </p>
                )}
                {actual.notes && <p className="text-[14px]" style={{ color: "var(--color-ink)" }}>{actual.notes}</p>}
                {actual.song_id && (
                  <Link href={`/servir/canciones/${actual.song_id}/letra?item=${actual.id}`} className="btn-secondary self-start">Ver letra</Link>
                )}
              </>
            ) : (
              <p className="text-[15px]" style={{ color: "var(--color-muted)" }}>Sin punto actual.</p>
            )}
            {puede.vivo && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" className="btn-secondary" disabled={pendiente || idxActual <= 0}
                  onClick={() => correr(() => avanzarItem(meeting.id, items[idxActual - 1]?.id ?? null))}>
                  <Icon name="chevron-left" /> Anterior
                </button>
                <button type="button" className="btn-primary" disabled={pendiente || items.length === 0}
                  onClick={() => correr(() => avanzarItem(meeting.id, items[idxActual + 1]?.id ?? null))}>
                  {idxActual + 1 >= items.length ? "Fin del orden" : "Siguiente"} <Icon name="chevron-right" />
                </button>
              </div>
            )}
          </section>
        )}

        <Orden items={items} actualId={meeting.current_item_id} puedeSaltar={puede.vivo && enVivo} pendiente={pendiente}
          onSaltar={(id) => correr(() => avanzarItem(meeting.id, id))} />

        {puede.vivo && enVivo && (
          <button type="button" className="btn-secondary self-start" disabled={pendiente}
            onClick={() => { if (confirm("¿Terminar la reunión? Se guarda la hora real de fin.")) correr(() => terminarReunion(meeting.id)); }}>
            Terminar reunión
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 min-w-0">
        {mio && <MiChecklist mio={mio} editable={meeting.status === "en_vivo" || meeting.status === "publicada"} />}
        {equipo.length > 0 && <Equipo equipo={equipo} />}
        {puede.confirmar && (
          <Asistencia meetingId={meeting.id} filas={asistencia} puedeCerrar={puede.cerrarAsistencia} cerrada={meeting.cerrada} />
        )}
        {meeting.cerrada && !puede.confirmar && (
          <p className="card px-4 py-3 text-[14px]" style={{ color: "var(--color-muted)" }}>La asistencia de esta reunión ya se cerró.</p>
        )}
      </div>
    </div>
  );
}

function Orden({ items, actualId, puedeSaltar, pendiente, onSaltar }: {
  items: ItemVivo[]; actualId: string | null; puedeSaltar: boolean; pendiente: boolean; onSaltar: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="card px-4 py-5 text-[14px]" style={{ color: "var(--color-muted)" }}>Esta reunión no tiene orden todavía.</p>;
  }
  let n = 0;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow px-1">Orden</h2>
      <ol className="card overflow-hidden">
        {items.map((i) => {
          const esActual = i.id === actualId;
          const hecho = !!i.actual_end && !esActual;
          const real = i.actual_start && i.actual_end ? (Date.parse(i.actual_end) - Date.parse(i.actual_start)) / 1000 : null;
          if (i.kind !== "encabezado") n += 1;
          const contenido = (
            <>
              <span className="w-6 text-right tabular text-[12px] flex-none" style={{ color: "var(--color-faint)" }}>
                {i.kind === "encabezado" ? "" : hecho ? <Icon name="check" size={14} style={{ color: "var(--color-up)" }} /> : n}
              </span>
              <span className="flex-1 min-w-0 text-[15px] truncate"
                style={{ color: hecho ? "var(--color-muted)" : "var(--color-ink)", fontWeight: esActual || i.kind === "encabezado" ? 600 : 400 }}>
                {i.title}
              </span>
              {i.duration_sec > 0 && (
                <span className="tabular text-[12px] flex-none" style={{ color: real !== null && real > i.duration_sec * 1.1 ? "var(--color-down)" : "var(--color-muted)" }}>
                  {real !== null ? `${Math.round(real / 60)}/` : ""}{Math.round(i.duration_sec / 60)} min
                </span>
              )}
            </>
          );
          const estilo = esActual ? { background: "var(--color-up-soft)" } : undefined;
          return (
            <li key={i.id} className="border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
              {puedeSaltar && i.kind !== "encabezado" ? (
                <button type="button" disabled={pendiente} onClick={() => onSaltar(i.id)} aria-current={esActual ? "step" : undefined}
                  className="w-full flex items-center gap-3 px-4 min-h-[48px] text-left" style={estilo}>{contenido}</button>
              ) : (
                <div className="flex items-center gap-3 px-4 min-h-[44px]" style={estilo} aria-current={esActual ? "step" : undefined}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MiChecklist({ mio, editable }: { mio: MiServicio; editable: boolean }) {
  const [hechos, setHechos] = useState(() => new Set(mio.checklist.filter((c) => c.done).map((c) => c.id)));
  const [err, setErr] = useState("");
  const [, start] = useTransition();
  // Lo que llega del servidor (otro dispositivo, Planeación) manda.
  const firma = mio.checklist.map((c) => `${c.id}:${c.done ? 1 : 0}`).join(",");
  useEffect(() => { setHechos(new Set(mio.checklist.filter((c) => c.done).map((c) => c.id))); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps

  function marcar(id: string) {
    const hecho = !hechos.has(id);
    setHechos((h) => { const n = new Set(h); if (hecho) n.add(id); else n.delete(id); return n; });
    setErr("");
    start(async () => {
      const r = await marcarChecklist(id, hecho);
      if (!r.ok) {
        setErr(r.error);
        setHechos((h) => { const n = new Set(h); if (hecho) n.delete(id); else n.add(id); return n; });
      }
    });
  }

  const total = mio.checklist.length;
  const listo = total > 0 && hechos.size === total;
  return (
    <section className="card p-4 flex flex-col gap-3" style={listo ? { borderColor: "var(--color-up)", background: "var(--color-up-soft)" } : undefined}>
      <div className="flex items-center gap-2">
        <h2 className="text-[17px] font-semibold flex-1" style={{ color: "var(--color-ink)" }}>Tu servicio</h2>
        {listo && <span className="chip chip-up"><Icon name="check" size={12} style={{ marginRight: 4 }} />Listo</span>}
      </div>
      <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>{mio.posiciones.join(" · ")}</p>
      {err && <Aviso texto={err} />}
      {total === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>Tu posición no tiene checklist.</p>
      ) : (
        <>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(hechos.size / total) * 100}%`, background: "var(--color-up)" }} />
          </div>
          {MOMENTOS.map((m) => {
            const lista = mio.checklist.filter((c) => c.moment === m);
            if (!lista.length) return null;
            return (
              <div key={m} className="flex flex-col">
                <p className="eyebrow pt-1">{MOMENTO_TEXTO[m]}</p>
                {lista.map((c) => {
                  const on = hechos.has(c.id);
                  return (
                    <button key={c.id} type="button" role="checkbox" aria-checked={on} disabled={!editable} onClick={() => marcar(c.id)}
                      className="flex items-center gap-3 min-h-[44px] text-left">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-none transition"
                        style={on ? { background: "var(--color-up)", color: "var(--color-accent-ink)" } : { border: "1.5px solid var(--color-line-strong)" }}>
                        {on && <Icon name="check" size={14} strokeWidth={2.6} />}
                      </span>
                      <span className="text-[15px]" style={{ color: on ? "var(--color-muted)" : "var(--color-ink)", textDecoration: on ? "line-through" : undefined }}>{c.text}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function Equipo({ equipo }: { equipo: ServidorVivo[] }) {
  const grupos = useMemo(() => {
    const g = new Map<string, ServidorVivo[]>();
    for (const s of equipo) g.set(s.departamento, [...(g.get(s.departamento) ?? []), s]);
    return [...g.entries()];
  }, [equipo]);
  const conChecklist = equipo.filter((s) => s.visible);
  const listos = conChecklist.filter((s) => s.total > 0 && s.hechos === s.total).length;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="eyebrow flex-1">Equipo</h2>
        {conChecklist.length > 0 && <span className="text-[12px] tabular" style={{ color: "var(--color-muted)" }}>{listos}/{conChecklist.length} listos</span>}
      </div>
      <div className="card overflow-hidden">
        {grupos.map(([dep, lista]) => (
          <div key={dep} className="border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
            <p className="eyebrow px-4 pt-3">{dep}</p>
            <ul>
              {lista.map((s) => {
                const listo = s.total > 0 && s.hechos === s.total;
                return (
                  <li key={s.person_id} className="px-4 py-2 flex items-center gap-3 min-h-[48px]">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium truncate" style={{ color: "var(--color-ink)" }}>{s.nombre}</span>
                      <span className="block text-[12px] truncate" style={{ color: "var(--color-muted)" }}>{s.posiciones.join(" · ")}</span>
                    </span>
                    {s.visible ? (
                      <span className="flex items-center gap-2 flex-none">
                        <span className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                          <span className="block h-full rounded-full" style={{ width: `${s.total ? (s.hechos / s.total) * 100 : 0}%`, background: "var(--color-up)" }} />
                        </span>
                        <span className={`chip ${listo ? "chip-up" : "chip-muted"} tabular`}>{s.hechos}/{s.total}</span>
                      </span>
                    ) : (
                      <span className="chip chip-muted flex-none">Aceptó</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const OPCIONES: { v: EstadoAsistencia; t: string }[] = [
  { v: "asistio", t: "Asistió" },
  { v: "tarde", t: "Tarde" },
  { v: "ausente", t: "Ausente" },
];

function Asistencia({ meetingId, filas, puedeCerrar, cerrada }: { meetingId: string; filas: AsistenciaFila[]; puedeCerrar: boolean; cerrada: boolean }) {
  const [estados, setEstados] = useState<Record<string, EstadoAsistencia | null>>(() => Object.fromEntries(filas.map((f) => [f.person_id, f.estado])));
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pendiente, start] = useTransition();
  const faltan = filas.filter((f) => !estados[f.person_id]).length;

  function guardar(cerrar: boolean) {
    setErr(""); setOk("");
    const lista = filas
      .filter((f) => estados[f.person_id])
      .map((f) => ({ person_id: f.person_id, status: estados[f.person_id]!, roles: f.roles }));
    start(async () => {
      const r = await confirmarAsistencia(meetingId, lista, { cerrar });
      if (!r.ok) setErr(r.error);
      else setOk(cerrar ? "Asistencia confirmada y reunión cerrada." : "Asistencia guardada.");
    });
  }

  if (filas.length === 0) {
    return <p className="card px-4 py-4 text-[14px]" style={{ color: "var(--color-muted)" }}>No hay asignados para confirmar.</p>;
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="eyebrow flex-1">Asistencia</h2>
        {cerrada && <span className="chip chip-muted">Cerrada</span>}
      </div>
      {err && <Aviso texto={err} onClose={() => setErr("")} />}
      {ok && <Aviso texto={ok} tipo="ok" onClose={() => setOk("")} />}
      <ul className="card overflow-hidden">
        {filas.map((f) => (
          <li key={f.person_id} className="px-4 py-3 flex flex-col gap-2 border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
            <div className="flex items-start gap-2">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>{f.nombre}</span>
                <span className="block text-[12px]" style={{ color: "var(--color-muted)" }}>
                  {f.roles.join(" · ")}{f.total > 0 ? ` · checklist ${f.hechos}/${f.total}` : ""}
                  {f.respuesta && f.respuesta !== "aceptada" ? ` · ${f.respuesta}` : ""}
                </span>
              </span>
              {f.confirmada && <span className="chip chip-muted flex-none">Confirmada</span>}
            </div>
            <div className="segmented self-start" role="radiogroup" aria-label={`Asistencia de ${f.nombre}`}>
              {OPCIONES.map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={estados[f.person_id] === o.v}
                  className="segmented-link" aria-current={estados[f.person_id] === o.v ? "page" : undefined}
                  disabled={pendiente || (cerrada && !puedeCerrar)}
                  onClick={() => setEstados((e) => ({ ...e, [f.person_id]: o.v }))}>
                  {o.t}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={pendiente || (cerrada && !puedeCerrar)} onClick={() => guardar(false)}>
          Guardar
        </button>
        {puedeCerrar && !cerrada && (
          <button type="button" className="btn-primary" disabled={pendiente || faltan > 0} onClick={() => guardar(true)}
            title={faltan > 0 ? `Faltan ${faltan} por marcar` : undefined}>
            Confirmar y cerrar{faltan > 0 ? ` (faltan ${faltan})` : ""}
          </button>
        )}
      </div>
    </section>
  );
}
