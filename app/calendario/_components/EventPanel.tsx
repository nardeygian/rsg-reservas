"use client";

import { Icon } from "@/app/_components/ui/Icon";

import Link from "next/link";
import type { EventoAgenda } from "@/lib/servir/agenda";
import type { LinkInfo, ReunionCal } from "../page";

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];
const DAY_NAMES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTimeBogota(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });
}

function categoryStyle(cat: string | null) {
  const PALETTE = [
    { bg: "var(--color-accent-soft)", color: "var(--color-accent)" },
    { bg: "rgba(47,94,158,0.12)", color: "#2F7EE8" },
    { bg: "rgba(124,58,237,0.1)", color: "#8B5CF6" },
    { bg: "rgba(180,83,9,0.1)", color: "#D97706" },
    { bg: "rgba(220,38,38,0.1)", color: "#EF4444" },
    { bg: "rgba(8,145,178,0.1)", color: "#06B6D4" },
    { bg: "rgba(190,24,93,0.1)", color: "#EC4899" },
  ];
  if (!cat) return PALETTE[0];
  let h = 0;
  for (const c of cat) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

export function EventPanel({
  event,
  link,
  reunion,
  onClose,
}: {
  event: EventoAgenda | null;
  link: LinkInfo | null;
  reunion: ReunionCal | null;
  onClose: () => void;
}) {
  if (!event) return null;

  const { bg, color } = categoryStyle(event.category);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[65]"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="glass glass-strong fixed bottom-0 left-0 right-0 z-[70] rounded-t-[var(--radius-sheet)] flex flex-col"
        style={{
          background: "var(--color-surface)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          maxHeight: "80dvh",
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-none">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-line)" }} />
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-8 pt-3 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {event.category && (
                <span
                  className="text-[11px] font-bold uppercase tracking-wide w-fit px-2 py-[2px] rounded-full"
                  style={{ background: bg, color }}
                >
                  {event.category}
                </span>
              )}
              <h2 className="text-[20px] font-bold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>
                {event.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full flex-none mt-0.5"
              style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
              aria-label="Cerrar"
            >
              <Icon name="close" size={16} label="Cerrar" />
            </button>
          </div>

          {/* Fecha */}
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-3" style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)" }}>
            <div className="w-10 h-10 rounded-[var(--radius-control)] flex flex-col items-center justify-center flex-none" style={{ background: bg }}>
              <span className="text-[10px] font-bold uppercase" style={{ color, lineHeight: 1 }}>
                {MONTH_NAMES[new Date(event.due_on + "T12:00:00").getMonth()].slice(0, 3)}
              </span>
              <span className="text-[20px] font-bold leading-none" style={{ color }}>
                {new Date(event.due_on + "T12:00:00").getDate()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm first-letter:uppercase" style={{ color: "var(--color-ink)" }}>
                {formatDateFull(event.due_on)}
              </p>
              {link?.starts_at && link?.ends_at && (
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-accent)" }}>
                  {formatTimeBogota(link.starts_at)} – {formatTimeBogota(link.ends_at)}
                </p>
              )}
            </div>
          </div>

          {/* Reunión de Servir */}
          {reunion && <ReunionServir reunion={reunion} />}

          {event.asignado && (
            <p className="chip chip-up self-start">Estás asignado</p>
          )}

          {/* Espacios de la reunión (no los ve un servidor) */}
          {link?.space_name && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Espacios</span>
              <div className="flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-3"
                style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)" }}>
                <p className="flex-1 min-w-0 font-semibold text-sm" style={{ color: "var(--color-ink)" }}>{link.space_name}</p>
                {link.booking_id && (
                  <Link
                    href={`/reservas/${link.booking_id}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-control)] flex-none"
                    style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
                    onClick={onClose}
                  >
                    Ver reserva
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Notas */}
          {event.notes && (
            <div className="flex flex-col gap-1">
              <span className="eyebrow">Notas</span>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-muted)" }}>
                {event.notes}
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

const ESTADO_ASIG: Record<string, { t: string; c: string }> = {
  aceptada: { t: "Aceptó", c: "chip-up" },
  pendiente: { t: "Pendiente", c: "chip-gold" },
  rechazada: { t: "Rechazó", c: "chip-down" },
};

function ReunionServir({ reunion }: { reunion: ReunionCal }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Reunión de Servir</span>
        <Link href={reunion.status === "en_vivo" ? `/servir/${reunion.id}/vivo` : `/servir/reuniones/${reunion.id}`}
          className="text-[13px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
          {reunion.status === "en_vivo" ? "En vivo" : "Ver detalle"} <Icon name="arrow-right" size={14} />
        </Link>
      </div>
      {reunion.orden.length > 0 && (
        <ol className="rounded-[var(--radius-card)] px-4 py-3 text-[14px] flex flex-col gap-1" style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
          {reunion.orden.slice(0, 8).map((t, i) => <li key={i} className="truncate"><span className="tabular mr-2" style={{ color: "var(--color-faint)" }}>{i + 1}</span>{t}</li>)}
          {reunion.orden.length > 8 && <li style={{ color: "var(--color-muted)" }}>y {reunion.orden.length - 8} más</li>}
        </ol>
      )}
      {reunion.equipo.map((d) => (
        <div key={d.departamento} className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold" style={{ color: "var(--color-muted)" }}>{d.departamento}</span>
          <ul className="flex flex-col gap-1">
            {d.personas.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-[14px]" style={{ color: "var(--color-ink)" }}>
                <span className="flex-1 min-w-0 truncate">{p.nombre} <span style={{ color: "var(--color-muted)" }}>· {p.posicion}</span></span>
                <span className={`chip ${ESTADO_ASIG[p.estado]?.c ?? "chip-muted"} flex-none`}>{ESTADO_ASIG[p.estado]?.t ?? p.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
