"use client";

import Link from "next/link";

// Cuadrícula de mes para escritorio, al estilo del Calendario de Apple en Mac:
// una tarjeta de vidrio con líneas finas, número del día arriba a la derecha
// (hoy en círculo de acento), fines de semana apenas sombreados, eventos con
// hora como "● Título  7pm" y eventos sin hora como pastilla de color.
// La comparten el Calendario de eventos y Reservas.

export type MonthCell = { key: string; day: number; inMonth: boolean; weekend: boolean };

export type MonthItem = {
  id: string;
  title: string;
  time?: string | null;
  color: string;
  href?: string;
  onClick?: () => void;
  dim?: boolean;
};

const MAX_PER_DAY = 3;

export function MonthGrid({
  weekdays,
  cells,
  itemsByDay,
  today,
  selected,
  onSelect,
}: {
  weekdays: string[];
  cells: MonthCell[];
  itemsByDay: Record<string, MonthItem[]>;
  today: string;
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {weekdays.map((w, i) => (
          <div key={i} className="text-right px-3 py-2 text-[12px] font-semibold" style={{ color: "var(--color-muted)" }}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, idx) => {
          const items = itemsByDay[c.key] ?? [];
          const shown = items.slice(0, MAX_PER_DAY);
          const more = items.length - shown.length;
          const isToday = c.key === today;
          const isSel = c.key === selected;
          const lastCol = idx % 7 === 6;
          const lastRow = idx >= cells.length - 7;
          return (
            <div
              key={c.key}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={`${c.day}${items.length ? `, ${items.length} eventos` : ""}`}
              onClick={() => onSelect(c.key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(c.key); } }}
              className="flex flex-col gap-1 p-1.5 min-h-[112px] cursor-pointer transition-colors"
              style={{
                borderRight: lastCol ? undefined : "1px solid var(--color-line)",
                borderBottom: lastRow ? undefined : "1px solid var(--color-line)",
                background: isSel
                  ? "color-mix(in srgb, var(--color-accent-soft) 70%, transparent)"
                  : c.weekend ? "color-mix(in srgb, var(--color-surface-2) 45%, transparent)" : "transparent",
              }}
            >
              <div className="flex justify-end">
                <span
                  className="tabular text-[13px] min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center"
                  style={{
                    fontWeight: isToday ? 700 : 500,
                    background: isToday ? "var(--color-accent)" : "transparent",
                    color: isToday ? "var(--color-accent-ink)" : c.inMonth ? "var(--color-ink)" : "var(--color-faint)",
                  }}
                >
                  {c.day}
                </span>
              </div>
              <div className="flex flex-col gap-[3px] min-w-0">
                {shown.map((it) => <Chip key={it.id} it={it} />)}
                {more > 0 && (
                  <span className="text-[11.5px] font-medium px-1.5" style={{ color: "var(--color-muted)" }}>+{more} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ it }: { it: MonthItem }) {
  const timed = !!it.time;
  const body = (
    <span
      className="flex items-center gap-1.5 w-full min-w-0 rounded-[6px] px-1.5 py-[2px] text-[12px] leading-[1.35] transition-opacity hover:opacity-80"
      style={{
        opacity: it.dim ? 0.55 : 1,
        // Sin hora: pastilla con el color de la categoría (como un evento de todo el día)
        background: timed ? "transparent" : `color-mix(in srgb, ${it.color} 18%, transparent)`,
        color: "var(--color-ink)",
      }}
    >
      {timed && <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: it.color }} />}
      {!timed && <span className="w-[3px] self-stretch rounded-full flex-none" style={{ background: it.color }} />}
      <span className="truncate font-medium flex-1">{it.title}</span>
      {/* La hora solo cuando la celda tiene espacio; si no, el título va primero */}
      {timed && <span className="hidden xl:inline flex-none tabular text-[11px]" style={{ color: "var(--color-muted)" }}>{it.time}</span>}
    </span>
  );
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (it.href) return <Link href={it.href} prefetch onClick={stop} className="block min-w-0" style={{ textDecoration: "none" }}>{body}</Link>;
  return (
    <button type="button" className="block w-full min-w-0 text-left" onClick={(e) => { stop(e); it.onClick?.(); }}>
      {body}
    </button>
  );
}
