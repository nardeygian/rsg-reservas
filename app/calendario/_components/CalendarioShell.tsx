"use client";

import { Icon } from "@/app/_components/ui/Icon";
import { Chevron as ChevronIcon } from "@/app/_components/ui/PeriodPicker";
import { MonthGrid, type MonthCell, type MonthItem } from "@/app/_components/ui/MonthGrid";

import { useState, useMemo, useRef, useEffect } from "react";
import type { AsanaEvent } from "@/lib/asana";
import type { LinkInfo, BookingOption } from "../page";
import { EventPanel } from "./EventPanel";

type DesktopView = "lista" | "dia" | "semana" | "mes";
type MobileView  = "mes" | "2dias";

const HOUR_PX = 60;
const START_H = 7;
const END_H   = 23;
const HOURS   = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

// Colores de categoría en tonos que conviven con la paleta de marca.
const PALETTE = [
  { bg: "rgba(31,107,79,0.14)",   color: "#2E7D5E" },  // bosque
  { bg: "rgba(63,127,147,0.14)",  color: "#3F7F93" },  // azul suave profundo
  { bg: "rgba(162,116,45,0.14)",  color: "#A2742D" },  // ocre
  { bg: "rgba(122,106,168,0.14)", color: "#7A6AA8" },  // lavanda
  { bg: "rgba(180,87,74,0.14)",   color: "#B4574A" },  // terracota
  { bg: "rgba(78,143,134,0.14)",  color: "#4E8F86" },  // verde agua
  { bg: "rgba(140,106,85,0.14)",  color: "#8C6A55" },  // choco claro
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
  s.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(d.getDate() + n); return r;
}

const DOW_SUN = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const DOW_LETTER = ["D","L","M","M","J","V","S"];
const MONTHS  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DNAMES  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

// ── DayEventList ─────────────────────────────────────────────────────────────
function DayEventList({ events, linksByGid, dateStr, onEventClick, compact = false }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  dateStr: string;
  onEventClick: (e: AsanaEvent) => void;
  compact?: boolean;
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

  if (compact) {
    return (
      <div className="flex flex-col gap-2 pt-4">
        <span className="px-1 text-[13px] font-semibold" style={{ color: isToday ? "var(--color-accent)" : "var(--color-muted)" }}>
          {isToday ? `Hoy · ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}` : label}
        </span>
        <div className="card overflow-hidden divide-y">
          {events.length === 0 ? (
            <p className="text-[15px] text-center py-6" style={{ color: "var(--color-faint)" }}>No hay eventos</p>
          ) : sorted.map(e => {
            const link = linksByGid[e.gid];
            const { color } = catStyle(e.category);
            return (
              <button key={e.gid} type="button" onClick={() => onEventClick(e)}
                className="flex items-stretch gap-3 w-full text-left px-4 py-3 active:opacity-70 transition-opacity">
                <span className="w-[4px] rounded-full flex-none" style={{ background: color, opacity: isPast ? 0.5 : 1 }} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[16px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>{e.name}</span>
                  {(e.category || link?.space_name) && (
                    <span className="text-[13px] truncate" style={{ color: "var(--color-muted)" }}>
                      {[e.category, link?.space_name].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-end flex-none text-[13px] tabular" style={{ color: "var(--color-muted)" }}>
                  {link?.starts_at ? (
                    <>
                      <span className="font-medium" style={{ color: "var(--color-ink)" }}>{fmtTime(link.starts_at)}</span>
                      {link.ends_at && <span>{fmtTime(link.ends_at)}</span>}
                    </>
                  ) : (
                    <span>Todo el día</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ opacity: isPast ? 0.75 : 1 }}>
      {!compact && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0 6px" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: isToday ? "var(--color-accent)" : "var(--color-ink)" }}>{label}</span>
          {events.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
              {events.length}
            </span>
          )}
        </div>
      )}
      {events.length === 0
        ? <p style={{ fontSize: 13, color: "var(--color-faint)", textAlign: "center", padding: "20px 0 24px" }}>Sin eventos</p>
        : sorted.map(e => {
            const link = linksByGid[e.gid];
            const { color } = catStyle(e.category);
            return (
              <button key={e.gid} type="button" onClick={() => onEventClick(e)} style={{
                display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
                padding: "12px 4px 12px 12px", background: "none", cursor: "pointer",
                borderTop: "1px solid var(--color-line)", borderRight: "none", borderBottom: "none",
                borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: compact ? 15 : 14, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</p>
                  {!compact && e.category && <p style={{ margin: "2px 0 0", fontSize: 11.5, color }}>{e.category}</p>}
                  {link?.space_name && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    {link.space_name}
                  </p>}
                </div>
                {link?.starts_at && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: compact ? 13 : 12.5, fontWeight: 600, color: "var(--color-muted)" }}>{fmtTime(link.starts_at)}</p>
                    {link.ends_at && <p style={{ margin: "2px 0 0", fontSize: compact ? 12 : 11, color: "var(--color-faint)" }}>{fmtTime(link.ends_at)}</p>}
                  </div>
                )}
              </button>
            );
          })
      }
    </div>
  );
}

// ── TimeGrid (Día y Semana desktop / 2-días móvil) ────────────────────────────
function TimeGrid({ events, linksByGid, days, onEventClick, maxHeight }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  days: Date[];
  onEventClick: (e: AsanaEvent) => void;
  maxHeight?: string;
}) {
  const today = todayStr();
  const nCols = days.length;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { h, m } = toBogoHM(new Date().toISOString());
    const top = Math.max(0, (h - START_H) * HOUR_PX + m * (HOUR_PX / 60) - 120);
    el.scrollTop = top;
  }, []);

  const allDayEvs = (ds: string) => eventsForDate(events, ds).filter(e => !linksByGid[e.gid]?.starts_at);
  const timedEvs  = (ds: string) => eventsForDate(events, ds).filter(e => !!linksByGid[e.gid]?.starts_at);
  const hasAnyAllDay = days.some(d => allDayEvs(toDateStr(d)).length > 0);

  return (
    <div>
      {hasAnyAllDay && (
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${nCols}, 1fr)`, borderBottom: "1px solid var(--color-line)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 8, paddingBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-faint)" }}>todo el día</span>
          </div>
          {days.map((date, i) => (
            <div key={i} style={{ borderLeft: "1px solid var(--color-line)", padding: "3px 2px", display: "flex", flexDirection: "column", gap: 2 }}>
              {allDayEvs(toDateStr(date)).map(e => {
                const { color, bg } = catStyle(e.category);
                return (
                  <button key={e.gid} type="button" onClick={() => onEventClick(e)} style={{
                    display: "block", width: "100%", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: 10.5, fontWeight: 600, color: "var(--color-ink)", background: bg, borderRadius: "var(--radius-control)", padding: "2px 5px", cursor: "pointer",
                    borderTop: "none", borderRight: "none", borderBottom: "none",
                    borderLeftWidth: 2, borderLeftStyle: "solid", borderLeftColor: color,
                  }}>
                    {e.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} style={{ overflowY: "auto", maxHeight: maxHeight ?? "calc(100vh - 340px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(${nCols}, 1fr)` }}>
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_PX, position: "relative" }}>
                <span style={{ position: "absolute", top: -8, right: 6, fontSize: 9.5, color: "var(--color-faint)", fontWeight: 500, whiteSpace: "nowrap", userSelect: "none" }}>
                  {hLabel(h)}
                </span>
              </div>
            ))}
          </div>
          {days.map((date, ci) => {
            const ds      = toDateStr(date);
            const isToday = ds === today;
            return (
              <div key={ci} style={{
                position: "relative", height: HOURS.length * HOUR_PX,
                borderLeft: "1px solid var(--color-line)",
                background: isToday ? "rgba(0,160,112,0.025)" : "transparent",
              }}>
                {HOURS.map((_, hi) => (
                  <div key={hi} style={{ position: "absolute", left: 0, right: 0, top: hi * HOUR_PX, height: 0, borderTop: "1px solid var(--color-line)", pointerEvents: "none" }} />
                ))}
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
                      borderRadius: "var(--radius-control)", padding: "2px 5px",
                      background: bg, cursor: "pointer", textAlign: "left", overflow: "hidden", zIndex: 1,
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: color,
                    }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color, lineHeight: 1.3 }}>{fmtTime(link.starts_at!)}</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{e.name}</p>
                      {height > 44 && link.space_name && (
                        <p style={{ margin: 0, fontSize: 9.5, color: "var(--color-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 2 }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                          {link.space_name}
                        </p>
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

// ── MobileMesView ─────────────────────────────────────────────────────────────
function MobileMesView({ events, linksByGid, anchor, selDay, setSelDay, onEventClick, onSwipe }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  selDay: string;
  setSelDay: (d: string) => void;
  onEventClick: (e: AsanaEvent) => void;
  onSwipe: (dir: -1 | 1) => void;
}) {
  const year  = anchor.getFullYear();
  const month = anchor.getMonth();
  const today = todayStr();
  const cells    = useMemo(() => getMonthGrid(year, month), [year, month]);
  const selDayEvs = useMemo(() => eventsForDate(events, selDay), [events, selDay]);
  const touchStartX = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 50) return;
        onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DOW_LETTER.map((l, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--color-faint)", padding: "0 0 6px" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map(({ date, current }, idx) => {
          const ds      = toDateStr(date);
          const dayEvs  = eventsForDate(events, ds);
          const isToday = ds === today;
          const isSel   = ds === selDay;
          const isPast  = ds < today;
          // Deduplicate by category for color segments
          const catColors: string[] = [];
          const seen = new Set<string>();
          for (const e of dayEvs) {
            const k = e.category ?? "__";
            if (!seen.has(k)) { seen.add(k); catColors.push(catStyle(e.category).color); }
            if (catColors.length >= 3) break;
          }
          return (
            <button key={idx} type="button" onClick={() => setSelDay(ds)}
              aria-label={`${date.getDate()} de ${MONTHS[date.getMonth()].toLowerCase()}${dayEvs.length ? `, ${dayEvs.length} eventos` : ""}`}
              aria-pressed={isSel}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0 8px", cursor: "pointer", borderTop: "1px solid var(--color-line)" }}>
              <span className="tabular" style={{
                width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", fontSize: 19, fontWeight: isToday || isSel ? 600 : 400,
                transition: "background 0.15s ease, color 0.15s ease",
                // Como en Apple: hoy en color de acento; el día elegido con círculo lleno.
                background: isSel ? (isToday ? "var(--color-accent)" : "var(--color-ink)") : "transparent",
                color: isSel
                  ? (isToday ? "var(--color-accent-ink)" : "var(--color-bg)")
                  : isToday ? "var(--color-accent)"
                  : !current ? "var(--color-faint)" : "var(--color-ink)",
              }}>
                {date.getDate()}
              </span>
              <span style={{ display: "flex", gap: 3, height: 6 }}>
                {catColors.map((c, i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c, opacity: isPast || !current ? 0.45 : 1 }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <DayEventList events={selDayEvs} linksByGid={linksByGid} dateStr={selDay} onEventClick={onEventClick} compact />
    </div>
  );
}

// ── Mobile2DiasView ───────────────────────────────────────────────────────────
function Mobile2DiasView({ events, linksByGid, initialDay, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  initialDay: string;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const [pairStart, setPairStart] = useState(() => new Date(initialDay + "T12:00:00"));
  const touchStartX = useRef<number | null>(null);
  const today    = todayStr();
  const weekDays = useMemo(() => getWeekDays(pairStart), [pairStart]);
  const day2     = useMemo(() => addDays(pairStart, 1), [pairStart]);

  const ds1 = toDateStr(pairStart);
  const ds2 = toDateStr(day2);

  function colHeader(date: Date): string {
    const d  = new Date(toDateStr(date) + "T12:00:00");
    const dn = DNAMES[d.getDay()];
    return `${dn[0].toUpperCase() + dn.slice(1, 3)} – ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  }

  return (
    <div
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 48) setPairStart(p => addDays(p, dx < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      {/* Week strip with 2-day pill */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
        {weekDays.map((date, i) => {
          const ds      = toDateStr(date);
          const isToday = ds === today;
          const isPair1 = ds === ds1;
          const isPair2 = ds === ds2;
          const inPair  = isPair1 || isPair2;
          return (
            <button key={i} type="button" onClick={() => setPairStart(new Date(toDateStr(date) + "T12:00:00"))} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0",
              background: inPair ? "var(--color-surface-2)" : "transparent",
              borderRadius: isPair1 ? "20px 0 0 20px" : isPair2 ? "0 20px 20px 0" : 0,
              border: "none", cursor: "pointer",
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: isToday ? "var(--color-accent)" : "var(--color-muted)" }}>
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

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr", borderBottom: "1px solid var(--color-line)" }}>
        <div />
        {[pairStart, day2].map((date, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 600, color: "var(--color-muted)", padding: "5px 0 4px", borderLeft: "1px solid var(--color-line)" }}>
            {colHeader(date)}
          </div>
        ))}
      </div>

      <TimeGrid events={events} linksByGid={linksByGid} days={[pairStart, day2]} onEventClick={onEventClick} maxHeight="calc(100vh - 300px)" />
    </div>
  );
}

// ── MobileCalendario ──────────────────────────────────────────────────────────
function MobileCalendario({ events, linksByGid, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const [view,   setView]   = useState<MobileView>("mes");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selDay, setSelDay] = useState(() => todayStr());

  const year  = anchor.getFullYear();
  const month = anchor.getMonth();

  function prevMonth() { setAnchor(a => { const d = new Date(a); d.setMonth(d.getMonth() - 1); return d; }); }
  function nextMonth() { setAnchor(a => { const d = new Date(a); d.setMonth(d.getMonth() + 1); return d; }); }
  function goToday()   { setAnchor(new Date()); setSelDay(todayStr()); }

  const MOBILE_VIEWS: { key: MobileView; label: string }[] = [
    { key: "mes",   label: "Mes"    },
    { key: "2dias", label: "2 días" },
  ];

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tabular" style={{ color: "var(--color-accent)" }}>{year}</span>
          <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--color-ink)" }}>
            {view === "mes" ? MONTHS[month] : "Agenda"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pb-0.5">
          {view === "mes" && <button type="button" className="icon-btn" onClick={prevMonth} aria-label="Mes anterior"><ChevronIcon dir="left" /></button>}
          <button type="button" onClick={goToday} className="h-9 px-3.5 rounded-full text-[14px] font-semibold"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-accent)", boxShadow: "inset 0 1px 0 var(--glass-border)" }}>
            Hoy
          </button>
          {view === "mes" && <button type="button" className="icon-btn" onClick={nextMonth} aria-label="Mes siguiente"><ChevronIcon dir="right" /></button>}
        </div>
      </div>

      <div className="segmented w-full mb-4" role="group" aria-label="Vista">
        {MOBILE_VIEWS.map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className="flex-1">
            {label}
          </button>
        ))}
      </div>

      {view === "mes"   && <MobileMesView   events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={onEventClick} onSwipe={(dir) => setAnchor(a => { const d = new Date(a); d.setMonth(d.getMonth() + dir); return d; })} />}
      {view === "2dias" && <Mobile2DiasView events={events} linksByGid={linksByGid} initialDay={selDay} onEventClick={onEventClick} />}
    </div>
  );
}

// ── Desktop views ─────────────────────────────────────────────────────────────
function DiaView({ events, linksByGid, anchor, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  onEventClick: (e: AsanaEvent) => void;
}) {
  return <TimeGrid events={events} linksByGid={linksByGid} days={[anchor]} onEventClick={onEventClick} />;
}

function SemanaView({ events, linksByGid, anchor, selDay, setSelDay, onEventClick }: {
  events: AsanaEvent[];
  linksByGid: Record<string, LinkInfo>;
  anchor: Date;
  selDay: string;
  setSelDay: (d: string) => void;
  onEventClick: (e: AsanaEvent) => void;
}) {
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const today    = todayStr();

  return (
    <div>
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
      <TimeGrid events={events} linksByGid={linksByGid} days={weekDays} onEventClick={onEventClick} />
    </div>
  );
}


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
  const cells     = useMemo(() => getMonthGrid(year, month), [year, month]);
  const selDayEvs = useMemo(() => eventsForDate(events, selDay), [events, selDay]);

  const monthCells: MonthCell[] = cells.map(({ date, current }) => ({
    key: toDateStr(date), day: date.getDate(), inMonth: current, weekend: date.getDay() === 0 || date.getDay() === 6,
  }));
  const itemsByDay: Record<string, MonthItem[]> = {};
  for (const c of monthCells) {
    itemsByDay[c.key] = eventsForDate(events, c.key)
      .map(e => ({ e, link: linksByGid[e.gid] }))
      .sort((a, b) => (a.link?.starts_at ?? "~").localeCompare(b.link?.starts_at ?? "~"))
      .map(({ e, link }) => ({
        id: e.gid,
        title: e.name,
        time: link?.starts_at ? fmtTime(link.starts_at) : null,
        color: catStyle(e.category).color,
        onClick: () => onEventClick(e),
        dim: c.key < today,
      }));
  }

  return (
    <div className="flex flex-col gap-2">
      <MonthGrid
        weekdays={["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]}
        cells={monthCells}
        itemsByDay={itemsByDay}
        today={today}
        selected={selDay}
        onSelect={setSelDay}
      />
      <DayEventList events={selDayEvs} linksByGid={linksByGid} dateStr={selDay} onEventClick={onEventClick} compact />
    </div>
  );
}

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
    const [y, m]      = mk.split("-").map(Number);
    const isPast      = mk < curMonthKey;
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
          <span style={{ fontSize: 10, color: "var(--color-faint)" }}><Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={13} /></span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: "var(--color-surface-2)", color: "var(--color-muted)" }}>{evs.length}</span>
        </button>
        {!isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 4 }}>
            {days.map(([ds, dayEvs]) => {
              const d         = new Date(ds + "T12:00:00");
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
                            {link?.space_name && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                              {link.space_name}
                            </p>}
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
              <Icon name={showPast ? "chevron-up" : "chevron-down"} size={13} />
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
  const [view,          setView]          = useState<DesktopView>("mes");
  const [anchor,        setAnchor]        = useState(() => new Date());
  const [selDay,        setSelDay]        = useState(() => todayStr());
  const [selectedEvent, setSelectedEvent] = useState<AsanaEvent | null>(null);

  const year  = anchor.getFullYear();
  const month = anchor.getMonth();

  function prev() {
    const d = new Date(anchor);
    if (view === "mes") { d.setMonth(month - 1); setSelDay(toDateStr(new Date(d.getFullYear(), d.getMonth(), 1))); }
    else if (view === "dia") { d.setDate(d.getDate() - 1); setSelDay(toDateStr(d)); }
    else { d.setDate(d.getDate() - 7); setSelDay(toDateStr(d)); }
    setAnchor(d);
  }
  function next() {
    const d = new Date(anchor);
    if (view === "mes") { d.setMonth(month + 1); setSelDay(toDateStr(new Date(d.getFullYear(), d.getMonth(), 1))); }
    else if (view === "dia") { d.setDate(d.getDate() + 1); setSelDay(toDateStr(d)); }
    else { d.setDate(d.getDate() + 7); setSelDay(toDateStr(d)); }
    setAnchor(d);
  }
  function goToday() { setAnchor(new Date()); setSelDay(todayStr()); }

  function periodLabel() {
    if (view === "mes") return `${MONTHS[month]} ${year}`;
    if (view === "dia") {
      const d  = new Date(toDateStr(anchor) + "T12:00:00");
      const dn = DNAMES[d.getDay()];
      return `${dn[0].toUpperCase() + dn.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()} ${year}`;
    }
    const days = getWeekDays(anchor);
    const f = days[0]; const l = days[6];
    if (f.getMonth() === l.getMonth())
      return `${f.getDate()}–${l.getDate()} de ${MONTHS[f.getMonth()].toLowerCase()} ${year}`;
    return `${f.getDate()} ${MONTHS[f.getMonth()].slice(0,3).toLowerCase()} – ${l.getDate()} ${MONTHS[l.getMonth()].slice(0,3).toLowerCase()} ${year}`;
  }

  const DESKTOP_VIEWS: { key: DesktopView; label: string }[] = [
    { key: "dia",    label: "Día"    },
    { key: "semana", label: "Semana" },
    { key: "mes",    label: "Mes"    },
    { key: "lista",  label: "Lista"  },
  ];

  const selectedLink = selectedEvent ? (linksByGid[selectedEvent.gid] ?? null) : null;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px clamp(12px, 3vw, 40px) 80px" }}>
      {/* ── Mobile ── */}
      <div className="block sm:hidden">
        <MobileCalendario events={events} linksByGid={linksByGid} onEventClick={setSelectedEvent} />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden sm:block">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tabular" style={{ color: "var(--color-accent)" }}>
              {view === "mes" ? year : view === "lista" ? "Calendario" : String(year)}
            </span>
            <h1 className="text-[38px] font-semibold leading-none tracking-[-0.03em] capitalize" style={{ color: "var(--color-ink)" }}>
              {view === "mes" ? MONTHS[month] : view === "lista" ? "Próximos eventos" : periodLabel()}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="segmented" role="group" aria-label="Vista">
              {DESKTOP_VIEWS.map(({ key, label }) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
                  {label}
                </button>
              ))}
            </div>
            {view !== "lista" && (
              <div className="flex items-center gap-1.5">
                <button type="button" className="icon-btn" onClick={prev} aria-label="Anterior"><ChevronIcon dir="left" /></button>
                <button type="button" onClick={goToday} className="h-9 px-3.5 rounded-full text-[14px] font-semibold"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-accent)", boxShadow: "inset 0 1px 0 var(--glass-border)" }}>
                  Hoy
                </button>
                <button type="button" className="icon-btn" onClick={next} aria-label="Siguiente"><ChevronIcon dir="right" /></button>
              </div>
            )}
          </div>
        </div>

        {view === "lista"  && <ListaView  events={events} linksByGid={linksByGid} onEventClick={setSelectedEvent} />}
        {view === "dia"    && <DiaView    events={events} linksByGid={linksByGid} anchor={anchor} onEventClick={setSelectedEvent} />}
        {view === "semana" && <SemanaView events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={setSelectedEvent} />}
        {view === "mes"    && <MesView    events={events} linksByGid={linksByGid} anchor={anchor} selDay={selDay} setSelDay={setSelDay} onEventClick={setSelectedEvent} />}
      </div>

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
