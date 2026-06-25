import Link from "next/link";
import {
  addDaysBogota,
  addMonthsBogota,
  formatDateLong,
  formatMonthYear,
  formatWeekRange,
  toDateParam,
} from "@/lib/datetime";
import { SpaceFilter } from "./SpaceFilter";

type Space = { id: string; name: string };
export type View = "dia" | "semana" | "mes";

function buildHref(params: {
  view: View;
  date: string;
  space: string | null;
}): string {
  const sp = new URLSearchParams({ view: params.view, date: params.date });
  if (params.space) sp.set("space", params.space);
  return `/calendario?${sp.toString()}`;
}

export function CalendarHeader({
  view,
  anchor,
  rangeStart,
  rangeEnd,
  space,
  spaces,
}: {
  view: View;
  anchor: Date;
  rangeStart: Date;
  rangeEnd: Date;
  space: string | null;
  spaces: Space[];
}) {
  const todayParam = toDateParam(new Date());

  const { prevDate, nextDate, title } = (() => {
    if (view === "dia") {
      return {
        prevDate: toDateParam(addDaysBogota(anchor, -1)),
        nextDate: toDateParam(addDaysBogota(anchor, 1)),
        title: formatDateLong(anchor),
      };
    }
    if (view === "semana") {
      return {
        prevDate: toDateParam(addDaysBogota(anchor, -7)),
        nextDate: toDateParam(addDaysBogota(anchor, 7)),
        title: formatWeekRange(rangeStart, rangeEnd),
      };
    }
    return {
      prevDate: toDateParam(addMonthsBogota(anchor, -1)),
      nextDate: toDateParam(addMonthsBogota(anchor, 1)),
      title: formatMonthYear(anchor),
    };
  })();

  const VIEWS: { value: View; label: string }[] = [
    { value: "dia", label: "Día" },
    { value: "semana", label: "Semana" },
    { value: "mes", label: "Mes" },
  ];

  return (
    <header className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">Calendario</p>
          <h1 className="font-serif text-2xl mt-1 capitalize tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/reservas/nueva"
            className="btn-primary !h-10 !px-4 !text-sm"
          >
            + Nueva
          </Link>
          <Link href="/" className="text-fg2 underline">
            Inicio
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={buildHref({ view, date: prevDate, space })}
          className="px-3 h-9 inline-flex items-center rounded-full border border-line text-sm hover:bg-bg-muted transition"
          aria-label="Anterior"
        >
          ‹
        </Link>
        <Link
          href={buildHref({ view, date: todayParam, space })}
          className="px-3 h-9 inline-flex items-center rounded-full border border-line text-sm hover:bg-bg-muted transition font-medium"
        >
          Hoy
        </Link>
        <Link
          href={buildHref({ view, date: nextDate, space })}
          className="px-3 h-9 inline-flex items-center rounded-full border border-line text-sm hover:bg-bg-muted transition"
          aria-label="Siguiente"
        >
          ›
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <div
            role="tablist"
            aria-label="Vista"
            className="inline-flex rounded-full border border-line overflow-hidden bg-bg-elev"
          >
            {VIEWS.map((v) => {
              const active = v.value === view;
              return (
                <Link
                  key={v.value}
                  href={buildHref({
                    view: v.value,
                    date: toDateParam(anchor),
                    space,
                  })}
                  role="tab"
                  aria-selected={active}
                  className={`px-3 h-9 inline-flex items-center text-xs font-medium ${
                    active
                      ? "bg-[var(--color-action-bg)] text-[var(--color-action-fg)]"
                      : "text-fg2 hover:bg-bg-muted"
                  }`}
                >
                  {v.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <SpaceFilter spaces={spaces} current={space} />
    </header>
  );
}
