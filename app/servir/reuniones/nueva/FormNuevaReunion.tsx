"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEnSerie, crearReunion } from "../actions";
import { DIAS, fechaCorta, fechasEnSerie, instanteBogota, sumarDias, diaSemana } from "../_lib/fechas";
import { EspaciosSelector, type EspacioOpcion, type ValorEspacios } from "../_components/EspaciosSelector";

export type TipoOpcion = {
  id: string;
  name: string;
  color: string | null;
  usual_weekday: number | null;
  usual_time: string | null;
  duration_min: number | null;
  default_template_id: string | null;
  usual_space_ids: string[];
  setup_minutes: number;
  teardown_minutes: number;
};
export type PlantillaOpcion = {
  id: string; name: string; version: number; meeting_type_id: string | null; items: number;
  space_ids: string[] | null; setup_minutes: number | null; teardown_minutes: number | null;
};

// Espacios y montaje: los de la plantilla y, si no tiene, los del tipo.
function espaciosDe(t: TipoOpcion | null, p: PlantillaOpcion | null): ValorEspacios {
  return {
    space_ids: p?.space_ids ?? t?.usual_space_ids ?? [],
    setup_minutes: p?.setup_minutes ?? t?.setup_minutes ?? 120,
    teardown_minutes: p?.teardown_minutes ?? t?.teardown_minutes ?? 60,
  };
}

// Siguiente fecha (desde hoy) que cae en ese día de la semana.
function proximo(hoy: string, dia: number | null): string {
  if (dia == null) return hoy;
  return sumarDias(hoy, (dia - diaSemana(hoy) + 7) % 7);
}

function finDeMes(fecha: string): string {
  const d = new Date(`${fecha.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function FormNuevaReunion({
  tipos, plantillas, hoy, tipoInicial, espacios,
}: {
  tipos: TipoOpcion[]; plantillas: PlantillaOpcion[]; hoy: string; tipoInicial: string | null; espacios: EspacioOpcion[];
}) {
  const router = useRouter();
  const inicial = tipos.find((t) => t.id === tipoInicial) ?? null;

  const [modo, setModo] = useState<"una" | "serie">("una");
  const [tipoId, setTipoId] = useState<string>(inicial?.id ?? "");
  const [plantillaId, setPlantillaId] = useState<string>(inicial?.default_template_id ?? "");
  const [nombre, setNombre] = useState(inicial?.name ?? "");
  const [fecha, setFecha] = useState(proximo(hoy, inicial?.usual_weekday ?? null));
  const [hora, setHora] = useState(inicial?.usual_time?.slice(0, 5) ?? "");
  const [durMin, setDurMin] = useState(inicial?.duration_min ? String(inicial.duration_min) : "");
  const [desde, setDesde] = useState(proximo(hoy, inicial?.usual_weekday ?? null));
  const [hasta, setHasta] = useState(finDeMes(hoy));
  const [dias, setDias] = useState<number[]>(inicial?.usual_weekday != null ? [inicial.usual_weekday] : [0]);
  const [esp, setEsp] = useState<ValorEspacios>(() =>
    espaciosDe(inicial, plantillas.find((p) => p.id === inicial?.default_template_id) ?? null));
  const [error, setError] = useState<string | null>(null);
  const [choques, setChoques] = useState<string[] | null>(null);
  const [pendiente, startTransition] = useTransition();

  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const plantillasDelTipo = plantillas.filter((p) => !tipoId || p.meeting_type_id === tipoId || p.meeting_type_id === null);
  const serie = useMemo(() => fechasEnSerie(desde, hasta, dias), [desde, hasta, dias]);

  function elegirTipo(id: string) {
    const t = tipos.find((x) => x.id === id) ?? null;
    // El nombre sigue al tipo mientras no lo hayan cambiado a mano.
    if (!nombre.trim() || tipos.some((x) => x.name === nombre)) setNombre(t?.name ?? "");
    setTipoId(id);
    setPlantillaId(t?.default_template_id ?? "");
    setEsp(espaciosDe(t, plantillas.find((p) => p.id === t?.default_template_id) ?? null));
    setHora(t?.usual_time?.slice(0, 5) ?? "");
    setDurMin(t?.duration_min ? String(t.duration_min) : "");
    if (t?.usual_weekday != null) {
      setFecha(proximo(hoy, t.usual_weekday));
      setDesde(proximo(hoy, t.usual_weekday));
      setDias([t.usual_weekday]);
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dur = durMin ? Number(durMin) : null;
    if (dur !== null && !(dur > 0)) return setError("La duración debe ser mayor que cero.");
    const primera = modo === "una" ? fecha : serie[0];
    if (!primera) return setError("Elige al menos una fecha.");
    const starts_at = hora ? instanteBogota(primera, hora) : null;
    const ends_at = starts_at && dur ? new Date(new Date(starts_at).getTime() + dur * 60_000).toISOString() : null;
    const base = {
      meeting_type_id: tipoId || null,
      template_id: plantillaId || null,
      name: nombre,
      starts_at,
      ends_at,
      space_ids: esp.space_ids,
      setup_minutes: esp.setup_minutes,
      teardown_minutes: esp.teardown_minutes,
    };
    if (esp.space_ids.length && !ends_at) return setError("Para reservar espacios, pon la hora de inicio y la duración.");
    startTransition(async () => {
      if (modo === "una") {
        const r = await crearReunion({ ...base, meeting_date: fecha });
        if (!r.ok) return setError(r.error);
        router.push(`/servir/reuniones/${r.data.id}`);
      } else {
        const r = await crearEnSerie(base, serie);
        if (!r.ok) return setError(r.error);
        // Si algún espacio ya está ocupado en alguna fecha, se avisa antes de salir.
        if (r.data.choques.length) return setChoques(r.data.choques);
        router.push(tipoId ? `/servir/reuniones?tipo=${tipoId}` : "/servir/reuniones");
      }
    });
  }

  const plantilla = plantillas.find((p) => p.id === plantillaId);
  const primeraFecha = modo === "una" ? fecha : serie[0];
  const durVista = durMin ? Number(durMin) : 0;
  const inicioVista = hora && primeraFecha ? instanteBogota(primeraFecha, hora) : null;
  const finVista = inicioVista && durVista > 0 ? new Date(new Date(inicioVista).getTime() + durVista * 60_000).toISOString() : null;

  if (choques) {
    return (
      <div className="card p-5 md:p-7 flex flex-col gap-3 max-w-xl">
        <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-ink)" }}>Se crearon las reuniones, pero algunos espacios chocan</h2>
        <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
          Estas fechas no se podrán publicar con esos espacios. Cambia el espacio, la hora o el montaje en cada una:
        </p>
        <ul className="flex flex-col gap-1 text-[14px]" style={{ color: "var(--color-ink)" }}>
          {choques.map((c) => <li key={c} className="first-letter:uppercase">{c}</li>)}
        </ul>
        <button type="button" className="btn-primary self-start" onClick={() => router.push(tipoId ? `/servir/reuniones?tipo=${tipoId}` : "/servir/reuniones")}>
          Ver las reuniones
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:items-start">
      <div className="card p-5 md:p-7 flex flex-col gap-5">
        <div>
          <label htmlFor="tipo" className="field-label block mb-1.5">Tipo de reunión</label>
          <select id="tipo" className="input" value={tipoId} onChange={(e) => elegirTipo(e.target.value)}>
            <option value="">En blanco (sin tipo)</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {tipo && (
            <p className="text-xs mt-1.5" style={{ color: "var(--color-faint)" }}>
              {[tipo.usual_weekday != null ? DIAS[tipo.usual_weekday] : null, tipo.usual_time?.slice(0, 5), tipo.duration_min ? `${tipo.duration_min} min` : null]
                .filter(Boolean).join(" · ") || "Este tipo no tiene día ni hora habitual."}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="plantilla" className="field-label block mb-1.5">Plantilla</label>
          <select id="plantilla" className="input" value={plantillaId} onChange={(e) => {
            setPlantillaId(e.target.value);
            setEsp(espaciosDe(tipo, plantillas.find((p) => p.id === e.target.value) ?? null));
          }}>
            <option value="">Sin plantilla (orden vacío)</option>
            {plantillasDelTipo.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · v{p.version} · {p.items} ítems</option>
            ))}
          </select>
          {plantilla && (
            <p className="text-xs mt-1.5" style={{ color: "var(--color-faint)" }}>
              El orden se copia de la plantilla. Si la plantilla cambia después, esta reunión no cambia.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="nombre" className="field-label block mb-1.5">Nombre</label>
          <input id="nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Reunión Central" required maxLength={200} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hora" className="field-label block mb-1.5">Hora de inicio</label>
            <input id="hora" type="time" className="input" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dur" className="field-label block mb-1.5">Duración (min)</label>
            <input id="dur" type="number" min={1} max={1440} inputMode="numeric" className="input" value={durMin} onChange={(e) => setDurMin(e.target.value)} disabled={!hora} />
          </div>
        </div>
        <p className="text-xs -mt-3" style={{ color: "var(--color-faint)" }}>Hora de Bogotá. Puedes dejarla vacía si todavía no está definida.</p>

        <EspaciosSelector
          espacios={espacios}
          valor={esp}
          onChange={setEsp}
          inicio={inicioVista}
          fin={finVista}
          nota={modo === "serie"
            ? "La disponibilidad es de la primera fecha. Al crear la serie te avisamos si alguna otra choca. Los espacios se reservan al publicar cada reunión."
            : "Los espacios se reservan al publicar la reunión; en borrador quedan escogidos."}
        />
      </div>

      <div className="card p-5 md:p-7 flex flex-col gap-5">
        <div className="segmented self-start" role="group" aria-label="Cuántas reuniones">
          <button type="button" aria-pressed={modo === "una"} onClick={() => setModo("una")}>Una fecha</button>
          <button type="button" aria-pressed={modo === "serie"} onClick={() => setModo("serie")}>En serie</button>
        </div>

        {modo === "una" ? (
          <div>
            <label htmlFor="fecha" className="field-label block mb-1.5">Fecha</label>
            <input id="fecha" type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="desde" className="field-label block mb-1.5">Desde</label>
                <input id="desde" type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <label htmlFor="hasta" className="field-label block mb-1.5">Hasta</label>
                <input id="hasta" type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>
            <fieldset>
              <legend className="field-label mb-1.5">Días</legend>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d, i) => {
                  const on = dias.includes(i);
                  return (
                    <button key={d} type="button" aria-pressed={on}
                      onClick={() => setDias(on ? dias.filter((x) => x !== i) : [...dias, i])}
                      className="h-9 min-w-[44px] px-3 rounded-full text-[13px] font-semibold"
                      style={on
                        ? { background: "var(--color-action-bg)", color: "var(--color-action-fg)" }
                        : { background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div>
              <p className="field-label mb-1.5">
                {serie.length === 0 ? "Ninguna fecha en ese rango" : `${serie.length} ${serie.length === 1 ? "reunión" : "reuniones"}`}
              </p>
              {serie.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {serie.map((f) => <li key={f} className="chip chip-muted tabular">{fechaCorta(f)}</li>)}
                </ul>
              )}
              {serie.length > 60 && <p className="text-xs mt-1.5" style={{ color: "var(--color-critical)" }}>Máximo 60 por serie.</p>}
            </div>
          </>
        )}

        {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={pendiente} style={{ opacity: pendiente ? 0.6 : 1 }}>
          {pendiente ? "Creando…" : modo === "una" ? "Crear reunión" : `Crear ${serie.length || ""} reuniones`}
        </button>
        <p className="text-xs -mt-2" style={{ color: "var(--color-faint)" }}>Se crean en borrador. Publícalas cuando el orden esté listo.</p>
      </div>
    </form>
  );
}
