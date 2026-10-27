"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { formatTime } from "@/lib/datetime";

const HOUR_START = 8;
const HOUR_END = 21;
const RANGE_MINS = (HOUR_END - HOUR_START) * 60;
const HOUR_LABELS = [
  { label: "8 am", pct: 0 },
  { label: "12 m", pct: ((12 - HOUR_START) / (HOUR_END - HOUR_START)) * 100 },
  { label: "4 pm", pct: ((16 - HOUR_START) / (HOUR_END - HOUR_START)) * 100 },
  { label: "9 pm", pct: 100 },
];

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Por aprobar",
  approved: "Aprobada",
};

function bogotaHHMM(iso: string): { h: number; m: number } {
  const date = new Date(iso);
  const str = date.toLocaleString("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = str.split(":").map(Number);
  return { h, m };
}

function toTimeline(iso: string): number {
  const { h, m } = bogotaHHMM(iso);
  return Math.max(0, Math.min(100, (((h - HOUR_START) * 60 + m) / RANGE_MINS) * 100));
}

export type BookingBlock = {
  id: string;
  space_id: string;
  space_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  display_owner: string | null;
  use_type: string | null;
  title: string | null;
  isOwn: boolean;
};

export type SpaceInfo = {
  id: string;
  name: string;
  status: string;
};

export function ReservasDayView({
  spaces,
  bookings,
  dayLabel,
  prevDate,
  nextDate,
  dateParam,
}: {
  spaces: SpaceInfo[];
  bookings: BookingBlock[];
  dayLabel: string;
  prevDate: string;
  nextDate: string;
  dateParam: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (bookings.find((b) => b.id === selectedId) ?? null) : null;
  // null = auto height (fits content naturally); number = dvh% during/after drag
  const [sheetH, setSheetH] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const maxH = useRef(88);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef(0);

  function onHandleTouchStart(e: React.TouchEvent) {
    if (!sheetRef.current) return;
    // Measure natural height at drag start and use it as ceiling
    const px = sheetRef.current.getBoundingClientRect().height;
    const pct = (px / window.innerHeight) * 100;
    maxH.current = Math.min(88, pct); // can't go higher than natural content height
    dragStartY.current = e.touches[0].clientY;
    dragStartH.current = pct;
    setSheetH(pct);
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    if (dragStartY.current === null) return;
    const dy = dragStartY.current - e.touches[0].clientY;
    const pct = (dy / window.innerHeight) * 100;
    setSheetH(Math.min(maxH.current, Math.max(20, dragStartH.current + pct)));
  }
  function onHandleTouchEnd() {
    if ((sheetH ?? 100) < 28) setSelectedId(null);
    else setSheetH(null); // snap back to auto height
    dragStartY.current = null;
  }

  const bySpace = new Map<string, BookingBlock[]>();
  for (const b of bookings) {
    const arr = bySpace.get(b.space_id) ?? [];
    arr.push(b);
    bySpace.set(b.space_id, arr);
  }

  return (
    <>
      {/* View toggle */}
      <div
        className="flex rounded-[var(--radius-control)] p-[4px] gap-1"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
      >
        <span
          className="flex-1 text-center text-sm py-1.5 rounded-[var(--radius-control)] font-semibold"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          Día
        </span>
        <Link
          href={`/reservas?date=${dateParam}&view=mes`}
          className="flex-1 text-center text-sm py-1.5 rounded-[var(--radius-control)]"
          style={{ color: "var(--color-muted)" }}
        >
          Mes
        </Link>
      </div>

      {/* Day navigator */}
      <div
        className="flex items-center justify-between rounded-[var(--radius-control)] p-[6px]"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
      >
        <Link
          href={`/reservas?date=${prevDate}`}
          className="w-10 h-10 inline-flex items-center justify-center rounded-[var(--radius-control)] border text-lg"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          aria-label="Día anterior"
        >
          ‹
        </Link>
        <span
          className="font-semibold text-[15px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {dayLabel}
        </span>
        <Link
          href={`/reservas?date=${nextDate}`}
          className="w-10 h-10 inline-flex items-center justify-center rounded-[var(--radius-control)] border text-lg"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          aria-label="Día siguiente"
        >
          ›
        </Link>
      </div>

      {/* Hour labels */}
      <div
        className="flex justify-between text-[11px] px-[92px]"
        style={{ color: "var(--color-muted)" }}
      >
        {HOUR_LABELS.map((h) => (
          <span key={h.label}>{h.label}</span>
        ))}
      </div>

      {/* Space rows */}
      <div className="flex flex-col gap-2">
        {spaces.map((space) => {
          if (space.status === "maintenance") {
            return (
              <div
                key={space.id}
                className="rounded-[var(--radius-control)] px-3 py-3 flex items-center gap-[10px]"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px dashed var(--color-line)",
                  color: "var(--color-muted)",
                }}
              >
                <span className="w-[80px] flex-none font-semibold text-sm">{space.name}</span>
                <span className="text-[12.5px]">No disponible por ahora</span>
              </div>
            );
          }

          const spaceBookings = bySpace.get(space.id) ?? [];
          const hasOwn = spaceBookings.some((b) => b.isOwn);

          return (
            <div
              key={space.id}
              className="card px-3 py-3 flex flex-col gap-2"
              style={hasOwn ? { borderColor: "var(--color-accent)" } : undefined}
            >
              <div className="flex items-center gap-[10px]">
                <span className="w-[80px] flex-none font-semibold text-sm">{space.name}</span>
                <div
                  className="relative flex-1 rounded-[var(--radius-control)] overflow-hidden"
                  style={{ height: "28px", background: "var(--color-surface-2)" }}
                >
                  {spaceBookings.map((b) => {
                    if (!b.starts_at || !b.ends_at) return null;
                    const left = toTimeline(b.starts_at);
                    const right = toTimeline(b.ends_at);
                    const width = Math.max(1, right - left);
                    const blockColor = b.isOwn
                      ? "#2F5E9E"
                      : b.status === "requested"
                      ? "var(--color-gold)"
                      : "var(--color-accent)";

                    return (
                      <button
                        key={b.id}
                        type="button"
                        className="absolute top-0 bottom-0 rounded-[var(--radius-control)]"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: blockColor,
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedId(b.id)}
                        aria-label={`${b.display_owner ?? "—"}${
                          b.use_type ? " · " + (USE_TYPE_LABELS[b.use_type] ?? b.use_type) : ""
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {spaceBookings.length > 0 && (
                <p className="text-[12.5px] pl-[90px]" style={{ color: "#3E4A45" }}>
                  {spaceBookings.map((b, i) => {
                    if (!b.starts_at) return null;
                    const time = new Date(b.starts_at).toLocaleTimeString("es-CO", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "America/Bogota",
                    });
                    return (
                      <span key={b.id}>
                        {i > 0 && " · "}
                        {time}{" "}
                        {b.isOwn ? (
                          <b>tu reserva: {b.display_owner}</b>
                        ) : b.use_type ? (
                          USE_TYPE_LABELS[b.use_type] ?? b.use_type
                        ) : (
                          b.display_owner
                        )}
                      </span>
                    );
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-xs mt-1" style={{ color: "#3E4A45" }}>
        <span className="inline-flex items-center gap-[6px]">
          <span
            className="w-[10px] h-[10px] rounded-full inline-block"
            style={{ background: "var(--color-accent)" }}
          />
          Ministerios
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span
            className="w-[10px] h-[10px] rounded-full inline-block"
            style={{ background: "#2F5E9E" }}
          />
          Tus reservas
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span
            className="w-[10px] h-[10px] rounded-full inline-block"
            style={{ background: "var(--color-gold)" }}
          />
          Por aprobar
        </span>
      </div>

      <Link href="/reservas/nueva" className="btn-primary w-full mt-auto">
        Nueva reserva
      </Link>

      {/* Bottom sheet */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-[65]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          <div
            ref={sheetRef}
            className="glass glass-strong fixed bottom-0 left-0 right-0 z-[70] rounded-t-[var(--radius-sheet)] flex flex-col"
            style={{
              background: "var(--color-surface)",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
              height: sheetH !== null ? `${sheetH}dvh` : "auto",
              maxWidth: 640,
              margin: "0 auto",
            }}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-1 flex-none cursor-row-resize touch-none"
              onTouchStart={onHandleTouchStart}
              onTouchMove={onHandleTouchMove}
              onTouchEnd={onHandleTouchEnd}
            >
              <div className="w-10 h-[5px] rounded-full" style={{ background: "var(--color-line)" }} />
            </div>

            {/* Header */}
            <div
              className="px-5 pb-4 pt-2 flex-none border-b"
              style={{ borderColor: "var(--color-line)" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
                    {selected.space_name}
                  </p>
                  <h2
                    className="font-bold text-lg leading-tight mt-0.5"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {selected.display_owner ?? "—"}
                  </h2>
                  {selected.title && (
                    <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
                      {selected.title}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full flex-none"
                  style={{ background: "var(--color-surface-2)", color: "var(--color-muted)", fontSize: 20 }}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex gap-3">
                  <dt className="w-[80px] flex-none" style={{ color: "var(--color-muted)" }}>Horario</dt>
                  <dd className="font-medium">{formatTime(selected.starts_at)} – {formatTime(selected.ends_at)}</dd>
                </div>
                {selected.use_type && (
                  <div className="flex gap-3">
                    <dt className="w-[80px] flex-none" style={{ color: "var(--color-muted)" }}>Tipo</dt>
                    <dd>{USE_TYPE_LABELS[selected.use_type] ?? selected.use_type}</dd>
                  </div>
                )}
                <div className="flex gap-3">
                  <dt className="w-[80px] flex-none" style={{ color: "var(--color-muted)" }}>Estado</dt>
                  <dd>
                    <span
                      className="font-semibold text-xs px-2 py-0.5 rounded-full"
                      style={
                        selected.status === "approved"
                          ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
                          : { background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }
                      }
                    >
                      {STATUS_LABELS[selected.status] ?? selected.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Button — always visible at bottom */}
            <div
              className="flex-none px-5 pt-3 border-t"
              style={{
                borderColor: "var(--color-line)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
              }}
            >
              <Link
                href={`/reservas/${selected.id}`}
                className="btn-primary w-full text-center block"
                onClick={() => setSelectedId(null)}
              >
                Ver detalle completo
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
