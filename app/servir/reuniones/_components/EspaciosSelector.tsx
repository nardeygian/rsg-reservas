"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import { consultarDisponibilidad, type Disponibilidad } from "../actions";

export type EspacioOpcion = { id: string; name: string; capacity: number | null; booking_policy: string };
export type EstadoReserva = { status: string; ocupado_desde: string | null; ocupado_hasta: string | null };
export type ValorEspacios = { space_ids: string[]; setup_minutes: number; teardown_minutes: number };

const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const DIA_HORA = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

function franja(desde: string, hasta: string): string {
  const mismoDia = new Date(desde).toDateString() === new Date(hasta).toDateString();
  return `${(mismoDia ? HORA : DIA_HORA).format(new Date(desde))} – ${HORA.format(new Date(hasta))}`;
}

function horas(min: number): string {
  if (min === 0) return "sin tiempo";
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

const ESTADO_RESERVA: Record<string, { t: string; c: string }> = {
  approved: { t: "Reservado", c: "chip-up" },
  requested: { t: "Pide aprobación", c: "chip-gold" },
  rejected: { t: "Rechazado", c: "chip-down" },
  cancelled: { t: "Liberado", c: "chip-muted" },
};

const OPCIONES_MIN = [0, 30, 60, 90, 120, 180, 240];

// "¿Qué espacios se van a usar?" Muestra los espacios de Reservas con su
// disponibilidad en la franja de la reunión más montaje y desmonte. Un
// espacio ocupado no se puede escoger (decisión de Gian). La base vuelve a
// revisarlo al publicar: esto solo ayuda a escoger.
export function EspaciosSelector({
  espacios, valor, onChange, inicio, fin, meetingId, reservas, editable = true, nota, plantilla = false,
}: {
  espacios: EspacioOpcion[];
  valor: ValorEspacios;
  onChange: (v: ValorEspacios) => void;
  inicio: string | null;          // ISO UTC
  fin: string | null;
  meetingId?: string | null;
  reservas?: Record<string, EstadoReserva>;
  editable?: boolean;
  nota?: string;
  plantilla?: boolean;            // tipos y plantillas: sin fecha, sin disponibilidad
}) {
  const [dispo, setDispo] = useState<Record<string, Disponibilidad>>({});
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!inicio || !fin) { setDispo({}); return; }
    let vivo = true;
    setCargando(true);
    const t = setTimeout(async () => {
      const r = await consultarDisponibilidad({
        starts_at: inicio, ends_at: fin, setup_minutes: valor.setup_minutes, teardown_minutes: valor.teardown_minutes, meeting_id: meetingId,
      });
      if (!vivo) return;
      setDispo(r.ok ? Object.fromEntries(r.data.map((d) => [d.space_id, d])) : {});
      setCargando(false);
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [inicio, fin, valor.setup_minutes, valor.teardown_minutes, meetingId]);

  const ocupaDesde = inicio ? new Date(Date.parse(inicio) - valor.setup_minutes * 60_000).toISOString() : null;
  const ocupaHasta = fin ? new Date(Date.parse(fin) + valor.teardown_minutes * 60_000).toISOString() : null;

  function alternar(id: string) {
    const on = valor.space_ids.includes(id);
    onChange({ ...valor, space_ids: on ? valor.space_ids.filter((x) => x !== id) : [...valor.space_ids, id] });
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={!editable}>
      <legend className="field-label mb-1">{plantilla ? "Espacios habituales" : "¿Qué espacios se van a usar?"}</legend>

      <div className="grid grid-cols-2 gap-3">
        {(["setup_minutes", "teardown_minutes"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>{k === "setup_minutes" ? "Montaje antes" : "Desmonte después"}</span>
            <select className="input" value={valor[k]} onChange={(e) => onChange({ ...valor, [k]: Number(e.target.value) })}>
              {[...new Set([...OPCIONES_MIN, valor[k]])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{horas(n)}</option>)}
            </select>
          </label>
        ))}
      </div>

      {plantilla ? null : !inicio || !fin ? (
        <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>Pon la hora y la duración para ver qué espacios están libres.</p>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
          Ocupa {franja(ocupaDesde!, ocupaHasta!)} con montaje y desmonte.{cargando ? " Revisando…" : ""}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {espacios.map((s) => {
          const on = valor.space_ids.includes(s.id);
          const d = dispo[s.id];
          const ocupado = !!d && !d.libre;
          const reserva = reservas?.[s.id];
          return (
            <li key={s.id}>
              <button type="button" role="checkbox" aria-checked={on} onClick={() => alternar(s.id)}
                disabled={!editable || (ocupado && !on)}
                className="w-full card px-4 min-h-[56px] py-2 flex items-center gap-3 text-left disabled:opacity-60"
                style={on ? { borderColor: ocupado ? "var(--color-down)" : "var(--color-accent)" } : undefined}>
                <span className="w-6 h-6 rounded-[7px] flex items-center justify-center flex-none"
                  style={on ? { background: "var(--color-accent)", color: "var(--color-accent-ink)" } : { border: "1.5px solid var(--color-line-strong)" }}>
                  {on && <Icon name="check" size={14} strokeWidth={2.6} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>{s.name}</span>
                  <span className="block text-[12px]" style={{ color: ocupado ? "var(--color-down)" : "var(--color-muted)" }}>
                    {ocupado && d.ocupado_desde && d.ocupado_hasta
                      ? `Ocupado ${franja(d.ocupado_desde, d.ocupado_hasta)}`
                      : [s.capacity ? `${s.capacity} personas` : null, s.booking_policy === "needs_approval" ? "Pide aprobación (salvo reuniones de ministerio)" : null].filter(Boolean).join(" · ") || "Libre"}
                  </span>
                </span>
                {reserva && <span className={`chip ${ESTADO_RESERVA[reserva.status]?.c ?? "chip-muted"} flex-none`}>{ESTADO_RESERVA[reserva.status]?.t ?? reserva.status}</span>}
                {!reserva && d && !ocupado && <span className="chip chip-up flex-none">Libre</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {nota && <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>{nota}</p>}
    </fieldset>
  );
}
