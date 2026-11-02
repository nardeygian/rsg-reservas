"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { borrarAvisoAuto, guardarAvisoAuto } from "../actions";

export type AvisoAuto = {
  id: string; run_item_id: string; anchor: "antes_fin" | "despues_inicio"; minutes: number;
  ministry_ids: string[]; message: string; sent_at: string | null; skipped: boolean;
};

// Avisos que salen solos mientras la reunión está en vivo, p. ej. "cuando
// falten 15 min de la prédica, avisar a LMRSG que suban al escenario".
// Viajan con "Guardar como plantilla" y con "Duplicar".
export function AvisosAutomaticos({ meetingId, avisos, puntos, departamentos, editable }: {
  meetingId: string;
  avisos: AvisoAuto[];
  puntos: { id: string; title: string }[];
  departamentos: { id: string; name: string }[];
  editable: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [item, setItem] = useState(puntos.find((p) => /pr[eé]dica/i.test(p.title))?.id ?? puntos[0]?.id ?? "");
  const [anchor, setAnchor] = useState<AvisoAuto["anchor"]>("antes_fin");
  const [minutos, setMinutos] = useState("15");
  const [deptos, setDeptos] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [pendiente, start] = useTransition();

  const titulo = new Map(puntos.map((p) => [p.id, p.title]));
  const nombre = new Map(departamentos.map((d) => [d.id, d.name]));

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await guardarAvisoAuto(meetingId, { run_item_id: item, anchor, minutes: Number(minutos), ministry_ids: [...deptos], message: mensaje });
      if (!r.ok) return setError(r.error);
      setMensaje(""); setDeptos(new Set()); setAbierto(false);
    });
  }

  function borrar(id: string) {
    setError("");
    start(async () => { const r = await borrarAvisoAuto(meetingId, id); if (!r.ok) setError(r.error); });
  }

  return (
    <section className="card p-4 md:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Avisos automáticos</h2>
        {editable && !abierto && puntos.length > 0 && (
          <button type="button" className="btn-secondary min-h-[36px] px-3 text-[13px]" onClick={() => setAbierto(true)}>
            <Icon name="plus" size={14} /> Aviso
          </button>
        )}
      </div>
      {avisos.length === 0 && !abierto && (
        <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
          Por ejemplo: cuando falten 15 min de la prédica, avisar a la banda que suba al escenario.
        </p>
      )}
      {avisos.length > 0 && (
        <ul className="flex flex-col">
          {avisos.map((a) => (
            <li key={a.id} className="flex items-start gap-2 py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
              <span className="flex-1 min-w-0 text-[14px]">
                <span className="block" style={{ color: "var(--color-ink)" }}>{a.message}</span>
                <span className="block text-[12px]" style={{ color: "var(--color-muted)" }}>
                  {a.anchor === "antes_fin" ? `Faltando ${a.minutes} min de` : `A los ${a.minutes} min de`} {titulo.get(a.run_item_id) ?? "un punto"}
                  {" · "}{a.ministry_ids.map((m) => nombre.get(m)).filter(Boolean).join(", ")}
                  {a.sent_at && (a.skipped ? " · omitido" : " · enviado")}
                </span>
              </span>
              {editable && !a.sent_at && (
                <button type="button" className="icon-btn icon-btn-danger flex-none" aria-label={`Borrar aviso “${a.message}”`} aria-busy={pendiente} disabled={pendiente} onClick={() => borrar(a.id)}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Cuándo</span>
              <select className="input" value={anchor} onChange={(e) => setAnchor(e.target.value as AvisoAuto["anchor"])}>
                <option value="antes_fin">Cuando falten… min</option>
                <option value="despues_inicio">A los… min de empezar</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Min</span>
              <input className="input tabular" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Del punto</span>
            <select className="input" value={item} onChange={(e) => setItem(e.target.value)}>
              {puntos.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="field-label mb-1.5">Avisar a</legend>
            <div className="flex flex-wrap gap-1.5">
              {departamentos.map((d) => {
                const on = deptos.has(d.id);
                return (
                  <button key={d.id} type="button" aria-pressed={on} className="min-h-[36px] px-3 rounded-full text-[13px] font-semibold"
                    style={on ? { background: "var(--color-action-bg)", color: "var(--color-action-fg)" } : { background: "var(--color-surface-2)", color: "var(--color-ink)" }}
                    onClick={() => { const n = new Set(deptos); if (on) n.delete(d.id); else n.add(d.id); setDeptos(n); }}>
                    {d.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Mensaje</span>
            <input className="input" value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={300} placeholder="Suban al escenario" />
          </label>
          {error && <p role="alert" className="text-[13px]" style={{ color: "var(--color-critical)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" aria-busy={pendiente} disabled={pendiente || !item || !mensaje.trim() || deptos.size === 0}>Guardar aviso</button>
            <button type="button" className="btn-ghost" onClick={() => { setAbierto(false); setError(""); }}>Cancelar</button>
          </div>
        </form>
      )}
      {error && !abierto && <p role="alert" className="text-[13px]" style={{ color: "var(--color-critical)" }}>{error}</p>}
    </section>
  );
}
