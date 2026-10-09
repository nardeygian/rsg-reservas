"use client";

import { useState } from "react";
import { svFmt, svConteo, svEnPeriodo, svNombreLimpio, svTipo, enrichReuniones } from "../_lib/sv-logic";
import { svServidorEditarAction, svServidorUnirAction, svServidorQuitarAction } from "../actions";
import type { SvData } from "../_lib/types";

export function ServidorSheet({ sid, svData, canEdit, onClose, onSaved, onOpenReunion }: {
  sid: string;
  svData: SvData;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onOpenReunion: (rid: string) => void;
}) {
  const s = svData.servidores[sid];

  const [nombre, setNombre]           = useState(s?.nombre ?? "");
  const [merge, setMerge]             = useState("");
  const [err, setErr]                 = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmQuitar, setConfirmQuitar] = useState(false);

  if (!s) return null;

  const reuniones = enrichReuniones(svData);
  const contTodas = svConteo(reuniones);
  const contTotal = contTodas.get(sid);

  // Meeting history for this server
  const reus = contTotal?.reus.slice().sort((a, b) => b.r.fecha.localeCompare(a.r.fecha)) ?? [];

  const otros = Object.values(svData.servidores).filter(x => x.id !== sid).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  async function handleGuardarNombre(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true); setErr("");
    const fd = new FormData(); fd.set("id", sid); fd.set("nombre", nombre.trim());
    try {
      const r = await svServidorEditarAction(fd);
      if (r.unido) onSaved("Ya existía alguien con ese nombre: quedaron unidos");
      else onSaved("Nombre corregido");
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleUnir() {
    if (!merge) { setErr("Elige con quién unirlo"); return; }
    setSaving(true); setErr("");
    const fd = new FormData(); fd.set("de", sid); fd.set("a", merge);
    try { await svServidorUnirAction(fd); onSaved("Unidos en un solo servidor"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleQuitar() {
    if (!confirmQuitar) { setConfirmQuitar(true); setTimeout(() => setConfirmQuitar(false), 5000); return; }
    setSaving(true);
    const fd = new FormData(); fd.set("id", sid);
    try { await svServidorQuitarAction(fd); onSaved("Servidor eliminado"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] flex flex-col" style={{ background: "var(--color-surface)", boxShadow: "0 -4px 32px rgba(0,0,0,0.18)", maxHeight: "90dvh", maxWidth: 640, margin: "0 auto" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-none">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-line)" }} />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex-none border-b" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>Servidor</p>
              <h2 className="font-bold text-lg leading-tight mt-0.5" style={{ color: "var(--color-ink)" }}>{s.nombre}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full flex-none" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", fontSize: 20 }} aria-label="Cerrar">×</button>
          </div>
          <div className="flex gap-4 mt-2 text-sm flex-wrap">
            <span style={{ color: "var(--color-ink)" }}>Reuniones <strong>{contTotal?.min.size ?? 0}</strong></span>
            <span style={{ color: "var(--color-gold)" }}>Servolución <strong>{contTotal?.serv.size ?? 0}</strong></span>
            {(contTotal?.aus.size ?? 0) > 0 && <span style={{ color: "var(--color-down)" }}>Ausencias <strong>{contTotal!.aus.size}</strong></span>}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
          {/* Edit name + merge */}
          {canEdit && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Corregir nombre</h3>
                <form onSubmit={handleGuardarNombre} className="flex gap-2">
                  <input className="input text-sm flex-1" value={nombre} onChange={e => setNombre(e.target.value)} required />
                  <button type="submit" className="btn-primary text-sm px-4 py-2" disabled={saving}>Guardar</button>
                </form>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Es la misma persona que…</h3>
                <div className="flex gap-2">
                  <select className="input text-sm flex-1" value={merge} onChange={e => setMerge(e.target.value)}>
                    <option value="">Elegir para unir…</option>
                    {otros.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                  <button type="button" className="text-sm font-semibold px-3 py-2 rounded-[8px]" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }} onClick={handleUnir} disabled={saving}>Unir</button>
                </div>
              </div>

              <button type="button" className="text-sm font-semibold px-3 py-2 rounded-[8px] self-start"
                style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}
                onClick={handleQuitar} disabled={saving}>
                {confirmQuitar ? "Confirmar: se quita de todos los listados" : "Eliminar servidor"}
              </button>

              {err && <p className="text-xs" style={{ color: "var(--color-down)" }}>{err}</p>}
            </div>
          )}

          {/* Meeting history */}
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Reuniones en las que estuvo asignado</h3>
            {reus.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
                      <th className="text-left px-3 py-1.5 text-xs font-semibold">Fecha</th>
                      <th className="text-left px-3 py-1.5 text-xs font-semibold">Reunión</th>
                      <th className="text-left px-3 py-1.5 text-xs font-semibold">Asistencia</th>
                      <th className="text-left px-3 py-1.5 text-xs font-semibold hidden sm:table-cell">Roles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reus.map((x, i) => (
                      <tr key={i} className="border-t cursor-pointer hover:bg-[var(--color-bg)]" style={{ borderColor: "var(--color-line)" }} onClick={() => { onClose(); onOpenReunion(x.r.id); }}>
                        <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--color-muted)" }}>{svFmt(x.r.fecha)}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>{svNombreLimpio(x.r.nombre)}</td>
                        <td className="px-3 py-2">
                          {x.aus
                            ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}>Ausente</span>
                            : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: svTipo(x.r) === "serv" ? "var(--color-gold-soft)" : "var(--color-up-soft)", color: svTipo(x.r) === "serv" ? "var(--color-gold-text)" : "var(--color-up)" }}>
                                {svTipo(x.r) === "serv" ? "Servolución" : "Sirvió"}
                              </span>
                          }
                        </td>
                        <td className="px-3 py-2 text-xs hidden sm:table-cell" style={{ color: "var(--color-muted)" }}>{x.roles.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>Aún no aparece en ningún listado.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
