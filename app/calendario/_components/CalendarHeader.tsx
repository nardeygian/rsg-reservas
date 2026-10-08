import Link from "next/link";
import {
  addDaysBogota,
  addMonthsBogota,
  daysFrom,
  dayKey,
  formatDayNumber,
  isTodayBogota,
  startOfWeekBogota,
  toDateParam,
} from "@/lib/datetime";

export type View = "dia" | "semana" | "mes";

const VIEWS: { value: View; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Lista" },
  { value: "mes", label: "Mes" },
];

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function buildHref(params: { view: View; date: string; space?: string | null }): string {
  const sp = new URLSearchParams({ view: params.view, date: params.date });
  if (params.space) sp.set("space", params.space);
  return `/calendario?${sp.toString()}`;
}

export function CalendarHeader({
  view,
  anchor,
  space,
  daysWithEvents,
}: {
  view: View;
  anchor: Date;
  space: string | null;
  daysWithEvents: Set<string>;
}) {
  const todayParam = toDateParam(new Date());
  const anchorParam = toDateParam(anchor);

  const prevDate =
    view === "mes"
      ? toDateParam(addMonthsBogota(anchor, -1))
      : view === "semana"
        ? toDateParam(addDaysBogota(anchor, -7))
        : toDateParam(addDaysBogota(anchor, -1));

  const nextDate =
    view === "mes"
      ? toDateParam(addMonthsBogota(anchor, 1))
      : view === "semana"
        ? toDateParam(addDaysBogota(anchor, 7))
        : toDateParam(addDaysBogota(anchor, 1));

  // Week strip always shows the week containing anchor
  const weekStart = startOfWeekBogota(anchor);
  const weekDays = daysFrom(weekStart, 7);

  return (
    <header className="flex flex-col gap-3">
      {/* Título + selector de vista */}
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-[22px] font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Calendario RSG
        </h1>
        <div
          role="group"
          aria-label="Vista"
          className="flex p-[3px] gap-[2px] rounded-[9px]"
          style={{ background: "var(--color-surface-2)" }}
        >
          {VIEWS.map((v) => {
            const active = v.value === view;
            return (
              <Link
                key={v.value}
                href={buildHref({ view: v.value, date: anchorParam, space })}
                role="tab"
                aria-selected={active}
                className="px-[10px] py-[6px] rounded-[7px] text-[13px] font-semibold transition"
                style={
                  active
                    ? {
                        background: "var(--color-surface)",
                        color: "var(--color-ink)",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }
                    : { color: "var(--color-muted)" }
                }
              >
                {v.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Franja de semana */}
      <div
        className="grid grid-cols-7 gap-1 rounded-[10px] p-2"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
        }}
      >
        {weekDays.map((day, i) => {
          const key = dayKey(day);
          const isToday = isTodayBogota(day);
          const isSelected = key === anchorParam;
          const hasEvents = daysWithEvents.has(key);
          const active = isToday || isSelected;

          return (
            <Link
              key={key}
              href={buildHref({ view: view === "mes" ? "mes" : "dia", date: key, space })}
              className="flex flex-col items-center gap-[3px] py-1 rounded-[8px] transition"
              style={
                active
                  ? { background: "var(--color-accent)", color: "var(--color-accent-ink)" }
                  : undefined
              }
            >
              <span
                className="text-[11px] font-semibold"
                style={{ color: active ? "var(--color-accent-ink)" : "var(--color-muted)" }}
              >
                {DAY_LABELS[i]}
              </span>
              <span
                className="font-semibold leading-none"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "15px",
                  color: active ? "var(--color-accent-ink)" : "var(--color-ink)",
                }}
              >
                {formatDayNumber(day)}
              </span>
              {/* Dot de eventos */}
              <span
                className="block rounded-full"
                style={{
                  width: "5px",
                  height: "5px",
                  background: hasEvents
                    ? active
                      ? "var(--color-accent-ink)"
                      : "var(--color-accent)"
                    : "transparent",
                }}
              />
            </Link>
          );
        })}
      </div>

      {/* Navegación de período */}
      <div className="flex items-center gap-1">
        <Link
          href={buildHref({ view, date: prevDate, space })}
          className="w-9 h-9 inline-flex items-center justify-center rounded-[8px] border transition text-base"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          aria-label="Anterior"
        >
          ‹
        </Link>
        <Link
          href={buildHref({ view, date: todayParam, space })}
          className="px-3 h-9 inline-flex items-center rounded-[8px] border text-sm font-medium transition"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
        >
          Hoy
        </Link>
        <Link
          href={buildHref({ view, date: nextDate, space })}
          className="w-9 h-9 inline-flex items-center justify-center rounded-[8px] border transition text-base"
          style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
          aria-label="Siguiente"
        >
          ›
        </Link>
        <Link
          href="/reservas/nueva"
          className="btn-primary !h-9 !px-4 !text-sm ml-auto"
        >
          + Nueva
        </Link>
      </div>
    </header>
  );
}
