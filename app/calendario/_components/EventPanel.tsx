"use client";

import Link from "next/link";
import type { AsanaEvent } from "@/lib/asana";
import type { LinkInfo, BookingOption } from "../page";

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

function toLocalDatePrefix(iso: string): string {
  const d = new Date(iso);
  const y = d.toLocaleString("en-CA", { year: "numeric", timeZone: "America/Bogota" });
  const m = d.toLocaleString("en-CA", { month: "2-digit", timeZone: "America/Bogota" });
  const day = d.toLocaleString("en-CA", { day: "2-digit", timeZone: "America/Bogota" });
  return `${y}-${m}-${day}`;
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
  bookingOptions,
  canLink,
  linkAction,
  unlinkAction,
  onClose,
}: {
  event: AsanaEvent | null;
  link: LinkInfo | null;
  bookingOptions: BookingOption[];
  canLink: boolean;
  linkAction: (fd: FormData) => Promise<void>;
  unlinkAction: (fd: FormData) => Promise<void>;
  onClose: () => void;
}) {
  if (!event) return null;

  const { bg, color } = categoryStyle(event.category);

  // Reservas del mismo día para el selector
  const sameDay = bookingOptions.filter((b) => toLocalDatePrefix(b.starts_at) === event.due_on);
  const otherDay = bookingOptions.filter((b) => toLocalDatePrefix(b.starts_at) !== event.due_on);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] flex flex-col"
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
              ×
            </button>
          </div>

          {/* Fecha */}
          <div className="flex items-center gap-3 rounded-[12px] px-4 py-3" style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)" }}>
            <div className="w-10 h-10 rounded-[10px] flex flex-col items-center justify-center flex-none" style={{ background: bg }}>
              <span className="text-[10px] font-bold uppercase" style={{ color, lineHeight: 1 }}>
                {MONTH_NAMES[new Date(event.due_on + "T12:00:00").getMonth()].slice(0, 3)}
              </span>
              <span className="text-[20px] font-bold leading-none" style={{ color }}>
                {new Date(event.due_on + "T12:00:00").getDate()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm capitalize" style={{ color: "var(--color-ink)" }}>
                {formatDateFull(event.due_on)}
              </p>
              {link?.starts_at && link?.ends_at && (
                <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-accent)" }}>
                  {formatTimeBogota(link.starts_at)} – {formatTimeBogota(link.ends_at)}
                </p>
              )}
            </div>
          </div>

          {/* Reserva enlazada */}
          {link ? (
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Espacio reservado</span>
              <div className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
                style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)" }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
                    {link.space_name ?? "Espacio"}
                  </p>
                  {link.starts_at && link.ends_at && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                      {formatTimeBogota(link.starts_at)} – {formatTimeBogota(link.ends_at)}
                    </p>
                  )}
                </div>
                <Link
                  href={`/reservas/${link.booking_id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-[8px]"
                  style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
                  onClick={onClose}
                >
                  Ver reserva
                </Link>
              </div>

              {canLink && (
                <form action={unlinkAction}>
                  <input type="hidden" name="asana_gid" value={event.gid} />
                  <button
                    type="submit"
                    className="text-xs font-semibold"
                    style={{ color: "var(--color-down)" }}
                  >
                    Quitar enlace
                  </button>
                </form>
              )}
            </div>
          ) : (
            canLink && (
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Enlazar con reserva</span>
                <form action={linkAction} className="flex flex-col gap-2">
                  <input type="hidden" name="asana_gid" value={event.gid} />
                  <select
                    name="booking_id"
                    required
                    className="input text-sm"
                    style={{ height: 40 }}
                    defaultValue=""
                  >
                    <option value="" disabled>Elige una reserva…</option>
                    {sameDay.length > 0 && (
                      <optgroup label={`Este día (${sameDay.length})`}>
                        {sameDay.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.space_name} · {formatTimeBogota(b.starts_at)} – {formatTimeBogota(b.ends_at)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherDay.length > 0 && (
                      <optgroup label="Otros días">
                        {otherDay.map((b) => (
                          <option key={b.id} value={b.id}>
                            {toLocalDatePrefix(b.starts_at)} · {b.space_name} · {formatTimeBogota(b.starts_at)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button type="submit" className="btn-primary w-full" style={{ height: 40 }}>
                    Guardar enlace
                  </button>
                </form>
              </div>
            )
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

          {!link && !canLink && (
            <p className="text-xs text-center" style={{ color: "var(--color-faint)" }}>
              Sin reserva de espacio enlazada
            </p>
          )}
        </div>
      </div>
    </>
  );
}
