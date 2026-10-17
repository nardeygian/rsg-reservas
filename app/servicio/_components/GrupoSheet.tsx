"use client";

import { useState } from "react";
import {
  svGrupoEditarAction, svGrupoQuitarAction,
  svMiembroAgregarAction, svMiembroQuitarAction, svLiderAsignarAction,
} from "../actions";
import type { SvGrupo, SvMiembro } from "../_lib/types";

export function GrupoSheet({
  grupo,
  miembros,
  onClose,
  onSaved,
}: {
  grupo: SvGrupo;
  miembros: SvMiembro[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [nombre, setNombre]         = useState(grupo.nombre);
  const [lider, setLider]           = useState(grupo.lider);
  const [userId, setUserId]         = useState("");
  const [nuevosNombres, setNuevos]  = useState("");
  const [err, setErr]               = useState("");
  const [saving, setSaving]         = useState(false);
  const [confirmDelete, setConfirm] = useState(false);

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.set("id", grupo.id); fd.set("nombre", nombre); fd.set("lider", lider);
    try { await svGrupoEditarAction(fd); onSaved("Discipulado actualizado"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleAsignarLider() {
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.set("grupo_id", grupo.id); fd.set("user_id", userId.trim());
    try { await svLiderAsignarAction(fd); onSaved("Líder asignado"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevosNombres.trim()) return;
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.set("grupo_id", grupo.id); fd.set("nombres", nuevosNombres);
    try {
      const r = await svMiembroAgregarAction(fd);
      setNuevos("");
      onSaved(`${r.count} discípulo${r.count === 1 ? "" : "s"} agregado${r.count === 1 ? "" : "s"}`);
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleQuitarMiembro(mid: string) {
    setSaving(true); setErr("");
    const fd = new FormData(); fd.set("id", mid);
    try { await svMiembroQuitarAction(fd); onSaved("Discípulo eliminado"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleQuitarGrupo() {
    if (!confirmDelete) { setConfirm(true); setTimeout(() => setConfirm(false), 5000); return; }
    setSaving(true);
    const fd = new FormData(); fd.set("id", grupo.id);
    try { await svGrupoQuitarAction(fd); onSaved("Discipulado eliminado"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] flex flex-col"
        style={{ background: "var(--color-surface)", boxShadow: "0 -4px 32px rgba(0,0,0,0.18)", maxHeight: "90dvh", maxWidth: 640, margin: "0 auto" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-none">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-line)" }} />
        </div>

        <div className="px-5 pb-3 flex-none border-b" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Discipulado</p>
              <h2 className="font-bold text-lg leading-tight mt-0.5" style={{ color: "var(--color-ink)" }}>{grupo.nombre}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full flex-none" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", fontSize: 20 }} aria-label="Cerrar">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-6">
          {/* Edit name + leader */}
          <form onSubmit={handleEditar} className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Datos del grupo</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Nombre del discipulado</label>
              <input className="input text-sm" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Nombre del líder (texto)</label>
              <input className="input text-sm" value={lider} onChange={e => setLider(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary text-sm px-4 py-2 self-start" disabled={saving}>Guardar</button>
          </form>

          {/* Leader user assignment */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Líderes (acceso)</h3>
            {grupo.lider_user_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {grupo.lider_user_ids.map(uid => (
                  <span key={uid} className="text-[11px] font-mono px-2 py-1 rounded-[6px]"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}>
                    {uid}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Pega el UUID del usuario. Se agrega sin quitar los actuales. Usa el panel Admin para gestionar líderes.
            </p>
            <div className="flex gap-2">
              <input
                className="input text-sm flex-1 font-mono"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={userId}
                onChange={e => setUserId(e.target.value)}
              />
              <button type="button" className="text-sm font-semibold px-3 py-2 rounded-[8px]" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }} onClick={handleAsignarLider} disabled={saving}>+ Agregar</button>
            </div>
          </div>

          {/* Members list */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Discípulos ({miembros.length})</h3>
            {miembros.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {miembros.map(m => (
                  <span key={m.id} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}>
                    {m.nombre}
                    <button
                      type="button"
                      aria-label={`Quitar ${m.nombre}`}
                      style={{ color: "var(--color-faint)", lineHeight: 1 }}
                      onClick={() => handleQuitarMiembro(m.id)}
                      disabled={saving}
                    >×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>Sin discípulos. Agrega sus nombres abajo.</p>
            )}
          </div>

          {/* Add members */}
          <form onSubmit={handleAgregar} className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Agregar discípulos</h3>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>Un nombre por línea. Los que ya existen se omiten.</p>
            <textarea
              className="input text-sm"
              rows={4}
              placeholder={"Juan García\nMaría López\nPedro Martínez"}
              value={nuevosNombres}
              onChange={e => setNuevos(e.target.value)}
            />
            <button type="submit" className="btn-primary text-sm px-4 py-2 self-start" disabled={saving}>Agregar</button>
          </form>

          {/* Delete group */}
          <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <button
              type="button"
              className="text-sm font-semibold px-3 py-2 rounded-[8px] self-start"
              style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}
              onClick={handleQuitarGrupo}
              disabled={saving}
            >
              {confirmDelete ? "Confirmar: se elimina el grupo y sus discípulos" : "Eliminar discipulado"}
            </button>
          </div>

          {err && <p className="text-xs" style={{ color: "var(--color-down)" }}>{err}</p>}
        </div>
      </div>
    </>
  );
}
