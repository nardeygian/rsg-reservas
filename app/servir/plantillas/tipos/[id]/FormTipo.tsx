"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClaseReunion, Conteo } from "@/lib/servir/contratos";
import { DIAS } from "../../../reuniones/_lib/fechas";
import { guardarTipo, type DatosTipo } from "../../actions";

const COLORES = ["#003329", "#2E5A66", "#1F6B4F", "#8A7424", "#9A3B2E", "#6B4E8A", "#B8643A", "#55524A"];

export function FormTipo({
  inicial, ministerios, espacios, plantillas,
}: {
  inicial: DatosTipo;
  ministerios: { id: string; name: string }[];
  espacios: { id: string; name: string }[];
  plantillas: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [d, setD] = useState<DatosTipo>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const poner = <K extends keyof DatosTipo>(k: K, v: DatosTipo[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <form className="grid gap-5 md:grid-cols-2 md:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await guardarTipo(d);
          if (!r.ok) return setError(r.error);
          router.push("/servir/plantillas");
        });
      }}>
      <div className="card p-5 md:p-7 flex flex-col gap-5">
        <div>
          <label htmlFor="nombre" className="field-label block mb-1.5">Nombre</label>
          <input id="nombre" className="input" value={d.name} onChange={(e) => poner("name", e.target.value)} required maxLength={120} />
        </div>
        <div>
          <label htmlFor="min" className="field-label block mb-1.5">Ministerio o departamento</label>
          <select id="min" className="input" value={d.ministry_id ?? ""} onChange={(e) => poner("ministry_id", e.target.value || null)}>
            <option value="">General (toda la iglesia)</option>
            {ministerios.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="conteo" className="field-label block mb-1.5">Cuenta como</label>
            <select id="conteo" className="input" value={d.counting} onChange={(e) => poner("counting", e.target.value as Conteo)}>
              <option value="min">Ministerio</option>
              <option value="serv">Servolución</option>
            </select>
          </div>
          <div>
            <label htmlFor="clase" className="field-label block mb-1.5">Clase</label>
            <select id="clase" className="input" value={d.kind} onChange={(e) => {
              const kind = e.target.value as ClaseReunion;
              setD((x) => ({ ...x, kind, counting: kind === "servolucion" ? "serv" : "min" }));
            }}>
              <option value="ministerio">Ministerio</option>
              <option value="servolucion">Servolución</option>
              <option value="evento">Evento</option>
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="field-label mb-1.5">Color en el Calendario</legend>
          <div className="flex flex-wrap gap-2">
            {COLORES.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={d.color === c} onClick={() => poner("color", c)}
                className="w-9 h-9 rounded-full"
                style={{ background: c, outline: d.color === c ? "3px solid var(--color-focus-ring)" : "none", outlineOffset: 2 }} />
            ))}
            <button type="button" aria-pressed={!d.color} onClick={() => poner("color", null)}
              className="h-9 px-3 rounded-full text-[13px] font-semibold" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              Sin color
            </button>
          </div>
        </fieldset>
        <p className="text-xs -mt-2" style={{ color: "var(--color-faint)" }}>
          La clase se copia a cada reunión nueva y decide si su servicio cuenta como ministerio o Servolución. Las reuniones ya creadas no cambian.
        </p>
      </div>

      <div className="card p-5 md:p-7 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dia" className="field-label block mb-1.5">Día habitual</label>
            <select id="dia" className="input" value={d.usual_weekday ?? ""} onChange={(e) => poner("usual_weekday", e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">Variable</option>
              {DIAS.map((x, i) => <option key={x} value={i}>{x}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="hora" className="field-label block mb-1.5">Hora habitual</label>
            <input id="hora" type="time" className="input" value={d.usual_time?.slice(0, 5) ?? ""} onChange={(e) => poner("usual_time", e.target.value || null)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dur" className="field-label block mb-1.5">Duración (min)</label>
            <input id="dur" type="number" min={1} max={1440} className="input" value={d.duration_min ?? ""} onChange={(e) => poner("duration_min", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label htmlFor="esp" className="field-label block mb-1.5">Espacio habitual</label>
            <select id="esp" className="input" value={d.usual_space_id ?? ""} onChange={(e) => poner("usual_space_id", e.target.value || null)}>
              <option value="">Ninguno</option>
              {espacios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="plant" className="field-label block mb-1.5">Plantilla por defecto</label>
          <select id="plant" className="input" value={d.default_template_id ?? ""} onChange={(e) => poner("default_template_id", e.target.value || null)} disabled={!d.id}>
            <option value="">Ninguna</option>
            {plantillas.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {!d.id && <p className="text-xs mt-1.5" style={{ color: "var(--color-faint)" }}>Guarda el tipo y después crea su plantilla.</p>}
        </div>
        <label className="flex items-center gap-3 cursor-pointer text-[14px]">
          <input type="checkbox" className="accent-[var(--color-accent)]" checked={d.active} onChange={(e) => poner("active", e.target.checked)} />
          Activo (aparece al crear reuniones)
        </label>

        {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={pendiente} style={{ opacity: pendiente ? 0.6 : 1 }}>
          {pendiente ? "Guardando…" : d.id ? "Guardar tipo" : "Crear tipo"}
        </button>
      </div>
    </form>
  );
}
