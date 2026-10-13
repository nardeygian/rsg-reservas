"use client";

import { useState, useMemo } from "react";
import type { AsanaEvent } from "@/lib/asana";
import type { LinkInfo, BookingOption } from "../page";
import { EventPanel } from "./EventPanel";

type View = "lista" | "mes" | "semana";

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: "rgba(0,160,112,0.12)",  color: "#00A070" },
  { bg: "rgba(47,126,232,0.12)", color: "#2F7EE8" },
  { bg: "rgba(139,92,246,0.12)", color: "#8B5CF6" },
  { bg: "rgba(217,119,6,0.12)",  color: "#D97706" },
  { bg: "rgba(239,68,68,0.12)",  color: "#EF4444" },
  { bg: "rgba(6,182,212,0.12)",  color: "#06B6D4" },
  { bg: "rgba(236,72,153,0.12)", color: "#EC4899" },
];

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}
function catStyle(cat: string | null) {
  if (!cat) return PALETTE[0];
  return PALETTE[hashStr(cat) % PALETTE.length];
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
function eventsForDate(events: AsanaEvent[], ds: string): AsanaEvent[] {
  return events.filter((e) => e.due_on === ds);
}
function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" })
    .replace(":00", "").replace(" a. m.", "am").replace(" p. m.", "pm");
}
function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const dim = new Date(year, month + 1, 0).getDate();
  let dow = first.getDay();
  if (dow === 0) dow = 7;
  const pad = dow - 1;
  const cells: { date: Date; current: boolean }[] = [];
  for (let i = pad - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= dim; d++) cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length % 7 !== 0) {
    const n = cells.length - dim - pad + 1;
    cells.push({ date: new Date(year, month + 1, n), current: false });
  }
  return cells;
}
function getWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DOW   = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DNAMES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

// ── DayEventList ──────────────────────────────────────────────────────────────
function DayEventList({ events, linksByGid, dateStr, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  dateStr: string;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const today = todayStr();
  const isToday  = dateStr === today;
  const isPast   = dateStr < today;
  const d = new Date(dateStr + "T12:00:00");
  const label = isToday
    ? "Hoy"
    : `${DNAMES[d.getDay()].charAt(0).toUpperCase() + DNAMES[d.getDay()].slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;

  const sorted = [...events].sort((a, b) => {
    const ta = linksByGid[a.gid]?.starts_at ?? "";
    const tb = linksByGid[b.gid]?.starts_at ?? "";
    if (ta && tb) return ta.localeCompare(tb);
    return ta ? -1 : tb ? 1 : 0;
  });

  return (
    <div style={{ opacity: isPast ? 0.72 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0 6px" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: isToday ? "var(--color-accent)" : "var(--color-ink)" }}>
          {label}
        </span>
        {events.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
            {events.length}
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-faint)", textAlign: "center", padding: "14px 0 20px" }}>Sin eventos</p>
      ) : (
        <div>
          {sorted.map((e) => {
            const link = linksByGid[e.gid];
            const { color } = catStyle(e.category);
            return (
              <button
                key={e.gid}
                type="button"
                onClick={() => onEventClick(e)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  width: "100%", textAlign: "left",
                  padding: "11px 4px 11px 12px",
                  borderTop: "1px solid var(--color-line)",
                  borderLeft: `3px solid ${color}`,
                  background: "none", cursor: "pointer", border: "none",
                  borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--color-line)",
                  borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.name}
                  </p>
                  {e.category && (
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color }}>{e.category}</p>
                  )}
                  {link?.space_name && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted)" }}>📍 {link.space_name}</p>
                  )}
                </div>
                {link?.starts_at && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--color-muted)" }}>{fmtTime(link.starts_at)}</p>
                    {link.ends_at && (
                      <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--color-faint)" }}>{fmtTime(link.ends_at)}</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MesView ───────────────────────────────────────────────────────────────────
function MesView({ events, linksByGid, anchor, selDay, setSelDay, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  selDay: string;
  setSelDay: (d: string) => void;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const year  = anchor.getFullYear();
  const month = anchor.getMonth();
  const today = todayStr();
  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);
  const selDayEvents = useMemo(() => eventsForDate(events, selDay), [events, selDay]);

  return (
    <div>
      {/* DOW headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {DOW.map((l) => (
          <div key={l} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", padding: "4px 0 6px" }}>
            {l}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid var(--color-line)", borderLeft: "1px solid var(--color-line)" }}>
        {cells.map(({ date, current }, idx) => {
          const ds      = toDateStr(date);
          const dayEvs  = eventsForDate(events, ds);
          const isToday = ds === today;
          const isSel   = ds === selDay;
          const isPast  = ds < today;

          return (
            <div
              key={idx}
              onClick={() => setSelDay(ds)}
              style={{
                borderRight: "1px solid var(--color-line)",
                borderBottom: "1px solid var(--color-line)",
                minHeight: 64,
                padding: "5px 3px 8px",
                cursor: "pointer",
                background: isSel && !isToday
                  ? "var(--color-accent-soft)"
                  : "transparent",
                transition: "background 0.1s",
              }}
            >
              {/* Number */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>
                <span style={{
                  width: 28, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", fontSize: 13,
                  fontWeight: isToday ? 700 : 500,
                  background: isToday ? "var(--color-accent)" : "transparent",
                  color: isToday
                    ? "var(--color-accent-ink)"
                    : !current ? "var(--color-faint)"
                    : isPast  ? "var(--color-muted)"
                    : "var(--color-ink)",
                }}>
                  {date.getDate()}
                </span>
              </div>

              {/* Event bars */}
              {dayEvs.length > 0 && (
                <div style={{ display: "flex", gap: 2, paddingInline: 3, flexWrap: "wrap" }}>
                  {dayEvs.slice(0, 3).map((e, i) => (
                    <div key={i} style={{ height: 4, borderRadius: 2, flex: 1, minWidth: 5, maxWidth: 20, background: catStyle(e.category).color, opacity: isPast ? 0.4 : 0.75 }} />
                  ))}
                  {dayEvs.length > 3 && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--color-faint)", flexShrink: 0, marginTop: 0 }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day event list */}
      <DayEventList events={selDayEvents} linksByGid={linksByGid} dateStr={selDay} onEventClick={onEventClick} />
    </div>
  );
}

// ── SemanaView ────────────────────────────────────────────────────────────────
function SemanaView({ events, linksByGid, anchor, selDay, setSelDay, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  selDay: string;
  setSelDay: (d: string) => void;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const weekDays     = useMemo(() => getWeekDays(anchor), [anchor]);
  const today        = todayStr();
  const selDayEvents = useMemo(() => eventsForDate(events, selDay), [events, selDay]);

  return (
    <div>
      {/* Day strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--color-line)" }}>
        {weekDays.map((date, i) => {
          const ds       = toDateStr(date);
          const isToday  = ds === today;
          const isSel    = ds === selDay;
          const hasEvs   = eventsForDate(events, ds).length > 0;
          return (
            <button key={i} type="button" onClick={() => setSelDay(ds)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "10px 4px 8px",
                background: "none", cursor: "pointer",
                borderBottom: isSel ? "2px solid var(--color-accent)" : "2px solid transparent",
                borderLeft: "none", borderRight: "none", borderTop: "none",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: isToday ? "var(--color-accent)" : "var(--color-muted)" }}>
                {DOW[i]}
              </span>
              <span style={{
                width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", fontSize: 15, fontWeight: 700,
                background: isToday ? "var(--color-accent)" : "transparent",
                color: isToday ? "var(--color-accent-ink)" : "var(--color-ink)",
              }}>
                {date.getDate()}
              </span>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: hasEvs ? (isToday ? "var(--color-accent)" : "var(--color-muted)") : "transparent" }} />
            </button>
          );
        })}
      </div>

      {/* Mobile: event list for selected day */}
      <div className="sm:hidden">
        <DayEventList events={selDayEvents} linksByGid={linksByGid} dateStr={selDay} onEventClick={onEventClick} />
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid grid-cols-7" style={{ borderLeft: "1px solid var(--color-line)" }}>
        {weekDays.map((date, i) => {
          const ds      = toDateStr(date);
          const dayEvs  = eventsForDate(events, ds);
          const isToday = ds === today;
          const isPast  = ds < today;
          return (
            <div key={i} style={{
              borderRight: "1px solid var(--color-line)",
              borderBottom: "1px solid var(--color-line)",
              minHeight: 180, padding: 6,
              background: isToday ? "var(--color-accent-soft)" : "transparent",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {dayEvs.map((e) => {
                  const link = linksByGid[e.gid];
                  const { color, bg } = catStyle(e.category);
                  return (
                    <button key={e.gid} type="button" onClick={() => onEventClick(e)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        borderRadius: 6, padding: "4px 6px",
                        background: bg, borderLeft: `3px solid ${color}`,
                        cursor: "pointer", border: "none",
                        borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
                        opacity: isPast ? 0.6 : 1,
                      }}
                    >
                      {link?.starts_at && (
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color }}>{fmtTime(link.starts_at)}</p>
                      )}
                      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.name}
                      </p>
                      {link?.space_name && (
                        <p style={{ margin: 0, fontSize: 10, color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          📍 {link.space_name}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ListaView ─────────────────────────────────────────────────────────────────
function ListaView({ events, linksByGid, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const today = todayStr();
  const curMonthKey = today.slice(0, 7);
  const [showPast, setShowPast] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, AsanaEvent[]>();
    for (const e of events) {
      const k = e.due_on.slice(0, 7);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (!events.length)
    return <p style={{ textAlign: "center", padding: "48px 0", fontSize: 14, color: "var(--color-muted)" }}>Sin eventos en el calendario</p>;

  const pastGroups = grouped.filter(([k]) => k < curMonthKey);
  const futureGroups = grouped.filter(([k]) => k >= curMonthKey);

  function renderMonth([mk, evs]: [string, AsanaEvent[]]) {
    const [y, m] = mk.split("-").map(Number);
    const isPast = mk < curMonthKey;
    const isCollapsed = collapsed.has(mk);
    const byDay = new Map<string, AsanaEvent[]>();
    for (const e of evs) {
      if (!byDay.has(e.due_on)) byDay.set(e.due_on, []);
      byDay.get(e.due_on)!.push(e);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

    return (
      <div key={mk}>
        <button type="button" onClick={() => setCollapsed(prev => { const s = new Set(prev); s.has(mk) ? s.delete(mk) : s.add(mk); return s; })}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isPast ? "var(--color-faint)" : "var(--color-muted)" }}>
            {MONTHS[m - 1]} {y}
          </span>
          <span style={{ fontSize: 10, color: "var(--color-faint)" }}>{isCollapsed ? "▶" : "▼"}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: "var(--color-surface-2)", color: "var(--color-muted)" }}>{evs.length}</span>
        </button>

        {!isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 4 }}>
            {days.map(([ds, dayEvs]) => {
              const d = new Date(ds + "T12:00:00");
              const isDayPast = ds < today;
              const isToday   = ds === today;
              return (
                <div key={ds} style={{ opacity: isDayPast ? 0.55 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      background: isToday ? "var(--color-accent)" : "var(--color-surface-2)",
                      color: isToday ? "var(--color-accent-ink)" : "var(--color-muted)",
                    }}>
                      {d.getDate()}
                    </div>
                    <span style={{ fontSize: 12, textTransform: "capitalize", color: "var(--color-muted)" }}>
                      {DNAMES[d.getDay()]}
                    </span>
                  </div>
                  <div style={{ paddingLeft: 36, display: "flex", flexDirection: "column" }}>
                    {dayEvs.map((e) => {
                      const link = linksByGid[e.gid];
                      const { color } = catStyle(e.category);
                      return (
                        <button key={e.gid} type="button" onClick={() => onEventClick(e)}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 12,
                            width: "100%", textAlign: "left", padding: "9px 4px 9px 10px",
                            borderTop: "1px solid var(--color-line)",
                            borderLeft: `3px solid ${color}`,
                            background: "none", cursor: "pointer",
                            border: "none",
                            borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--color-line)",
                            borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {e.category && <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color }}>{e.category}</p>}
                            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</p>
                            {link?.space_name && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted)" }}>📍 {link.space_name}</p>}
                          </div>
                          {link?.starts_at && (
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, color: "var(--color-muted)" }}>{fmtTime(link.starts_at)}</p>
                              {link.ends_at && <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--color-faint)" }}>{fmtTime(link.ends_at)}</p>}
                            </div>
                          )}
                        </button>
                      );
                    })}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
      {pastGroups.length > 0 && (
        <>
          <button type="button" onClick={() => setShowPast(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--color-surface-2)", fontSize: 10 }}>
              {showPast ? "▲" : "▼"}
            </span>
            {showPast ? "Ocultar meses anteriores" : `Ver meses anteriores (${pastGroups.length})`}
          </button>
          {showPast && (
            <div style={{ paddingLeft: 12, borderLeft: "2px solid var(--color-line)", display: "flex", flexDirection: "column", gap: 20 }}>
              {pastGroups.map(renderMonth)}
            </div>
          )}
        </>
      )}
      {futureGroups.map(renderMonth)}
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export function CalendarioShell({
  events, linksByGid, bookingOptions, canLink, linkAction, unlinkAction,
}: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  bookingOptions: BookingOption[];
  canLink: boolean;
  linkAction: (fd: FormData) => Promise<void>;
  unlinkAction: (fd: FormData) => Promise<void>;
}) {
  const [view,          setView]          = useState<View>("mes");
  const [anchor,        setAnchor]        = useState(() => new Date());
  const [selDay,        setSelDay]        = useState(() => todayStr());
  const [selectedEvent, setSelectedEvent] = useState<AsanaEvent | null>(null);

  const year  = anchor.getFullYear();
  const month = anchor.getMonth();

  function prev() {
    const d = new Date(anchor);
    if (view === "mes") {
      d.setMonth(month - 1);
      setSelDay(toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)));
    } else {
      d.setDate(d.getDate() - 7);
      setSelDay(toDateStr(d));
    }
    setAnchor(d);
  }

  function next() {
    const d = new Date(anchor);
    if (view === "mes") {
      d.setMonth(month + 1);
      setSelDay(toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)));
    } else {
      d.setDate(d.getDate() + 7);
      setSelDay(toDateStr(d));
    }
    setAnchor(d);
  }

  function goToday() {
    setAnchor(new Date());
    setSelDay(todayStr());
  }

  function periodLabel() {
    if (view === "mes") return `${MONTHS[month]} ${year}`;
    const days = getWeekDays(anchor);
    const f = days[0]; const l = days[6];
    if (f.getMonth() === l.getMonth())
      return `${f.getDate()}–${l.getDate()} de ${MONTHS[f.getMonth()].toLowerCase()} ${year}`;
    return `${f.getDate()} ${MONTHS[f.getMonth()].slice(0, 3).toLowerCase()} – ${l.getDate()} ${MONTHS[l.getMonth()].slice(0, 3).toLowerCase()} ${year}`;
  }

  const VIEWS: { key: View; label: string }[] = [
    { key: "lista",   label: "Lista"   },
    { key: "mes",     label: "Mes"     },
    { key: "semana",  label: "Semana"  },
  ];

  const selectedLink = selectedEvent ? (linksByGid[selectedEvent.gid] ?? null) : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px clamp(12px, 3vw, 40px) 80px" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px 24px", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Portal RSG</span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
            Calendario
          </h1>
        </div>
        {/* View toggle */}
        <div style={{ display: "flex", borderRadius: 10, padding: 3, gap: 2, background: "var(--color-surface-2)" }}>
          {VIEWS.map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)} style={{
              fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
              border: "none", cursor: "pointer",
              background: view === key ? "var(--color-surface)" : "transparent",
              color:      view === key ? "var(--color-accent)"  : "var(--color-muted)",
              boxShadow:  view === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Period nav */}
      {view !== "lista" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={prev} aria-label="Anterior" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--color-surface-2)", color: "var(--color-ink)", border: "none", cursor: "pointer", fontSize: 18 }}>‹</button>
          <span style={{ flex: 1, fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--color-ink)", textTransform: "capitalize" }}>
            {periodLabel()}
          </span>
          <button onClick={goToday} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: "var(--color-accent-soft)", color: "var(--color-accent)", border: "none", cursor: "pointer" }}>
            Hoy
          </button>
          <button onClick={next} aria-label="Siguiente" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--color-surface-2)", color: "var(--color-ink)", border: "none", cursor: "pointer", fontSize: 18 }}>›</button>
        </div>
      )}

      {/* Views */}
      {view === "lista"  && <ListaView  events={events} linksByGid={linksByGid} onEventClick={setSelectedEvent} />}
      {view === "mes"    && <MesView    events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={setSelectedEvent} />}
      {view === "semana" && <SemanaView events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={setSelectedEvent} />}

      {/* Event panel */}
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
