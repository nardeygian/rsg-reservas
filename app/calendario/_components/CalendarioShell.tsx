"use client";

import { useState, useMemo } from "react";
import type { AsanaEvent } from "@/lib/asana";
import type { LinkInfo, BookingOption } from "../page";
import { EventPanel } from "./EventPanel";

type View = "lista" | "dia" | "semana" | "mes";

const HOUR_PX = 60;
const START_H = 7;
const END_H   = 23;
const HOURS   = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

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
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff; return h;
}
function catStyle(cat: string | null) {
  return PALETTE[!cat ? 0 : hashStr(cat) % PALETTE.length];
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
function eventsForDate(events: AsanaEvent[], ds: string): AsanaEvent[] {
  return events.filter(e => e.due_on === ds);
}
function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" })
    .replace(":00","").replace(" a. m.","am").replace(" p. m.","pm");
}
function toBogoHM(iso: string): { h: number; m: number } {
  const s = new Date(iso).toLocaleTimeString("en-CA", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota",
  });
  const [h, m] = s.split(":").map(Number);
  return { h, m };
}
function hLabel(h: number): string {
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}
function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const dim   = new Date(year, month + 1, 0).getDate();
  const pad   = first.getDay(); // 0=Sun
  const cells: { date: Date; current: boolean }[] = [];
  for (let i = pad - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= dim; d++) cells.push({ date: new Date(year, month, d), current: true });
  let n = 1;
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, n++), current: false });
  return cells;
}
function getWeekDays(anchor: Date): Date[] {
  const s = new Date(anchor);
  s.setDate(anchor.getDate() - anchor.getDay()); // back to Sunday
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
}

const DOW_SUN = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const MONTHS  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DNAMES  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

// ── DayEventList ─────────────────────────────────────────────────────────────
function DayEventList({ events, linksByGid, dateStr, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  dateStr: string;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const today   = todayStr();
  const isToday = dateStr === today;
  const isPast  = dateStr < today;
  const d       = new Date(dateStr + "T12:00:00");
  const dn      = DNAMES[d.getDay()];
  const label   = isToday ? "Hoy" : `${dn[0].toUpperCase() + dn.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;

  const sorted = [...events].sort((a, b) => {
    const ta = linksByGid[a.gid]?.starts_at ?? "";
    const tb = linksByGid[b.gid]?.starts_at ?? "";
    if (ta && tb) return ta.localeCompare(tb);
    return ta ? -1 : tb ? 1 : 0;
  });

  return (
    <div style={{ opacity: isPast ? 0.72 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0 6px" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: isToday ? "var(--color-accent)" : "var(--color-ink)" }}>{label}</span>
        {events.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
            {events.length}
          </span>
        )}
      </div>
      {events.length === 0
        ? <p style={{ fontSize: 13, color: "var(--color-faint)", textAlign: "center", padding: "14px 0 20px" }}>Sin eventos</p>
        : sorted.map(e => {
            const link = linksByGid[e.gid];
            const { color } = catStyle(e.category);
            return (
              <button key={e.gid} type="button" onClick={() => onEventClick(e)} style={{
                display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
                padding: "11px 4px 11px 12px", background: "none", cursor: "pointer",
                borderTop: "1px solid var(--color-line)", borderRight: "none", borderBottom: "none",
                borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</p>
                  {e.category && <p style={{ margin: "2px 0 0", fontSize: 11.5, color }}>{e.category}</p>}
                  {link?.space_name && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted)" }}>📍 {link.space_name}</p>}
                </div>
                {link?.starts_at && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--color-muted)" }}>{fmtTime(link.starts_at)}</p>
                    {link.ends_at && <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--color-faint)" }}>{fmtTime(link.ends_at)}</p>}
                  </div>
                )}
              </button>
            );
          })
      }
    </div>
  );
}

// ── TimeGrid (shared by Día and Semana desktop) ───────────────────────────────
function TimeGrid({ events, linksByGid, days, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  days: Date[];
  onEventClick: (e: AsanaEvent) => void;
}) {
  const today = todayStr();
  const nCols = days.length;

  const allDayEvs = (ds: string) => eventsForDate(events, ds).filter(e => !linksByGid[e.gid]?.starts_at);
  const timedEvs  = (ds: string) => eventsForDate(events, ds).filter(e => !!linksByGid[e.gid]?.starts_at);
  const hasAnyAllDay = days.some(d => allDayEvs(toDateStr(d)).length > 0);

  return (
    <div>
      {/* All-day row */}
      {hasAnyAllDay && (
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${nCols}, 1fr)`, borderBottom: "1px solid var(--color-line)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 8, paddingBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-faint)" }}>todo el día</span>
          </div>
          {days.map((date, i) => {
            const ds = toDateStr(date);
            return (
              <div key={i} style={{ borderLeft: "1px solid var(--color-line)", padding: "3px 2px", display: "flex", flexDirection: "column", gap: 2 }}>
                {allDayEvs(ds).map(e => {
                  const { color, bg } = catStyle(e.category);
                  return (
                    <button key={e.gid} type="button" onClick={() => onEventClick(e)} style={{
                      display: "block", width: "100%", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontSize: 10.5, fontWeight: 600, color: "var(--color-ink)", background: bg, borderRadius: 4, padding: "2px 5px", cursor: "pointer",
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeftWidth: 2, borderLeftStyle: "solid", borderLeftColor: color,
                    }}>
                      {e.name}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable hour body */}
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${nCols}, 1fr)` }}>
          {/* Time labels */}
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_PX, position: "relative" }}>
                <span style={{ position: "absolute", top: -8, right: 6, fontSize: 9.5, color: "var(--color-faint)", fontWeight: 500, whiteSpace: "nowrap", userSelect: "none" }}>
                  {hLabel(h)}
                </span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((date, ci) => {
            const ds      = toDateStr(date);
            const isToday = ds === today;
            return (
              <div key={ci} style={{
                position: "relative", height: HOURS.length * HOUR_PX,
                borderLeft: "1px solid var(--color-line)",
                background: isToday ? "rgba(0,160,112,0.025)" : "transparent",
              }}>
                {/* Hour lines */}
                {HOURS.map((_, hi) => (
                  <div key={hi} style={{ position: "absolute", left: 0, right: 0, top: hi * HOUR_PX, height: 0, borderTop: "1px solid var(--color-line)", pointerEvents: "none" }} />
                ))}
                {/* Timed events */}
                {timedEvs(ds).map(e => {
                  const link = linksByGid[e.gid]!;
                  const { h: sh, m: sm } = toBogoHM(link.starts_at!);
                  const { h: eh, m: em } = link.ends_at ? toBogoHM(link.ends_at) : { h: sh + 1, m: sm };
                  const top    = (sh - START_H) * HOUR_PX + sm * (HOUR_PX / 60);
                  const height = Math.max(24, (eh - sh) * HOUR_PX + (em - sm) * (HOUR_PX / 60));
                  const { color, bg } = catStyle(e.category);
                  return (
                    <button key={e.gid} type="button" onClick={() => onEventClick(e)} style={{
                      position: "absolute", left: 2, right: 2, top, height,
                      borderRadius: 5, padding: "2px 5px",
                      background: bg, cursor: "pointer", textAlign: "left", overflow: "hidden", zIndex: 1,
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
                    }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color, lineHeight: 1.3 }}>{fmtTime(link.starts_at!)}</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{e.name}</p>
                      {height > 44 && link.space_name && (
                        <p style={{ margin: 0, fontSize: 9.5, color: "var(--color-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📍 {link.space_name}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── DiaView ───────────────────────────────────────────────────────────────────
function DiaView({ events, linksByGid, anchor, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  onEventClick: (e: AsanaEvent) => void;
}) {
  return <TimeGrid events={events} linksByGid={linksByGid} days={[anchor]} onEventClick={onEventClick} />;
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
  const weekDays  = useMemo(() => getWeekDays(anchor), [anchor]);
  const today     = todayStr();
  const selDayEvs = useMemo(() => eventsForDate(events, selDay), [events, selDay]);

  return (
    <div>
      {/* Column headers aligned with 52px time-label column */}
      <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid var(--color-line)" }}>
        <div />
        {weekDays.map((date, i) => {
          const ds      = toDateStr(date);
          const isToday = ds === today;
          const isSel   = ds === selDay;
          return (
            <button key={i} type="button" onClick={() => setSelDay(ds)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 2px 4px",
              background: "none", cursor: "pointer",
              borderTop: "none", borderRight: "none", borderLeft: "none",
              borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: isSel ? "var(--color-accent)" : "transparent",
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: isToday ? "var(--color-accent)" : "var(--color-muted)" }}>
                {DOW_SUN[i]}
              </span>
              <span style={{
                width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", fontSize: 13, fontWeight: 700,
                background: isToday ? "var(--color-accent)" : "transparent",
                color: isToday ? "var(--color-accent-ink)" : "var(--color-ink)",
              }}>
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile: event list for selected day */}
      <div className="sm:hidden">
        <DayEventList events={selDayEvs} linksByGid={linksByGid} dateStr={selDay} onEventClick={onEventClick} />
      </div>

      {/* Desktop: time grid */}
      <div className="hidden sm:block">
        <TimeGrid events={events} linksByGid={linksByGid} days={weekDays} onEventClick={onEventClick} />
      </div>
    </div>
  );
}

// ── MesView ───────────────────────────────────────────────────────────────────
const MAX_EVS_DAY = 4;

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
  const selDayEvs = useMemo(() => eventsForDate(events, selDay), [events, selDay]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {DOW_SUN.map(l => (
          <div key={l} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", padding: "4px 0 6px" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid var(--color-line)", borderLeft: "1px solid var(--color-line)" }}>
        {cells.map(({ date, current }, idx) => {
          const ds      = toDateStr(date);
          const dayEvs  = eventsForDate(events, ds);
          const isToday = ds === today;
          const isSel   = ds === selDay;
          const isPast  = ds < today;
          const shown   = dayEvs.slice(0, MAX_EVS_DAY);
          const more    = dayEvs.length - shown.length;
          return (
            <div key={idx} onClick={() => setSelDay(ds)} style={{
              borderRight: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)",
              minHeight: 80, padding: "4px 2px 4px", cursor: "pointer",
              background: isSel && !isToday ? "var(--color-accent-soft)" : "transparent",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                <span style={{
                  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", fontSize: 12, fontWeight: isToday ? 700 : 400,
                  background: isToday ? "var(--color-accent)" : "transparent",
                  color: isToday ? "var(--color-accent-ink)" : !current ? "var(--color-faint)" : isPast ? "var(--color-muted)" : "var(--color-ink)",
                }}>
                  {date.getDate()}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {shown.map(e => {
                  const link = linksByGid[e.gid];
                  const { color } = catStyle(e.category);
                  return (
                    <button key={e.gid} type="button"
                      onClick={ev => { ev.stopPropagation(); onEventClick(e); }}
                      style={{
                        display: "flex", alignItems: "center", width: "100%", textAlign: "left",
                        padding: "0 2px 0 0", background: "none", cursor: "pointer",
                        borderTop: "none", borderRight: "none", borderBottom: "none",
                        borderLeftWidth: 2, borderLeftStyle: "solid", borderLeftColor: color,
                        opacity: isPast ? 0.55 : 1,
                      }}>
                      <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 3 }}>
                        {e.name}
                      </span>
                      {link?.starts_at && (
                        <span style={{ fontSize: 9.5, color: "var(--color-faint)", flexShrink: 0, marginLeft: 2 }}>
                          {fmtTime(link.starts_at)}
                        </span>
                      )}
                    </button>
                  );
                })}
                {more > 0 && (
                  <span style={{ fontSize: 9.5, color: "var(--color-muted)", paddingLeft: 5 }}>+{more} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <DayEventList events={selDayEvs} linksByGid={linksByGid} dateStr={selDay} onEventClick={onEventClick} />
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

  const pastGroups   = grouped.filter(([k]) => k < curMonthKey);
  const futureGroups = grouped.filter(([k]) => k >= curMonthKey);

  function renderMonth([mk, evs]: [string, AsanaEvent[]]) {
    const [y, m]    = mk.split("-").map(Number);
    const isPast    = mk < curMonthKey;
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
              const d       = new Date(ds + "T12:00:00");
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
                    <span style={{ fontSize: 12, textTransform: "capitalize", color: "var(--color-muted)" }}>{DNAMES[d.getDay()]}</span>
                  </div>
                  <div style={{ paddingLeft: 36, display: "flex", flexDirection: "column" }}>
                    {dayEvs.map(e => {
                      const link = linksByGid[e.gid];
                      const { color } = catStyle(e.category);
                      return (
                        <button key={e.gid} type="button" onClick={() => onEventClick(e)} style={{
                          display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
                          padding: "9px 4px 9px 10px", background: "none", cursor: "pointer",
                          borderTop: "1px solid var(--color-line)", borderRight: "none", borderBottom: "none",
                          borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
                        }}>
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
    } else if (view === "dia") {
      d.setDate(d.getDate() - 1);
      setSelDay(toDateStr(d));
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
    } else if (view === "dia") {
      d.setDate(d.getDate() + 1);
      setSelDay(toDateStr(d));
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
    if (view === "dia") {
      const d = new Date(toDateStr(anchor) + "T12:00:00");
      const dn = DNAMES[d.getDay()];
      return `${dn[0].toUpperCase() + dn.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()} ${year}`;
    }
    const days = getWeekDays(anchor);
    const f = days[0]; const l = days[6];
    if (f.getMonth() === l.getMonth())
      return `${f.getDate()}–${l.getDate()} de ${MONTHS[f.getMonth()].toLowerCase()} ${year}`;
    return `${f.getDate()} ${MONTHS[f.getMonth()].slice(0, 3).toLowerCase()} – ${l.getDate()} ${MONTHS[l.getMonth()].slice(0, 3).toLowerCase()} ${year}`;
  }

  const VIEWS: { key: View; label: string }[] = [
    { key: "lista",  label: "Lista"  },
    { key: "dia",    label: "Día"    },
    { key: "semana", label: "Semana" },
    { key: "mes",    label: "Mes"    },
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
              fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
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
      {view === "dia"    && <DiaView    events={events} linksByGid={linksByGid} anchor={anchor} onEventClick={setSelectedEvent} />}
      {view === "semana" && <SemanaView events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={setSelectedEvent} />}
      {view === "mes"    && <MesView    events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={setSelectedEvent} />}

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
