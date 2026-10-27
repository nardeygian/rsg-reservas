"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/app/_components/ui/Icon";
import type { BookingBlock } from "./ReservasDayView";
import { MonthGrid, type MonthCell, type MonthItem } from "@/app/_components/ui/MonthGrid";
import { formatTime } from "@/lib/datetime";

// Mismo lenguaje visual que el Calendario de eventos (estilo Apple):
// año en acento + mes grande, cuadrícula con líneas finas y puntos, y la
// lista del día elegido en una tarjeta de vidrio.

const DOW_LETTER = ["L", "M", "M", "J", "V", "S", "D"]; // la cuadrícula empieza en lunes
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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

// Colores de estado (los mismos de la leyenda y de la vista de día)
const COLOR_OWN      = "var(--color-info)";
const COLOR_PENDING  = "var(--color-gold)";
const COLOR_APPROVED = "var(--color-accent)";

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function formatSelDay(ds: string, isToday: boolean): string {
  const d = new Date(ds + "T12:00:00");
  if (isToday) return `Hoy · ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
  const label = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const bookingColor = (b: BookingBlock) =>
  b.isOwn ? COLOR_OWN : b.status === "requested" ? COLOR_PENDING : COLOR_APPROVED;

export function ReservasMesView({
  gridDayKeys,
  bookingsByDay,
  anchorMonthKey,
  prevMonthParam,
  nextMonthParam,
  anchorParam,
}: {
  gridDayKeys: string[];
  bookingsByDay: Record<string, BookingBlock[]>;
  anchorMonthKey: string;
  prevMonthParam: string;
  nextMonthParam: string;
  anchorParam: string;
  monthLabel?: string;
}) {
  const today = todayKey();
  const defaultSel = today.slice(0, 7) === anchorMonthKey ? today : (gridDayKeys.find(k => k.slice(0, 7) === anchorMonthKey) ?? gridDayKeys[0] ?? "");
  const [selDay, setSelDay] = useState(defaultSel);
  const selBookings = [...(bookingsByDay[selDay] ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const [yearStr, monthStr] = anchorMonthKey.split("-");
  const monthName = MONTHS[Number(monthStr) - 1] ?? "";
  const isCurrentMonth = today.slice(0, 7) === anchorMonthKey;

  return (
    <>
      {/* Encabezado: año en acento, mes grande, flechas y Hoy */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tabular" style={{ color: "var(--color-accent)" }}>{yearStr}</span>
          <h1 className="text-[34px] md:text-[38px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--color-ink)" }}>{monthName}</h1>
        </div>
        <div className="flex items-center gap-1.5 pb-0.5">
          <nav className="segmented hidden md:inline-flex mr-2" aria-label="Vista">
            <Link href={`/reservas?date=${anchorParam}`} prefetch className="segmented-link">Día</Link>
            <Link href={`/reservas?date=${anchorParam}&view=mes`} aria-current="page" className="segmented-link">Mes</Link>
          </nav>
          <Link href={`/reservas?date=${prevMonthParam}&view=mes`} prefetch className="icon-btn" aria-label="Mes anterior">
            <Icon name="chevron-left" />
          </Link>
          {!isCurrentMonth && (
            <Link href="/reservas?view=mes" prefetch className="h-9 px-3.5 rounded-full text-[14px] font-semibold inline-flex items-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-accent)", boxShadow: "inset 0 1px 0 var(--glass-border)" }}>
              Hoy
            </Link>
          )}
          <Link href={`/reservas?date=${nextMonthParam}&view=mes`} prefetch className="icon-btn" aria-label="Mes siguiente">
            <Icon name="chevron-right" />
          </Link>
          <Link href="/reservas/nueva" prefetch className="btn-primary hidden md:inline-flex ml-2 !min-h-[38px] !px-4 !text-[14px] rounded-full">
            <Icon name="plus" size={16} strokeWidth={2.2} />
            Nueva reserva
          </Link>
        </div>
      </div>

      {/* Día | Mes (en escritorio va en el encabezado) */}
      <nav className="segmented w-full md:hidden" aria-label="Vista">
        <Link href={`/reservas?date=${anchorParam}`} prefetch className="segmented-link flex-1 text-center">Día</Link>
        <Link href={`/reservas?date=${anchorParam}&view=mes`} aria-current="page" className="segmented-link flex-1 text-center">Mes</Link>
      </nav>

      {/* Escritorio: misma cuadrícula que el Calendario de eventos */}
      <div className="hidden md:block">
        <MonthGrid
          weekdays={["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]}
          cells={gridDayKeys.map((key, i): MonthCell => ({
            key, day: Number(key.slice(8)), inMonth: key.slice(0, 7) === anchorMonthKey, weekend: i % 7 >= 5,
          }))}
          itemsByDay={Object.fromEntries(gridDayKeys.map((key) => [key,
            [...(bookingsByDay[key] ?? [])]
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              .map((b): MonthItem => ({
                id: b.id,
                title: [b.space_name, b.display_owner ?? b.title].filter(Boolean).join(" · ") || "Reserva",
                time: formatTime(b.starts_at),
                color: bookingColor(b),
                href: `/reservas/${b.id}`,
                dim: key < today,
              })),
          ]))}
          today={today}
          selected={selDay}
          onSelect={setSelDay}
        />
      </div>

      {/* Celular: letras de los días + cuadrícula */}
      <div className="md:hidden">
        <div className="grid grid-cols-7">
          {DOW_LETTER.map((l, i) => (
            <span key={i} className="text-center text-[12px] font-semibold pb-1.5" style={{ color: "var(--color-faint)" }}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDayKeys.map(key => {
            const inMonth = key.slice(0, 7) === anchorMonthKey;
            const dayBks  = bookingsByDay[key] ?? [];
            const isToday = key === today;
            const isSel   = key === selDay;
            const isPast  = key < today;
            const dots = [
              dayBks.some(b => b.isOwn) && COLOR_OWN,
              dayBks.some(b => !b.isOwn && b.status === "approved") && COLOR_APPROVED,
              dayBks.some(b => !b.isOwn && b.status === "requested") && COLOR_PENDING,
            ].filter(Boolean) as string[];

            return (
              <button key={key} type="button" onClick={() => setSelDay(key)}
                aria-pressed={isSel}
                aria-label={`${Number(key.slice(8))}${dayBks.length ? `, ${dayBks.length} reservas` : ""}`}
                className="flex flex-col items-center gap-[3px] pt-1.5 pb-2"
                style={{ borderTop: "1px solid var(--color-line)" }}
              >
                <span className="tabular" style={{
                  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", fontSize: 19, fontWeight: isToday || isSel ? 600 : 400,
                  transition: "background 0.15s ease, color 0.15s ease",
                  // Como en Apple: hoy en color de acento; el día elegido con círculo lleno.
                  background: isSel ? (isToday ? "var(--color-accent)" : "var(--color-ink)") : "transparent",
                  color: isSel
                    ? (isToday ? "var(--color-accent-ink)" : "var(--color-bg)")
                    : isToday ? "var(--color-accent)"
                    : !inMonth ? "var(--color-faint)" : "var(--color-ink)",
                }}>
                  {Number(key.slice(8))}
                </span>
                <span className="flex gap-[3px] h-[6px]">
                  {dots.map((c, i) => (
                    <span key={i} className="w-[6px] h-[6px] rounded-full" style={{ background: c, opacity: isPast || !inMonth ? 0.45 : 1 }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reservas del día elegido */}
      <div className="flex flex-col gap-2">
        <span className="px-1 text-[13px] font-semibold" style={{ color: selDay === today ? "var(--color-accent)" : "var(--color-muted)" }}>
          {selDay ? formatSelDay(selDay, selDay === today) : ""}
        </span>
        <div className="card overflow-hidden divide-y">
          {selBookings.length === 0 ? (
            <p className="text-[15px] text-center py-6" style={{ color: "var(--color-faint)" }}>No hay reservas</p>
          ) : selBookings.map(b => (
            <Link key={b.id} href={`/reservas/${b.id}`} prefetch className="flex items-stretch gap-3 px-4 py-3 active:opacity-70 transition-opacity" style={{ textDecoration: "none" }}>
              <span className="w-[4px] rounded-full flex-none" style={{ background: bookingColor(b) }} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>{b.display_owner ?? b.title ?? "Reserva"}</span>
                <span className="text-[13px] flex items-center gap-1 min-w-0" style={{ color: "var(--color-muted)" }}>
                  <Icon name="map-pin" size={12} />
                  <span className="truncate">{[b.space_name, b.use_type ? (USE_TYPE_LABELS[b.use_type] ?? b.use_type) : null].filter(Boolean).join(" · ")}</span>
                </span>
              </span>
              <span className="flex flex-col items-end flex-none text-[13px] tabular" style={{ color: "var(--color-muted)" }}>
                <span className="font-medium" style={{ color: "var(--color-ink)" }}>{formatTime(b.starts_at)}</span>
                {b.ends_at && <span>{formatTime(b.ends_at)}</span>}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 flex-wrap text-[12px] px-1" style={{ color: "var(--color-muted)" }}>
        {[["Aprobadas", COLOR_APPROVED], ["Por aprobar", COLOR_PENDING], ["Tus reservas", COLOR_OWN]].map(([label, c]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="w-[8px] h-[8px] rounded-full" style={{ background: c }} />
            {label}
          </span>
        ))}
      </div>

      <Link href="/reservas/nueva" prefetch className="btn-primary w-full mt-auto md:hidden">
        <Icon name="plus" size={18} strokeWidth={2.2} />
        Nueva reserva
      </Link>
    </>
  );
}
