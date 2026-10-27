"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { Resultado } from "@/lib/servir/contratos";
import { agregarMiembro, cambiarPosicionPersona, moverMiembro, quitarMiembro } from "../_lib/acciones";
import type { AreaFila, Equipo, MiembroFila, PersonaOpcion, PosicionFila } from "../_lib/datos";
import { Aviso, Avatar, Hoja } from "./ui";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function rango(desde: string, hasta: string): string {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
  return desde === hasta ? f(desde) : `${f(desde)} – ${f(hasta)}`;
}

export function MiembrosVista({ equipo, miembros, posiciones, areas, personas }: {
  equipo: Equipo;
  miembros: MiembroFila[];
  posiciones: PosicionFila[];
  areas: AreaFila[];
  personas: PersonaOpcion[];
}) {
  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

  const nombreArea = (id: string | null) => areas.find((a) => a.id === id)?.name ?? null;
  const nombrePos = new Map(posiciones.map((p) => [p.id, p.name]));
  const visibles = miembros.filter((m) => !filtro || norm(m.full_name).includes(norm(filtro)));
  const actual = miembros.find((m) => m.team_member_id === editando) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input className="input flex-1" placeholder="Buscar en el equipo" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar en el equipo" />
        <button type="button" className="btn-primary" onClick={() => setAgregando(true)}>
          <Icon name="plus" /> <span>Agregar</span>
        </button>
      </div>

      {error && <Aviso texto={error} onClose={() => setError("")} />}

      {miembros.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
          Aún no hay nadie en este equipo. Agrega a tu gente para poder asignarla.
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {visibles.map((m) => {
            const total = m.aceptadas + m.rechazadas;
            return (
              <li key={m.team_member_id}>
                <button type="button" onClick={() => setEditando(m.team_member_id)} className="card card-hover w-full text-left px-4 py-3 flex gap-3 items-start min-h-[72px]">
                  <Avatar nombre={m.full_name} />
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{m.full_name}</span>
                      {!equipo.area_id && nombreArea(m.area_id) && <span className="chip chip-muted">{nombreArea(m.area_id)}</span>}
                      {!m.tiene_cuenta && <span className="chip chip-gold">Sin cuenta</span>}
                    </span>
                    <span className="text-[13px] tabular" style={{ color: "var(--color-muted)" }}>
                      {m.servicios_mes} {m.servicios_mes === 1 ? "servicio" : "servicios"} este mes
                      {total > 0 && <> · acepta {Math.round((m.aceptadas / total) * 100)}%</>}
                    </span>
                    {m.posiciones.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {m.posiciones.map((p) => nombrePos.get(p) && <span key={p} className="chip chip-accent">{nombrePos.get(p)}</span>)}
                      </span>
                    ) : (
                      <span className="text-[12px]" style={{ color: "var(--color-faint)" }}>Sin posiciones: no aparecerá en las sugerencias</span>
                    )}
                    {m.bloqueos.map((b, i) => (
                      <span key={i} className="text-[12px] flex items-center gap-1" style={{ color: "var(--color-down)" }}>
                        <Icon name="lock" size={12} /> No puede {rango(b.starts_on, b.ends_on)}{b.reason ? ` · ${b.reason}` : ""}
                      </span>
                    ))}
                  </span>
                  <Icon name="chevron-right" style={{ color: "var(--color-faint)", marginTop: 10 }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {agregando && (
        <AgregarHoja equipo={equipo} personas={personas} miembros={miembros} onClose={() => setAgregando(false)} onError={setError} />
      )}
      {actual && (
        <MiembroHoja key={actual.team_member_id} equipo={equipo} miembro={actual} posiciones={posiciones.filter((p) => p.active)} areas={areas}
          onClose={() => setEditando(null)} onError={setError} />
      )}
    </section>
  );
}

function AgregarHoja({ equipo, personas, miembros, onClose, onError }: {
  equipo: Equipo; personas: PersonaOpcion[]; miembros: MiembroFila[]; onClose: () => void; onError: (e: string) => void;
}) {
  const [q, setQ] = useState("");
  const [pendiente, start] = useTransition();
  const [err, setErr] = useState("");
  const ya = useMemo(() => new Set(miembros.map((m) => m.person_id)), [miembros]);
  const resultados = q.trim().length < 2 ? [] : personas.filter((p) => !ya.has(p.id) && norm(p.full_name).includes(norm(q.trim()))).slice(0, 12);
  const exacto = personas.some((p) => norm(p.full_name) === norm(q.trim()));

  function correr(fn: () => Promise<Resultado<unknown>>) {
    setErr("");
    start(async () => {
      const r = await fn();
      if (r.ok) onClose(); else { setErr(r.error); onError(""); }
    });
  }

  return (
    <Hoja titulo="Agregar al equipo" subtitulo={equipo.area_name ? `${equipo.ministry_name} · ${equipo.area_name}` : equipo.ministry_name} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input autoFocus className="input" placeholder="Nombre de la persona" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nombre de la persona" />
        {err && <Aviso texto={err} />}
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-line)" }}>
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={pendiente} className="w-full flex items-center gap-3 py-2.5 min-h-[48px] text-left"
                onClick={() => correr(() => agregarMiembro({ ministry_id: equipo.ministry_id, area_id: equipo.area_id, person_id: p.id }))}>
                <Avatar nombre={p.full_name} size={32} />
                <span className="flex-1 text-[15px]" style={{ color: "var(--color-ink)" }}>{p.full_name}</span>
                <Icon name="plus" style={{ color: "var(--color-accent)" }} />
              </button>
            </li>
          ))}
        </ul>
        {q.trim().length >= 2 && !exacto && (
          <button type="button" disabled={pendiente} className="btn-secondary"
            onClick={() => correr(() => agregarMiembro({ ministry_id: equipo.ministry_id, area_id: equipo.area_id, full_name: q }))}>
            <Icon name="plus" /> Crear a “{q.trim()}” y agregarlo
          </button>
        )}
        {q.trim().length < 2 && (
          <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            Busca en el directorio de personas. Si no está, la puedes crear; su cuenta se une después con la invitación.
          </p>
        )}
      </div>
    </Hoja>
  );
}

function MiembroHoja({ equipo, miembro, posiciones, areas, onClose, onError }: {
  equipo: Equipo; miembro: MiembroFila; posiciones: PosicionFila[]; areas: AreaFila[]; onClose: () => void; onError: (e: string) => void;
}) {
  const [pendiente, start] = useTransition();
  const [err, setErr] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  // Optimista: la lista de posiciones cambia al tocar; si falla, se revierte.
  const [sabe, setSabe] = useState(() => new Set(miembro.posiciones));

  function togglePos(id: string) {
    const nuevo = !sabe.has(id);
    const next = new Set(sabe); if (nuevo) next.add(id); else next.delete(id);
    setSabe(next); setErr("");
    start(async () => {
      const r = await cambiarPosicionPersona(miembro.person_id, id, nuevo);
      if (!r.ok) { setErr(r.error); setSabe((s) => { const v = new Set(s); if (nuevo) v.delete(id); else v.add(id); return v; }); }
    });
  }

  function mover(areaId: string) {
    setErr("");
    start(async () => {
      const r = await moverMiembro(miembro.team_member_id, areaId || null);
      if (!r.ok) setErr(r.error);
    });
  }

  function quitar() {
    if (!confirmar) { setConfirmar(true); return; }
    start(async () => {
      const r = await quitarMiembro(miembro.team_member_id);
      if (r.ok) onClose(); else { setErr(r.error); onError(""); }
    });
  }

  return (
    <Hoja titulo={miembro.full_name} subtitulo={equipo.area_name ?? equipo.ministry_name} onClose={onClose}
      pie={
        <button type="button" className="btn-ghost w-full" style={{ color: "var(--color-down)" }} disabled={pendiente} onClick={quitar}>
          {confirmar ? "Toca otra vez para quitarlo del equipo" : "Quitar del equipo"}
        </button>
      }>
      <div className="flex flex-col gap-5">
        {err && <Aviso texto={err} />}
        <div className="flex flex-col gap-2">
          <p className="field-label">Puede servir en</p>
          {posiciones.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>Crea primero las posiciones del equipo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {posiciones.map((p) => {
                const on = sabe.has(p.id);
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => togglePos(p.id)}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full text-[14px] font-medium transition"
                    style={on
                      ? { background: "var(--color-action-bg)", color: "var(--color-action-fg)" }
                      : { background: "var(--color-surface-2)", color: "var(--color-ink)" }}>
                    {on && <Icon name="check" size={14} />}{p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!equipo.area_id && areas.length > 0 && (
          <label className="flex flex-col gap-2">
            <span className="field-label">Área</span>
            <select className="input" defaultValue={miembro.area_id ?? ""} disabled={pendiente} onChange={(e) => mover(e.target.value)}>
              <option value="">Sin área</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}

        <div className="text-[13px] flex flex-col gap-1" style={{ color: "var(--color-muted)" }}>
          <span>{miembro.servicios_mes} servicios este mes · {miembro.aceptadas} aceptadas · {miembro.rechazadas} rechazadas</span>
          {!miembro.tiene_cuenta && <span>Aún no tiene cuenta en el portal: no recibe avisos ni puede aceptar.</span>}
          {miembro.bloqueos.map((b, i) => (
            <span key={i} style={{ color: "var(--color-down)" }}>No puede {rango(b.starts_on, b.ends_on)}{b.reason ? ` · ${b.reason}` : ""}</span>
          ))}
        </div>
      </div>
    </Hoja>
  );
}
