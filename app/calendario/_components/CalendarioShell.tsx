"use client";

import { useState, useMemo } from "react";
import type { AsanaEvent } from "@/lib/asana";
import type { LinkInfo, BookingOption } from "../page";
import { EventPanel } from "./EventPanel";

// ── Types ────────────────────────────────────────────────────────────────────
type View = "lista" | "mes" | "semana" | "dia";

// ── Color palette por categoría ───────────────────────────────────────────
const PALETTE = [
  { bg: "var(--color-accent-soft)", color: "var(--color-accent)" },
  { bg: "rgba(47,94,158,0.12)", color: "#2F7EE8" },
  { bg: "rgba(124,58,237,0.1)", color: "#8B5CF6" },
  { bg: "rgba(180,83,9,0.1)", color: "#D97706" },
  { bg: "rgba(220,38,38,0.1)", color: "#EF4444" },
  { bg: "rgba(8,145,178,0.1)", color: "#06B6D4" },
  { bg: "rgba(190,24,93,0.1)", color: "#EC4899" },
];

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

function categoryStyle(cat: string | null) {
  if (!cat) return PALETTE[0];
  return PALETTE[hashStr(cat) % PALETTE.length];
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function eventsForDate(events: AsanaEvent[], dateStr: string): AsanaEvent[] {
  return events.filter((e) => e.due_on === dateStr);
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  const padBefore = startDow - 1;

  const cells: { date: Date; current: boolean }[] = [];
  for (let i = padBefore - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), current: true });
  }
  while (cells.length % 7 !== 0) {
    const n = cells.length - daysInMonth - padBefore + 1;
    cells.push({ date: new Date(year, month + 1, n), current: false });
  }
  return cells;
}

function getWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAY_NAMES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

// ── Sub-components ───────────────────────────────────────────────────────────

function EventPill({
  event,
  small,
  hasLink,
  onClick,
}: {
  event: AsanaEvent;
  small?: boolean;
  hasLink?: boolean;
  onClick: (e: AsanaEvent) => void;
}) {
  const { bg, color } = categoryStyle(event.category);
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      style={{
        background: bg,
        color,
        fontSize: small ? 10 : 12,
        fontWeight: 600,
        padding: small ? "1px 5px" : "3px 8px",
        borderRadius: 5,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "flex",
        alignItems: "center",
        gap: 3,
        maxWidth: "100%",
        textAlign: "left",
        cursor: "pointer",
        border: "none",
      }}
      title={event.name}
    >
      {hasLink && <span style={{ fontSize: small ? 8 : 10 }}>📍</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {event.name}
      </span>
    </button>
  );
}

function EventCard({
  event,
  hasLink,
  onClick,
}: {
  event: AsanaEvent;
  hasLink?: boolean;
  onClick: (e: AsanaEvent) => void;
}) {
  const { bg, color } = categoryStyle(event.category);
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="rounded-[10px] px-4 py-3 flex flex-col gap-1 w-full text-left"
      style={{ background: bg, border: `1px solid ${color}22`, cursor: "pointer" }}
    >
      <div className="flex items-center justify-between gap-2">
        {event.category && (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color }}>
            {event.category}
          </span>
        )}
        {hasLink && <span className="text-xs">📍</span>}
      </div>
      <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
        {event.name}
      </p>
      {event.notes && (
        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-muted)" }}>
          {event.notes}
        </p>
      )}
    </button>
  );
}

// ── Vista: Lista ─────────────────────────────────────────────────────────────
function ListaView({
  events,
  linksByGid,
  onEventClick,
}: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const today = todayStr();
  const currentMonthKey = today.slice(0, 7);

  const [showPast, setShowPast] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (key: string) =>
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const grouped = useMemo(() => {
    const map = new Map<string, AsanaEvent[]>();
    for (const e of events) {
      const key = e.due_on.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (events.length === 0) {
    return (
      <p className="text-center py-12 text-sm" style={{ color: "var(--color-muted)" }}>
        Sin eventos en el calendario
      </p>
    );
  }

  const pastGroups = grouped.filter(([key]) => key < currentMonthKey);
  const currentAndFuture = grouped.filter(([key]) => key >= currentMonthKey);

  function renderMonth([monthKey, monthEvents]: [string, AsanaEvent[]]) {
    const [y, m] = monthKey.split("-").map(Number);
    const collapsed = collapsedMonths.has(monthKey);
    const isPastMonth = monthKey < currentMonthKey;

    const byDay = new Map<string, AsanaEvent[]>();
    for (const e of monthEvents) {
      if (!byDay.has(e.due_on)) byDay.set(e.due_on, []);
      byDay.get(e.due_on)!.push(e);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

    return (
      <div key={monthKey}>
        {/* Month header — clicable para plegar */}
        <button
          type="button"
          onClick={() => toggleMonth(monthKey)}
          className="flex items-center gap-2 w-full mb-3"
        >
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: isPastMonth ? "var(--color-faint)" : "var(--color-muted)" }}
          >
            {MONTH_NAMES[m - 1]} {y}
          </span>
          <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>
            {collapsed ? "▶" : "▼"}
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-[1px] rounded-full"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
          >
            {monthEvents.length}
          </span>
        </button>

        {!collapsed && (
          <div className="flex flex-col gap-2">
            {days.map(([dateStr, dayEvents]) => {
              const d = new Date(dateStr + "T12:00:00");
              const isDayPast = dateStr < today;
              const isToday = dateStr === today;
              return (
                <div key={dateStr} style={{ opacity: isDayPast ? 0.5 : 1 }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-none"
                      style={
                        isToday
                          ? { background: "var(--color-accent)", color: "var(--color-accent-ink)" }
                          : { background: "var(--color-surface-2)", color: "var(--color-muted)" }
                      }
                    >
                      {d.getDate()}
                    </div>
                    <span className="text-xs capitalize" style={{ color: "var(--color-muted)" }}>
                      {DAY_NAMES[d.getDay()]}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 pl-9">
                    {dayEvents.map((e) => (
                      <EventCard key={e.gid} event={e} hasLink={!!linksByGid[e.gid]} onClick={onEventClick} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Meses anteriores */}
      {pastGroups.length > 0 && (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            <span
              className="w-5 h-5 flex items-center justify-center rounded-full text-[10px]"
              style={{ background: "var(--color-surface-2)" }}
            >
              {showPast ? "▲" : "▼"}
            </span>
            {showPast ? "Ocultar meses anteriores" : `Ver meses anteriores (${pastGroups.length})`}
          </button>
          {showPast && (
            <div className="flex flex-col gap-5 pl-2 border-l-2" style={{ borderColor: "var(--color-line)" }}>
              {pastGroups.map(renderMonth)}
            </div>
          )}
        </div>
      )}

      {/* Mes actual y futuros */}
      {currentAndFuture.map(renderMonth)}
    </div>
  );
}

// ── Vista: Mes ───────────────────────────────────────────────────────────────
function MesView({
  events, linksByGid, anchor, setAnchor, setView, onEventClick,
}: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  setAnchor: (d: Date) => void;
  setView: (v: View) => void;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const today = todayStr();
  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-center text-[11px] font-semibold py-1" style={{ color: "var(--color-muted)" }}>
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ borderTop: "1px solid var(--color-line)", borderLeft: "1px solid var(--color-line)" }}>
        {cells.map(({ date, current }, idx) => {
          const ds = toDateStr(date);
          const dayEvents = eventsForDate(events, ds);
          const isToday = ds === today;

          return (
            <div
              key={idx}
              style={{
                minHeight: 72,
                padding: "4px 4px 6px",
                borderRight: "1px solid var(--color-line)",
                borderBottom: "1px solid var(--color-line)",
              }}
            >
              <div
                className="flex justify-center mb-1 cursor-pointer"
                onClick={() => { setAnchor(date); setView("dia"); }}
              >
                <span
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-semibold"
                  style={
                    isToday
                      ? { background: "var(--color-accent)", color: "var(--color-accent-ink)" }
                      : { color: current ? "var(--color-ink)" : "var(--color-faint)" }
                  }
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-[2px]">
                {dayEvents.slice(0, 3).map((e) => (
                  <EventPill key={e.gid} event={e} small hasLink={!!linksByGid[e.gid]} onClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] pl-1" style={{ color: "var(--color-muted)" }}>
                    +{dayEvents.length - 3} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista: Semana ────────────────────────────────────────────────────────────
function SemanaView({
  events, linksByGid, anchor, setAnchor, setView, onEventClick,
}: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  setAnchor: (d: Date) => void;
  setView: (v: View) => void;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const today = todayStr();

  return (
    <div className="grid grid-cols-7 gap-0" style={{ borderTop: "1px solid var(--color-line)", borderLeft: "1px solid var(--color-line)" }}>
      {weekDays.map((date, i) => {
        const ds = toDateStr(date);
        const dayEvents = eventsForDate(events, ds);
        const isToday = ds === today;

        return (
          <div
            key={i}
            style={{
              borderRight: "1px solid var(--color-line)",
              borderBottom: "1px solid var(--color-line)",
              minHeight: 120,
              padding: "6px 4px",
              background: isToday ? "var(--color-accent-soft)" : "transparent",
            }}
          >
            <div
              className="text-center mb-2 cursor-pointer"
              onClick={() => { setAnchor(date); setView("dia"); }}
            >
              <div className="text-[10px] font-semibold uppercase" style={{ color: "var(--color-muted)" }}>
                {DAY_LABELS[i]}
              </div>
              <div
                className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mx-auto"
                style={
                  isToday
                    ? { background: "var(--color-accent)", color: "var(--color-accent-ink)" }
                    : { color: "var(--color-ink)" }
                }
              >
                {date.getDate()}
              </div>
            </div>
            <div className="flex flex-col gap-[3px]">
              {dayEvents.map((e) => (
                <EventPill key={e.gid} event={e} small hasLink={!!linksByGid[e.gid]} onClick={onEventClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Vista: Día ───────────────────────────────────────────────────────────────
function DiaView({
  events, linksByGid, anchor, onEventClick,
}: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const ds = toDateStr(anchor);
  const dayEvents = eventsForDate(events, ds);

  return (
    <div>
      <p className="text-sm mb-4 capitalize" style={{ color: "var(--color-muted)" }}>
        {DAY_NAMES[anchor.getDay()]}, {anchor.getDate()} de {MONTH_NAMES[anchor.getMonth()].toLowerCase()} de {anchor.getFullYear()}
      </p>
      {dayEvents.length === 0 ? (
        <div
          className="rounded-[12px] px-4 py-8 text-center text-sm"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
        >
          Sin reuniones este día
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dayEvents.map((e) => (
            <EventCard key={e.gid} event={e} hasLink={!!linksByGid[e.gid]} onClick={onEventClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main shell ───────────────────────────────────────────────────────────────
export function CalendarioShell({
  events,
  linksByGid,
  bookingOptions,
  canLink,
  linkAction,
  unlinkAction,
}: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  bookingOptions: BookingOption[];
  canLink: boolean;
  linkAction: (fd: FormData) => Promise<void>;
  unlinkAction: (fd: FormData) => Promise<void>;
}) {
  const [view, setView] = useState<View>("mes");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<AsanaEvent | null>(null);

  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  function prev() {
    const d = new Date(anchor);
    if (view === "mes") d.setMonth(month - 1);
    else if (view === "semana") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setAnchor(d);
  }

  function next() {
    const d = new Date(anchor);
    if (view === "mes") d.setMonth(month + 1);
    else if (view === "semana") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setAnchor(d);
  }

  function periodLabel() {
    if (view === "mes") return `${MONTH_NAMES[month]} ${year}`;
    if (view === "semana") {
      const days = getWeekDays(anchor);
      const first = days[0];
      const last = days[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()].toLowerCase()}`;
      }
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()].slice(0, 3).toLowerCase()} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()].slice(0, 3).toLowerCase()}`;
    }
    if (view === "dia") {
      return `${anchor.getDate()} ${MONTH_NAMES[month].toLowerCase()} ${year}`;
    }
    return "Todas las reuniones";
  }

  const VIEWS: { key: View; label: string }[] = [
    { key: "lista", label: "Lista" },
    { key: "mes", label: "Mes" },
    { key: "semana", label: "Semana" },
    { key: "dia", label: "Día" },
  ];

  const selectedLink = selectedEvent ? (linksByGid[selectedEvent.gid] ?? null) : null;

  return (
    <div className="px-4 pt-6 pb-10 max-w-3xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <span className="eyebrow">Portal RSG</span>
        <h1 className="text-[26px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          Calendario
        </h1>
      </header>

      {/* View toggle */}
      <div className="flex rounded-[10px] p-[3px] gap-[2px]" style={{ background: "var(--color-surface-2)", width: "fit-content" }}>
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="text-sm font-semibold px-3 py-1.5 rounded-[8px] transition"
            style={
              view === key
                ? { background: "var(--color-surface)", color: "var(--color-accent)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                : { color: "var(--color-muted)", background: "transparent" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      {view !== "lista" && (
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg transition"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
            aria-label="Período anterior"
          >
            ‹
          </button>
          <span className="font-semibold text-[15px] flex-1 text-center capitalize" style={{ fontFamily: "var(--font-display)" }}>
            {periodLabel()}
          </span>
          <button
            onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg transition"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
            aria-label="Período siguiente"
          >
            ›
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="text-xs font-semibold px-3 py-1.5 rounded-[8px] transition"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
          >
            Hoy
          </button>
        </div>
      )}

      {/* Content */}
      <div>
        {view === "lista" && (
          <ListaView events={events} linksByGid={linksByGid} onEventClick={setSelectedEvent} />
        )}
        {view === "mes" && (
          <MesView events={events} linksByGid={linksByGid} anchor={anchor} setAnchor={setAnchor} setView={setView} onEventClick={setSelectedEvent} />
        )}
        {view === "semana" && (
          <SemanaView events={events} linksByGid={linksByGid} anchor={anchor} setAnchor={setAnchor} setView={setView} onEventClick={setSelectedEvent} />
        )}
        {view === "dia" && (
          <DiaView events={events} linksByGid={linksByGid} anchor={anchor} onEventClick={setSelectedEvent} />
        )}
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <EventPanel
          event={selectedEvent}
          link={selectedLink}
          bookingOptions={bookingOptions}
          canLink={canLink}
          linkAction={linkAction}
          unlinkAction={unlinkAction}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
