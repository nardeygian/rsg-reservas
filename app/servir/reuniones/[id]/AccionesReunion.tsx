"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/ui/Icon";
import type { Resultado } from "@/lib/servir/contratos";
import {
  cancelarReunion, duplicarReunion, guardarComoPlantilla, guardarDatosReunion,
  publicarReunion, reprogramarReunion, restaurarReunion,
} from "../actions";
import { horaBogota, instanteBogota, sumarDias } from "../_lib/fechas";

type Panel = null | "datos" | "reprogramar" | "cancelar" | "duplicar" | "plantilla";

export function AccionesReunion({
  reunion,
  nombrePlantillaSugerido,
}: {
  reunion: {
    id: string; name: string; status: string; meeting_date: string;
    starts_at: string | null; ends_at: string | null; notes: string | null;
  };
  nombrePlantillaSugerido: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const horaActual = reunion.starts_at ? horaBogota(reunion.starts_at) : "";
  const durActual = reunion.starts_at && reunion.ends_at
    ? Math.round((new Date(reunion.ends_at).getTime() - new Date(reunion.starts_at).getTime()) / 60_000) : null;

  const [nombre, setNombre] = useState(reunion.name);
  const [hora, setHora] = useState(horaActual);
  const [dur, setDur] = useState(durActual ? String(durActual) : "");
  const [notas, setNotas] = useState(reunion.notes ?? "");
  const [nuevaFecha, setNuevaFecha] = useState(reunion.meeting_date);
  const [nuevaHora, setNuevaHora] = useState(horaActual);
  const [motivo, setMotivo] = useState("");
  const [fechaCopia, setFechaCopia] = useState(sumarDias(reunion.meeting_date, 7));
  const [nombrePlantilla, setNombrePlantilla] = useState(nombrePlantillaSugerido);

  const editable = reunion.status === "borrador" || reunion.status === "publicada";

  function abrir(p: Panel) {
    setPanel(panel === p ? null : p);
    setError(null);
    setAviso(null);
  }

  function correr<T>(fn: () => Promise<Resultado<T>>, despues: (data: T) => void) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      despues(r.data);
    });
  }

  const boton = (p: Panel, icono: Parameters<typeof Icon>[0]["name"], texto: string) => (
    <button type="button" onClick={() => abrir(p)} aria-expanded={panel === p}
      className="h-10 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5"
      style={{
        background: panel === p ? "var(--color-surface-2)" : "var(--color-surface)",
        border: "1px solid var(--color-line)", color: "var(--color-ink)", boxShadow: "inset 0 1px 0 var(--glass-border)",
      }}>
      <Icon name={icono} size={15} />
      {texto}
    </button>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {reunion.status === "borrador" && (
          <button type="button" className="h-10 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5"
            style={{ background: "var(--color-action-bg)", color: "var(--color-action-fg)", opacity: pendiente ? 0.6 : 1 }}
            disabled={pendiente}
            onClick={() => correr(() => publicarReunion(reunion.id), () => { setAviso("Publicada."); router.refresh(); })}>
            <Icon name="check" size={15} />
            Publicar
          </button>
        )}
        {editable && boton("datos", "clock", "Editar datos")}
        {editable && boton("reprogramar", "calendar-plus", "Reprogramar")}
        {boton("duplicar", "copy", "Duplicar")}
        {boton("plantilla", "repeat", "Guardar como plantilla")}
        {editable && boton("cancelar", "x-circle", "Cancelar reunión")}
        {reunion.status === "cancelada" && (
          <button type="button" className="h-10 px-4 rounded-full text-[14px] font-semibold"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
            disabled={pendiente}
            onClick={() => correr(() => restaurarReunion(reunion.id), () => { setAviso("Restaurada como borrador."); router.refresh(); })}>
            Restaurar
          </button>
        )}
      </div>

      {panel === "datos" && (
        <form className="card p-4 md:p-5 grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const d = dur ? Number(dur) : null;
            if (d !== null && !(d > 0)) return setError("La duración debe ser mayor que cero.");
            const starts = hora ? instanteBogota(reunion.meeting_date, hora) : null;
            const ends = starts && d ? new Date(new Date(starts).getTime() + d * 60_000).toISOString() : null;
            correr(() => guardarDatosReunion(reunion.id, { name: nombre, starts_at: starts, ends_at: ends, notes: notas }),
              () => { setPanel(null); setAviso("Datos guardados."); router.refresh(); });
          }}>
          <div className="md:col-span-2">
            <label htmlFor="d-nombre" className="field-label block mb-1.5">Nombre</label>
            <input id="d-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="d-hora" className="field-label block mb-1.5">Hora de inicio</label>
            <input id="d-hora" type="time" className="input" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-dur" className="field-label block mb-1.5">Duración (min)</label>
            <input id="d-dur" type="number" min={1} className="input" value={dur} onChange={(e) => setDur(e.target.value)} disabled={!hora} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="d-notas" className="field-label block mb-1.5">Notas para el equipo</label>
            <textarea id="d-notas" rows={3} className="input py-2" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <p className="text-xs md:col-span-2" style={{ color: "var(--color-faint)" }}>Para cambiar la fecha usa Reprogramar: queda en el historial y se avisa al equipo.</p>
          <button type="submit" className="btn-primary md:col-span-2 md:justify-self-start" disabled={pendiente}>Guardar</button>
        </form>
      )}

      {panel === "reprogramar" && (
        <form className="card p-4 md:p-5 grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const starts = nuevaHora ? instanteBogota(nuevaFecha, nuevaHora) : null;
            correr(() => reprogramarReunion(reunion.id, nuevaFecha, starts, motivo),
              () => { setPanel(null); setMotivo(""); setAviso("Reprogramada. El equipo asignado recibe el aviso."); router.refresh(); });
          }}>
          <div>
            <label htmlFor="r-fecha" className="field-label block mb-1.5">Nueva fecha</label>
            <input id="r-fecha" type="date" className="input" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="r-hora" className="field-label block mb-1.5">Hora</label>
            <input id="r-hora" type="time" className="input" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="r-motivo" className="field-label block mb-1.5">Motivo (opcional, lo ve el equipo)</label>
            <input id="r-motivo" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
          </div>
          <button type="submit" className="btn-primary md:col-span-2 md:justify-self-start" disabled={pendiente}>Reprogramar</button>
        </form>
      )}

      {panel === "cancelar" && (
        <form className="card p-4 md:p-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => cancelarReunion(reunion.id, motivo),
              () => { setPanel(null); setMotivo(""); setAviso("Cancelada. El equipo asignado recibe el aviso."); router.refresh(); });
          }}>
          <p className="text-[14px]">La reunión queda cancelada en el historial y en las estadísticas. Puedes restaurarla después.</p>
          <div>
            <label htmlFor="c-motivo" className="field-label block mb-1.5">Motivo (opcional, lo ve el equipo)</label>
            <input id="c-motivo" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
          </div>
          <button type="submit" className="btn-primary self-start" disabled={pendiente}
            style={{ background: "var(--color-critical)", color: "#F6F5F1" }}>
            Cancelar reunión
          </button>
        </form>
      )}

      {panel === "duplicar" && (
        <form className="card p-4 md:p-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => duplicarReunion(reunion.id, fechaCopia), (d) => router.push(`/servir/reuniones/${d.id}`));
          }}>
          <p className="text-[14px]">Crea un borrador con el mismo tipo, hora y orden. El equipo asignado no se copia.</p>
          <div>
            <label htmlFor="u-fecha" className="field-label block mb-1.5">Fecha de la copia</label>
            <input id="u-fecha" type="date" className="input md:max-w-[240px]" value={fechaCopia} onChange={(e) => setFechaCopia(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary self-start" disabled={pendiente}>Duplicar</button>
        </form>
      )}

      {panel === "plantilla" && (
        <form className="card p-4 md:p-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => guardarComoPlantilla(reunion.id, nombrePlantilla), () => { setPanel(null); setAviso("Plantilla guardada en Tipos y plantillas."); });
          }}>
          <p className="text-[14px]">Guarda el orden de esta reunión. Si ya hay una plantilla con ese nombre para este tipo, queda como su nueva versión.</p>
          <div>
            <label htmlFor="p-nombre" className="field-label block mb-1.5">Nombre de la plantilla</label>
            <input id="p-nombre" className="input" value={nombrePlantilla} onChange={(e) => setNombrePlantilla(e.target.value)} required maxLength={120} />
          </div>
          <button type="submit" className="btn-primary self-start" disabled={pendiente}>Guardar plantilla</button>
        </form>
      )}

      {error && <p role="alert" className="text-[14px] font-medium" style={{ color: "var(--color-critical)" }}>{error}</p>}
      {aviso && <p role="status" className="text-[14px] font-medium" style={{ color: "var(--color-positive)" }}>{aviso}</p>}
    </section>
  );
}
