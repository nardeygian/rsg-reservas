"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookingBlock } from "./ReservasDayView";
import { formatTime } from "@/lib/datetime";

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio:   "Reunión de ministerio",
  consejeria:           "Consejería",
  discipulado:          "Discipulado",
  evento:               "Evento",
  externo:              "Externo",
  studio_negocio:       "Studio (negocio)",
  otro:                 "Otro",
};

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function formatSelDay(ds: string): string {
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Bogota",
  });
}

export function ReservasMesView({
  gridDayKeys,
  bookingsByDay,
  anchorMonthKey,
  prevMonthParam,
  nextMonthParam,
  anchorParam,
  monthLabel,
}: {
  gridDayKeys: string[];
  bookingsByDay: Record<string, BookingBlock[]>;
  anchorMonthKey: string;
  prevMonthParam: string;
  nextMonthParam: string;
  anchorParam: string;
  monthLabel: string;
}) {
  const today = todayKey();
  const defaultSel = today.slice(0, 7) === anchorMonthKey ? today : (gridDayKeys.find(k => k.slice(0, 7) === anchorMonthKey) ?? gridDayKeys[0] ?? "");
  const [selDay, setSelDay] = useState(defaultSel);
  const selBookings = [...(bookingsByDay[selDay] ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <>
      {/* View toggle */}
      <div className="flex rounded-[10px] p-[4px] gap-1" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
        <Link href={`/reservas?date=${anchorParam}`} className="flex-1 text-center text-sm py-1.5 rounded-[7px]" style={{ color: "var(--color-muted)" }}>
          Día
        </Link>
        <span className="flex-1 text-center text-sm py-1.5 rounded-[7px] font-semibold" style={{ background: "var(--color-accent)", color: "#fff" }}>
          Mes
        </span>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-[10px] p-[6px]" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
        <Link href={`/reservas?date=${prevMonthParam}&view=mes`} className="w-10 h-10 inline-flex items-center justify-center rounded-[8px] border text-lg" style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }} aria-label="Mes anterior">
          ‹
        </Link>
        <span className="font-semibold text-[15px] capitalize" style={{ fontFamily: "var(--font-display)" }}>
          {monthLabel}
        </span>
        <Link href={`/reservas?date=${nextMonthParam}&view=mes`} className="w-10 h-10 inline-flex items-center justify-center rounded-[8px] border text-lg" style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }} aria-label="Mes siguiente">
          ›
        </Link>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 text-center">
        {DAY_HEADERS.map(d => (
          <span key={d} className="text-[11px] font-semibold py-1" style={{ color: "var(--color-muted)" }}>{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {gridDayKeys.map(key => {
          const inMonth = key.slice(0, 7) === anchorMonthKey;
          const dayBks  = bookingsByDay[key];
          const isToday = key === today;
          const isSel   = key === selDay;
          const approved = dayBks?.filter(b => b.status === "approved").length ?? 0;
          const pending  = dayBks?.filter(b => b.status === "requested").length ?? 0;

          return (
            <button key={key} type="button" onClick={() => setSelDay(key)}
              className="flex flex-col items-center py-1.5 gap-[3px] rounded-[8px]"
              style={
                isToday ? { background: "var(--color-accent)", color: "#fff" }
                : isSel  ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
                : inMonth ? { color: "var(--color-ink)" }
                : { color: "var(--color-faint)" }
              }
            >
              <span className="text-sm font-semibold leading-none">
                {new Date(key + "T12:00:00").getDate()}
              </span>
              {(approved > 0 || pending > 0) && (
                <div className="flex gap-[3px]">
                  {approved > 0 && (
                    <span className="w-[5px] h-[5px] rounded-full block"
                      style={{ background: isToday ? "rgba(255,255,255,0.75)" : "var(--color-accent)" }} />
                  )}
                  {pending > 0 && (
                    <span className="w-[5px] h-[5px] rounded-full block"
                      style={{ background: isToday ? "rgba(255,255,255,0.75)" : "var(--color-gold)" }} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day list */}
      <div style={{ borderTop: "1px solid var(--color-line)", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 6px" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", textTransform: "capitalize" }}>
            {selDay ? formatSelDay(selDay) : ""}
          </span>
          {selBookings.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              {selBookings.length}
            </span>
          )}
        </div>
        {selBookings.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-faint)", textAlign: "center", padding: "12px 0 16px" }}>Sin reservas</p>
        ) : (
          <div>
            {selBookings.map(b => {
              const barColor = b.isOwn ? "#2F5E9E" : b.status === "requested" ? "var(--color-gold)" : "var(--color-accent)";
              return (
                <Link key={b.id} href={`/reservas/${b.id}`} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, textDecoration: "none",
                  padding: "10px 4px 10px 12px",
                  borderTop: "1px solid var(--color-line)", borderRight: "none", borderBottom: "none",
                  borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: barColor,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.display_owner ?? b.title ?? "—"}
                    </p>
                    {b.use_type && (
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted)" }}>
                        {USE_TYPE_LABELS[b.use_type] ?? b.use_type}
                      </p>
                    )}
                    <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--color-muted)" }}>📍 {b.space_name}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--color-muted)" }}>{formatTime(b.starts_at)}</p>
                    {b.ends_at && <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--color-faint)" }}>{formatTime(b.ends_at)}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-xs mt-1" style={{ color: "#3E4A45" }}>
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[10px] h-[10px] rounded-[3px] inline-block" style={{ background: "var(--color-accent)" }} />
          Aprobadas
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[10px] h-[10px] rounded-[3px] inline-block" style={{ background: "var(--color-gold)" }} />
          Por aprobar
        </span>
      </div>

      <Link href="/reservas/nueva" className="btn-primary w-full mt-auto">
        Nueva reserva
      </Link>
    </>
  );
}
