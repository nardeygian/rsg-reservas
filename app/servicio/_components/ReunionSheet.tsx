"use client";

import { useState, useRef } from "react";
import { svFmt, svNombreLimpio, svTipo, svNorm } from "../_lib/sv-logic";
import { svGuardarAction, svBorrarAction, svReunionQuitarAction } from "../actions";
import { svLeerPDF, svInterpretar, svNormPdf } from "../_lib/sv-pdf";
import type { SvData, SvFila } from "../_lib/types";

type EditFila = { nombre: string; roles: string; aus: boolean; nota: string };

export function ReunionSheet({ rid, svData, canEdit, onClose, onSaved }: {
  rid: string;
  svData: SvData;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const r   = svData.reuniones[rid];
  const reg = r ? svData.registros[rid] : undefined;

  const [filas, setFilas] = useState<EditFila[]>(() => {
    const porId = new Map(Object.values(svData.servidores).map(s => [s.id, s]));
    return (reg?.filas ?? [])
      .map(f => ({ nombre: porId.get(f.sid)?.nombre ?? "", roles: (f.roles ?? []).join(", "), aus: !!f.aus, nota: f.nota ?? "" }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  });
  const [notaR, setNotaR] = useState(reg?.nota ?? "");
  const [aviso, setAviso] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showPegar, setShowPegar] = useState(false);
  const [txtPegar, setTxtPegar] = useState("");
  const [confirmBorrar, setConfirmBorrar] = useState(false);
  const [confirmQuitar, setConfirmQuitar] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  if (!r) return null;

  const tipo      = svTipo(r);
  const conocidos = Object.values(svData.servidores);

  function svEstado(nombre: string): { text: string; color: string } | null {
    if (!nombre.trim()) return null;
    const k = svNorm(nombre);
    const exacto = Object.values(svData.servidores).find(s => svNorm(s.nombre) === k);
    if (exacto) return { text: "Servidor registrado", color: "var(--color-muted)" };
    return { text: "Nuevo servidor", color: "var(--color-accent)" };
  }

  function agregarDetectados(det: { nombre: string; roles: string[] }[], origen: string) {
    setFilas(prev => {
      const ya = new Map(prev.map(f => [svNormPdf(f.nombre), f]));
      let n = 0;
      for (const d of det) {
        const k = svNormPdf(d.nombre);
        if (ya.has(k)) {
          const f = ya.get(k)!;
          const rs = new Set([...f.roles.split(",").map(x => x.trim()).filter(Boolean), ...d.roles]);
          f.roles = [...rs].join(", ");
        } else {
          ya.set(k, { nombre: d.nombre, roles: d.roles.join(", "), aus: false, nota: "" });
          n++;
        }
      }
      return [...ya.values()];
    });
    setAviso({
      ok: det.length > 0,
      msg: det.length
        ? `Encontré ${det.length} personas en ${origen}${0 < det.length ? "" : ""}. Revisa nombres y roles, corrige lo que haga falta y toca Guardar listado.`
        : `No encontré nombres en ${origen}. Usa "Pegar una lista" o agrega las personas a mano.`,
    });
    setShowPegar(false);
    setTxtPegar("");
  }

  async function handlePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAviso({ msg: "Leyendo el PDF…", ok: false });
    try {
      const lineas = await svLeerPDF(file);
      const det = svInterpretar(lineas, conocidos);
      agregarDetectados(det, "el PDF");
    } catch (err) {
      setAviso({ msg: `No se pudo leer el PDF: ${(err as Error).message}. Puedes usar "Pegar una lista".`, ok: false });
    }
  }

  function handlePegar(e: React.FormEvent) {
    e.preventDefault();
    const det = svInterpretar(txtPegar.split("\n").map(l => l.split("\t")), conocidos, true);
    agregarDetectados(det, "la lista pegada");
  }

  async function handleGuardar() {
    setSaving(true); setErr("");
    const fd = new FormData();
    fd.set("reunion", rid);
    fd.set("nota", notaR);
    const filasOut = filas.filter(f => f.nombre.trim()).map(f => ({
      nombre: f.nombre.trim(),
      roles: f.roles.split(",").map(r => r.trim()).filter(Boolean),
      ausente: f.aus,
      nota: f.nota.trim(),
    }));
    fd.set("filas", JSON.stringify(filasOut));
    try {
      await svGuardarAction(fd);
      const na = filasOut.filter(f => f.ausente).length;
      onSaved(`Listado guardado: ${filasOut.length - na} sirvieron${na ? `, ${na} ${na === 1 ? "ausente" : "ausentes"}` : ""}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar() {
    if (!confirmBorrar) { setConfirmBorrar(true); setTimeout(() => setConfirmBorrar(false), 5000); return; }
    setSaving(true);
    const fd = new FormData(); fd.set("reunion", rid);
    try { await svBorrarAction(fd); onSaved("Listado borrado"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  async function handleQuitar() {
    if (!confirmQuitar) { setConfirmQuitar(true); setTimeout(() => setConfirmQuitar(false), 5000); return; }
    setSaving(true);
    const fd = new FormData(); fd.set("reunion", rid);
    try { await svReunionQuitarAction(fd); onSaved("Reunión eliminada"); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  const validas = filas.filter(f => f.nombre.trim());
  const nAus    = validas.filter(f => f.aus).length;

  const cuando = reg?.cuando
    ? new Date(reg.cuando).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" })
    : null;

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
              <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
                {svFmt(r.fecha)}{r.seccion ? ` · ${r.seccion}` : ""}
              </p>
              <h2 className="font-bold text-lg leading-tight mt-0.5" style={{ color: "var(--color-ink)" }}>{svNombreLimpio(r.nombre)}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full flex-none" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", fontSize: 20 }} aria-label="Cerrar">×</button>
          </div>
          {/* Sum bar */}
          <div className="flex gap-3 mt-2 text-sm flex-wrap">
            <span style={{ color: "var(--color-ink)" }}><strong>{validas.length - nAus}</strong> sirvieron</span>
            {nAus > 0 && <span style={{ color: "var(--color-down)" }}><strong>{nAus}</strong> {nAus === 1 ? "ausente" : "ausentes"}</span>}
            {cuando ? <span style={{ color: "var(--color-faint)" }}>Guardado {cuando}</span> : <span style={{ color: "var(--color-faint)" }}>Sin guardar todavía</span>}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5" ref={listRef}>
          {canEdit && (
            <>
              {/* PDF upload */}
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Leer el listado</h3>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Sube el PDF de servidores de esta reunión. El panel lo lee aquí mismo, en tu navegador: el archivo no se guarda en ningún lado. Después revisa la lista y guarda.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }} htmlFor="svPdf">PDF del listado</label>
                    <input id="svPdf" type="file" accept="application/pdf,.pdf" className="input text-sm" onChange={handlePdf} />
                  </div>
                  <button type="button" className="text-xs font-semibold px-3 py-2 rounded-[8px]" style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }} onClick={() => setShowPegar(v => !v)}>
                    Pegar una lista
                  </button>
                </div>
                {showPegar && (
                  <form onSubmit={handlePegar} className="flex flex-col gap-2">
                    <label className="text-xs" style={{ color: "var(--color-muted)" }}>Una persona por línea. Puedes escribir el rol antes: &ldquo;Sonido: Ana Pérez&rdquo;</label>
                    <textarea className="input text-sm" rows={5} value={txtPegar} onChange={e => setTxtPegar(e.target.value)} placeholder={"Sonido: Ana Pérez\nCámara: Luis Rada, Marta Polo"} />
                    <button type="submit" className="btn-primary text-sm px-4 py-2 self-start">Agregar a la lista</button>
                  </form>
                )}
                {aviso && (
                  <p className="text-xs rounded-[8px] px-3 py-2" style={{
                    background: aviso.ok ? "var(--color-up-soft)" : "var(--color-gold-soft)",
                    color: aviso.ok ? "var(--color-up)" : "var(--color-gold-text)",
                  }}>{aviso.msg}</p>
                )}
              </div>

              {/* Server list editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>Servidores de esta reunión</h3>
                  <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
                    onClick={() => {
                      setFilas(prev => [...prev, { nombre: "", roles: "", aus: false, nota: "" }]);
                      setTimeout(() => { const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("[data-nombre]"); inputs?.[inputs.length - 1]?.focus(); }, 50);
                    }}>
                    Agregar persona
                  </button>
                </div>

                {/* Datalist */}
                <datalist id="svLista">
                  {Object.values(svData.servidores).map(s => <option key={s.id} value={s.nombre} />)}
                </datalist>

                {filas.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {filas.map((f, i) => (
                      <FilaRow
                        key={i} f={f}
                        estado={svEstado(f.nombre)}
                        onChange={upd => setFilas(prev => prev.map((x, j) => j === i ? { ...x, ...upd } : x))}
                        onRemove={() => setFilas(prev => prev.filter((_, j) => j !== i))}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>Todavía no hay nadie. Sube el PDF, pega una lista o agrega personas a mano.</p>
                )}

                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Si alguien estaba asignado y no llegó, márcalo como <strong>Ausente</strong>: queda registrado, pero no cuenta como servicio.
                </p>
              </div>

              {/* Nota de la reunión */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }} htmlFor="svNotaR">Anotaciones de la reunión</label>
                <textarea id="svNotaR" className="input text-sm" rows={3} maxLength={600} value={notaR} onChange={e => setNotaR(e.target.value)} placeholder="Novedades, cambios de última hora, observaciones…" />
              </div>

              {/* Save / delete */}
              <div className="flex flex-col gap-2">
                <button type="button" className="btn-primary w-full py-2.5 font-semibold" disabled={saving} onClick={handleGuardar}>
                  {saving ? "Guardando…" : "Guardar listado"}
                </button>
                <div className="flex gap-2 flex-wrap">
                  {reg && (
                    <button type="button" className="text-xs font-semibold px-3 py-2 rounded-[8px]" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }} onClick={handleBorrar} disabled={saving}>
                      {confirmBorrar ? "Confirmar: borrar el listado" : "Borrar el listado guardado"}
                    </button>
                  )}
                  {(r.origen === "manual" || r.fuera_de_asana) && (
                    <button type="button" className="text-xs font-semibold px-3 py-2 rounded-[8px]" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }} onClick={handleQuitar} disabled={saving}>
                      {confirmQuitar ? "Confirmar: eliminar la reunión" : "Eliminar esta reunión"}
                    </button>
                  )}
                </div>
                {err && <p className="text-xs" style={{ color: "var(--color-down)" }}>{err}</p>}
              </div>
            </>
          )}

          {/* Read-only view */}
          {!canEdit && reg && (
            <div className="flex flex-col gap-3">
              {reg.filas.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: "var(--color-muted)" }}>
                      <th className="text-left py-1 text-xs font-semibold">Servidor</th>
                      <th className="text-left py-1 text-xs font-semibold">Roles</th>
                      <th className="text-right py-1 text-xs font-semibold">Asistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reg.filas.map((f, i) => {
                      const s = svData.servidores[f.sid];
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                          <td className="py-2 font-semibold" style={{ color: "var(--color-ink)" }}>{s?.nombre ?? "—"}</td>
                          <td className="py-2 text-xs" style={{ color: "var(--color-muted)" }}>{(f.roles ?? []).join(", ") || "—"}</td>
                          <td className="py-2 text-right">
                            {f.aus
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-down-soft)", color: "var(--color-down)" }}>Ausente</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--color-up-soft)", color: "var(--color-up)" }}>Sirvió</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>Sin servidores registrados.</p>
              )}
              {reg.nota && <p className="text-xs" style={{ color: "var(--color-muted)" }}>{reg.nota}</p>}
            </div>
          )}

          {!canEdit && !reg && (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-faint)" }}>Listado aún no cargado.</p>
          )}
        </div>
      </div>
    </>
  );
}

function FilaRow({ f, estado, onChange, onRemove }: {
  f: EditFila;
  estado: { text: string; color: string } | null;
  onChange: (upd: Partial<EditFila>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] p-3" style={{ background: f.aus ? "var(--color-down-soft)" : "var(--color-bg)", border: `1px solid ${f.aus ? "var(--color-down)" : "var(--color-line)"}` }}>
      <div className="flex gap-2">
        <input
          data-nombre
          list="svLista" value={f.nombre}
          onChange={e => onChange({ nombre: e.target.value })}
          placeholder="Nombre y apellido" aria-label="Nombre"
          className="input text-sm flex-1"
        />
        <input
          value={f.roles} onChange={e => onChange({ roles: e.target.value })}
          placeholder="Roles (coma)" aria-label="Roles"
          className="input text-sm flex-1"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Attendance toggle */}
        <div className="flex rounded-[8px] overflow-hidden text-xs" style={{ border: "1px solid var(--color-line)" }}>
          <button type="button" className="px-3 py-1.5 font-semibold" style={{ background: !f.aus ? "var(--color-accent)" : "var(--color-surface)", color: !f.aus ? "var(--color-accent-ink)" : "var(--color-muted)" }} onClick={() => onChange({ aus: false })}>Asistió</button>
          <button type="button" className="px-3 py-1.5 font-semibold" style={{ background: f.aus ? "var(--color-down)" : "var(--color-surface)", color: f.aus ? "white" : "var(--color-muted)" }} onClick={() => onChange({ aus: true })}>Ausente</button>
        </div>
        <button type="button" className="text-xs font-semibold px-2 py-1.5 rounded-[6px]" style={{ color: "var(--color-down)", background: "var(--color-down-soft)" }} onClick={onRemove}>Quitar</button>
        {estado && <span className="text-xs" style={{ color: estado.color }}>{estado.text}</span>}
      </div>
      {f.aus && (
        <input value={f.nota} onChange={e => onChange({ nota: e.target.value })} placeholder="Anotación (opcional)" aria-label="Anotación" className="input text-xs" maxLength={200} />
      )}
    </div>
  );
}
