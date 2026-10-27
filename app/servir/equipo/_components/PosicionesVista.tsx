"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { MomentoChecklist } from "@/lib/servir/contratos";
import { agregarPuntoChecklist, archivarPosicion, borrarPuntoChecklist, crearArea, guardarPosicion } from "../_lib/acciones";
import type { AreaFila, Equipo, PosicionFila } from "../_lib/datos";
import { Aviso, Hoja, MOMENTO_TEXTO } from "./ui";

const MOMENTOS: MomentoChecklist[] = ["antes", "durante", "despues"];

export function PosicionesVista({ equipo, posiciones, areas }: { equipo: Equipo; posiciones: PosicionFila[]; areas: AreaFila[] }) {
  const [abierta, setAbierta] = useState<string | "nueva" | null>(null);
  const [nuevaArea, setNuevaArea] = useState("");
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();
  const esDepto = !equipo.area_id;

  // Agrupadas por área (las sin área primero, como "Generales").
  const grupos: { id: string | null; nombre: string; items: PosicionFila[] }[] = [];
  const sinArea = posiciones.filter((p) => !p.area_id);
  if (sinArea.length) grupos.push({ id: null, nombre: "Generales", items: sinArea });
  for (const a of areas) {
    const items = posiciones.filter((p) => p.area_id === a.id);
    if (items.length || esDepto) grupos.push({ id: a.id, nombre: a.name, items });
  }
  const actual = abierta && abierta !== "nueva" ? posiciones.find((p) => p.id === abierta) ?? null : null;

  function agregarArea(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await crearArea(equipo.ministry_id, nuevaArea);
      if (r.ok) setNuevaArea(""); else setError(r.error);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
          Cada posición trae su checklist: se copia al servidor cuando acepta.
        </p>
        <button type="button" className="btn-primary flex-none" onClick={() => setAbierta("nueva")}>
          <Icon name="plus" /> Posición
        </button>
      </div>

      {error && <Aviso texto={error} onClose={() => setError("")} />}

      {grupos.length === 0 && (
        <p className="card px-4 py-6 text-sm text-center" style={{ color: "var(--color-muted)" }}>
          Aún no hay posiciones. Crea las del equipo (por ejemplo “Guitarra eléctrica”, “Luces”, “Ujier puerta 1”).
        </p>
      )}

      {grupos.map((g) => (
        <div key={g.id ?? "general"} className="flex flex-col gap-2">
          <h3 className="eyebrow px-1">{g.nombre}</h3>
          {g.items.length === 0 ? (
            <p className="text-[13px] px-1" style={{ color: "var(--color-faint)" }}>Sin posiciones en esta área.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {g.items.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setAbierta(p.id)} className="card card-hover w-full text-left px-4 py-3 flex items-center gap-3 min-h-[60px]" style={p.active ? undefined : { opacity: 0.55 }}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{p.name}</span>
                      <span className="block text-[13px]" style={{ color: "var(--color-muted)" }}>
                        {p.active ? `${p.checklist.length} ${p.checklist.length === 1 ? "punto" : "puntos"} de checklist` : "Archivada"}
                      </span>
                    </span>
                    <Icon name="chevron-right" style={{ color: "var(--color-faint)" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {esDepto && (
        <form onSubmit={agregarArea} className="card px-4 py-3 flex flex-col gap-2">
          <label className="field-label" htmlFor="nueva-area">Áreas del departamento</label>
          <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            Un área agrupa posiciones y tiene su propio líder (por ejemplo “Banda” y “Voces”).
          </p>
          <div className="flex gap-2">
            <input id="nueva-area" className="input flex-1" placeholder="Nueva área" value={nuevaArea} onChange={(e) => setNuevaArea(e.target.value)} />
            <button type="submit" className="btn-secondary flex-none" disabled={pendiente || !nuevaArea.trim()}>Crear</button>
          </div>
        </form>
      )}

      {abierta === "nueva" && (
        <PosicionHoja equipo={equipo} areas={areas} onClose={() => setAbierta(null)} />
      )}
      {actual && (
        <PosicionHoja key={actual.id} equipo={equipo} areas={areas} posicion={actual} onClose={() => setAbierta(null)} />
      )}
    </section>
  );
}

function PosicionHoja({ equipo, areas, posicion, onClose }: { equipo: Equipo; areas: AreaFila[]; posicion?: PosicionFila; onClose: () => void }) {
  const [nombre, setNombre] = useState(posicion?.name ?? "");
  const [area, setArea] = useState(posicion?.area_id ?? equipo.area_id ?? "");
  const [momento, setMomento] = useState<MomentoChecklist>("antes");
  const [punto, setPunto] = useState("");
  const [err, setErr] = useState("");
  const [pendiente, start] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    start(async () => {
      const r = await guardarPosicion({ id: posicion?.id, ministry_id: equipo.ministry_id, area_id: area || null, name: nombre });
      if (!r.ok) setErr(r.error); else if (!posicion) onClose();
    });
  }

  function agregarPunto(e: React.FormEvent) {
    e.preventDefault();
    if (!posicion) return;
    setErr("");
    start(async () => {
      const r = await agregarPuntoChecklist(posicion.id, momento, punto);
      if (r.ok) setPunto(""); else setErr(r.error);
    });
  }

  function borrarPunto(id: string) {
    setErr("");
    start(async () => { const r = await borrarPuntoChecklist(id); if (!r.ok) setErr(r.error); });
  }

  function archivar() {
    if (!posicion) return;
    start(async () => { const r = await archivarPosicion(posicion.id, !posicion.active); if (!r.ok) setErr(r.error); else onClose(); });
  }

  return (
    <Hoja titulo={posicion ? posicion.name : "Nueva posición"} subtitulo={equipo.area_name ? `${equipo.ministry_name} · ${equipo.area_name}` : equipo.ministry_name} onClose={onClose}
      pie={posicion && (
        <button type="button" className="btn-ghost w-full" style={{ color: posicion.active ? "var(--color-down)" : "var(--color-accent)" }} disabled={pendiente} onClick={archivar}>
          {posicion.active ? "Archivar posición" : "Volver a activar"}
        </button>
      )}>
      <div className="flex flex-col gap-5">
        {err && <Aviso texto={err} />}
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Nombre</span>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Guitarra eléctrica" autoFocus={!posicion} />
          </label>
          {!equipo.area_id && areas.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Área</span>
              <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Sin área (general del departamento)</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="btn-primary" disabled={pendiente || !nombre.trim()}>
            {posicion ? "Guardar cambios" : "Crear posición"}
          </button>
        </form>

        {posicion && (
          <div className="flex flex-col gap-3">
            <p className="field-label">Checklist</p>
            {MOMENTOS.map((m) => {
              const items = posicion.checklist.filter((c) => c.moment === m);
              return (
                <div key={m} className="flex flex-col gap-1">
                  <p className="eyebrow">{MOMENTO_TEXTO[m]}</p>
                  {items.length === 0 ? (
                    <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>Nada todavía.</p>
                  ) : (
                    <ul className="flex flex-col">
                      {items.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 min-h-[40px]">
                          <span className="flex-1 text-[14px]" style={{ color: "var(--color-ink)" }}>{c.text}</span>
                          <button type="button" className="icon-btn" aria-label={`Quitar “${c.text}”`} disabled={pendiente} onClick={() => borrarPunto(c.id)}>
                            <Icon name="close" size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <form onSubmit={agregarPunto} className="flex flex-col gap-2 pt-1">
              <div className="segmented self-start" role="group" aria-label="Momento">
                {MOMENTOS.map((m) => (
                  <button key={m} type="button" aria-pressed={momento === m} onClick={() => setMomento(m)}>{MOMENTO_TEXTO[m]}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1" value={punto} onChange={(e) => setPunto(e.target.value)} placeholder="Nuevo punto" aria-label="Nuevo punto del checklist" />
                <button type="submit" className="btn-secondary flex-none" disabled={pendiente || !punto.trim()}>Agregar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Hoja>
  );
}
