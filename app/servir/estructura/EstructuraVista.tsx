"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { Resultado } from "@/lib/servir/contratos";
import { Aviso, Hoja } from "../equipo/_components/ui";
import {
  archivarRol, autorizarPlaneacion, crearArea, crearDepartamento, guardarRol,
  quitarAutorizacionPlaneacion, renombrarArea, renombrarDepartamento,
} from "./actions";

export type Depto = { id: string; name: string; is_planning: boolean; areas: { id: string; name: string }[] };
export type Rol = { id: string; name: string; ministry_id: string | null; area_id: string | null; grupo: string | null; active: boolean; sort: number };
export type Autorizable = { profile_id: string; full_name: string; autorizado: boolean };

type Editando = { rol?: Rol; ministry_id: string | null };

export function EstructuraVista({ deptos, roles, planeacionId, autorizables }: {
  deptos: Depto[]; roles: Rol[]; planeacionId: string | null; autorizables: Autorizable[] | null;
}) {
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<Editando | null>(null);
  const [pendiente, start] = useTransition();

  function correr(fn: () => Promise<Resultado<unknown>>, despues?: () => void) {
    setError("");
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error); else despues?.();
    });
  }

  const generales = roles.filter((r) => !r.ministry_id);
  const grupos = [...new Set(generales.map((r) => r.grupo ?? ""))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "es")));

  return (
    <div className="flex flex-col gap-5">
      {error && <Aviso texto={error} onClose={() => setError("")} />}

      <p className="text-[13px] -mt-2" style={{ color: "var(--color-muted)" }}>
        Toca un rol para renombrarlo, moverlo de departamento o área, o archivarlo. Toca el nombre de un departamento o de un área para renombrarlo.
      </p>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {deptos.map((d) => (
          <DeptoCard key={d.id} depto={d} roles={roles.filter((r) => r.ministry_id === d.id)} pendiente={pendiente}
            correr={correr} onRol={(rol) => setEditando({ rol, ministry_id: d.id })} />
        ))}

        <section className="card p-4 md:p-5 flex flex-col gap-3">
          <header className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold">Roles generales</h2>
              <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
                No son de ningún departamento. Se asignan a cualquier servidor; los asigna Planeación.
              </p>
            </div>
            <button type="button" className="btn-secondary flex-none min-h-[40px] px-3 text-[14px]" onClick={() => setEditando({ ministry_id: null })}>
              <Icon name="plus" size={14} /> Rol
            </button>
          </header>
          {grupos.length === 0 && <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>Sin roles generales.</p>}
          {grupos.map((g) => (
            <ListaRoles key={g || "sin-grupo"} titulo={g || "Sin grupo"} roles={generales.filter((r) => (r.grupo ?? "") === g)}
              onRol={(rol) => setEditando({ rol, ministry_id: null })} />
          ))}
        </section>
      </div>

      <NombreForm etiqueta="Nuevo departamento" placeholder="Nombre del departamento" boton="Crear" pendiente={pendiente}
        onGuardar={(t, limpiar) => correr(() => crearDepartamento(t), limpiar)} />

      {autorizables && (
        <section className="card p-4 md:p-5 flex flex-col gap-3 md:max-w-[640px]">
          <div>
            <h2 className="text-[16px] font-semibold">Quién asigna en Planeación, VIO y Escenario</h2>
            <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
              Tú como líder de Planeación ya puedes. Autoriza aquí a otras personas del departamento.
            </p>
          </div>
          {!planeacionId && <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>No hay un departamento marcado como el que planea.</p>}
          {autorizables.length === 0 && planeacionId && (
            <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>Nadie del departamento tiene cuenta todavía.</p>
          )}
          <ul className="flex flex-col">
            {autorizables.map((p) => (
              <li key={p.profile_id} className="flex items-center gap-3 min-h-[48px]" style={{ borderTop: "1px solid var(--color-line)" }}>
                <span className="flex-1 text-[14px]">{p.full_name}</span>
                <button type="button" disabled={pendiente}
                  className={p.autorizado ? "btn-ghost min-h-[36px] px-3 text-[13px]" : "btn-secondary min-h-[36px] px-3 text-[13px]"}
                  style={p.autorizado ? { color: "var(--color-critical)" } : undefined}
                  onClick={() => correr(() => p.autorizado ? quitarAutorizacionPlaneacion(p.profile_id) : autorizarPlaneacion(p.profile_id))}>
                  {p.autorizado ? "Quitar" : "Autorizar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editando && (
        <RolHoja key={editando.rol?.id ?? `nuevo-${editando.ministry_id}`} deptos={deptos} grupos={grupos.filter(Boolean)}
          editando={editando} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function DeptoCard({ depto, roles, pendiente, correr, onRol }: {
  depto: Depto; roles: Rol[]; pendiente: boolean;
  correr: (fn: () => Promise<Resultado<unknown>>, despues?: () => void) => void;
  onRol: (rol?: Rol) => void;
}) {
  const [renombrando, setRenombrando] = useState(false);
  const base = roles.filter((r) => !r.area_id);
  return (
    <section className="card p-4 md:p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        {renombrando ? (
          <NombreForm etiqueta="Nombre del departamento" inicial={depto.name} boton="Guardar" pendiente={pendiente}
            onGuardar={(t) => correr(() => renombrarDepartamento(depto.id, t), () => setRenombrando(false))} />
        ) : (
          <button type="button" className="text-left" onClick={() => setRenombrando(true)} aria-label={`Renombrar ${depto.name}`}>
            <h2 className="text-[16px] font-semibold">{depto.name}</h2>
            {depto.is_planning && <span className="chip chip-accent mt-1">Planea</span>}
          </button>
        )}
        <button type="button" className="btn-secondary flex-none min-h-[40px] px-3 text-[14px]" onClick={() => onRol()}>
          <Icon name="plus" size={14} /> Rol
        </button>
      </header>

      <ListaRoles titulo={depto.areas.length ? "Todo el departamento" : null} roles={base} onRol={onRol} />
      {depto.areas.map((a) => (
        <AreaRoles key={a.id} area={a} roles={roles.filter((r) => r.area_id === a.id)} pendiente={pendiente} correr={correr} onRol={onRol} />
      ))}

      <NombreForm etiqueta="Nueva área" placeholder="Nueva área" boton="Crear área" pendiente={pendiente} compacto
        onGuardar={(t, limpiar) => correr(() => crearArea(depto.id, t), limpiar)} />
    </section>
  );
}

function AreaRoles({ area, roles, pendiente, correr, onRol }: {
  area: { id: string; name: string }; roles: Rol[]; pendiente: boolean;
  correr: (fn: () => Promise<Resultado<unknown>>, despues?: () => void) => void;
  onRol: (rol?: Rol) => void;
}) {
  const [renombrando, setRenombrando] = useState(false);
  return renombrando ? (
    <NombreForm etiqueta="Nombre del área" inicial={area.name} boton="Guardar" pendiente={pendiente} compacto
      onGuardar={(t) => correr(() => renombrarArea(area.id, t), () => setRenombrando(false))} />
  ) : (
    <ListaRoles titulo={`Área · ${area.name}`} roles={roles} onRol={onRol} onTitulo={() => setRenombrando(true)} />
  );
}

function ListaRoles({ titulo, roles, onRol, onTitulo }: { titulo: string | null; roles: Rol[]; onRol: (rol: Rol) => void; onTitulo?: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      {titulo && (onTitulo
        ? <button type="button" className="eyebrow text-left" onClick={onTitulo} aria-label={`Renombrar ${titulo}`}>{titulo}</button>
        : <p className="eyebrow">{titulo}</p>)}
      {roles.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--color-faint)" }}>Sin roles.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onRol(r)} className="chip chip-muted min-h-[32px] px-3 text-[13px]"
                style={r.active ? undefined : { opacity: 0.5, textDecoration: "line-through" }}>
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RolHoja({ deptos, grupos, editando, onClose }: { deptos: Depto[]; grupos: string[]; editando: Editando; onClose: () => void }) {
  const rol = editando.rol;
  const [nombre, setNombre] = useState(rol?.name ?? "");
  const [ministry, setMinistry] = useState(rol ? rol.ministry_id ?? "" : editando.ministry_id ?? "");
  const [area, setArea] = useState(rol?.area_id ?? "");
  const [grupo, setGrupo] = useState(rol?.grupo ?? "");
  const [err, setErr] = useState("");
  const [pendiente, start] = useTransition();
  const depto = deptos.find((d) => d.id === ministry) ?? null;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    start(async () => {
      const r = await guardarRol({ id: rol?.id, name: nombre, ministry_id: ministry || null, area_id: area || null, grupo: grupo || null });
      if (r.ok) onClose(); else setErr(r.error);
    });
  }

  function archivar() {
    if (!rol) return;
    setErr("");
    start(async () => { const r = await archivarRol(rol.id, !rol.active); if (r.ok) onClose(); else setErr(r.error); });
  }

  return (
    <Hoja titulo={rol ? rol.name : "Nuevo rol"} subtitulo={depto?.name ?? "Rol general"} onClose={onClose}
      pie={rol && (
        <button type="button" className="btn-ghost w-full" style={{ color: rol.active ? "var(--color-down)" : "var(--color-accent)" }} disabled={pendiente} onClick={archivar}>
          {rol.active ? "Archivar rol" : "Volver a activar"}
        </button>
      )}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        {err && <Aviso texto={err} />}
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Nombre</span>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cámara principal" autoFocus={!rol} maxLength={80} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Pertenece a</span>
          <select className="input" value={ministry} onChange={(e) => { setMinistry(e.target.value); setArea(""); }}>
            <option value="">Rol general (sin departamento)</option>
            {deptos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {depto && depto.areas.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Área</span>
            <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Todo el departamento</option>
              {depto.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="text-[12px]" style={{ color: "var(--color-faint)" }}>
              Con área, lo asigna el líder de esa área además del líder del departamento.
            </span>
          </label>
        )}
        {!ministry && (
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Grupo</span>
            <input className="input" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Escenario" list="grupos-generales" maxLength={60} />
            <datalist id="grupos-generales">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
          </label>
        )}
        <button type="submit" className="btn-primary" disabled={pendiente || !nombre.trim()}>{rol ? "Guardar cambios" : "Crear rol"}</button>
        {rol && <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>El checklist del rol se edita en Mi equipo › Roles.</p>}
      </form>
    </Hoja>
  );
}

function NombreForm({ etiqueta, placeholder, inicial = "", boton, pendiente, compacto, onGuardar }: {
  etiqueta: string; placeholder?: string; inicial?: string; boton: string; pendiente: boolean; compacto?: boolean;
  onGuardar: (texto: string, limpiar: () => void) => void;
}) {
  const [texto, setTexto] = useState(inicial);
  return (
    <form className={compacto ? "flex gap-2" : "card px-4 py-3 flex flex-col gap-2 md:max-w-[640px]"}
      onSubmit={(e) => { e.preventDefault(); onGuardar(texto, () => setTexto("")); }}>
      {!compacto && <label className="field-label" htmlFor={`f-${etiqueta}`}>{etiqueta}</label>}
      <div className="flex gap-2 flex-1">
        <input id={`f-${etiqueta}`} className="input flex-1" value={texto} placeholder={placeholder} aria-label={etiqueta}
          onChange={(e) => setTexto(e.target.value)} maxLength={80} />
        <button type="submit" className="btn-secondary flex-none" disabled={pendiente || !texto.trim()}>{boton}</button>
      </div>
    </form>
  );
}
