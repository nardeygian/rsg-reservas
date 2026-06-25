import Link from "next/link";
import {
  dayKey,
  formatDayNumber,
  isTodayBogota,
  monthGridRangeBogota,
  monthKey,
  toDateParam,
} from "@/lib/datetime";
import { addDaysBogota } from "@/lib/datetime";
import type { CalendarBooking } from "./BookingCard";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export function MonthView({
  anchor,
  bookings,
  space,
}: {
  anchor: Date;
  bookings: CalendarBooking[];
  space: string | null;
}) {
  const { start, end } = monthGridRangeBogota(anchor);
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDaysBogota(d, 1)) {
    days.push(d);
  }

  const byDay = countByDay(bookings);
  const anchorMonth = monthKey(anchor);

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-fg2 mb-1">
        {/* eyebrow inline para weekdays */}
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="eyebrow">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-line border border-line rounded-[14px] overflow-hidden">
        {days.map((day) => {
          const key = dayKey(day);
          const count = byDay.get(key) ?? 0;
          const inMonth = monthKey(day) === anchorMonth;
          const today = isTodayBogota(day);
          const sp = new URLSearchParams({
            view: "dia",
            date: toDateParam(day),
          });
          if (space) sp.set("space", space);

          return (
            <Link
              key={key}
              href={`/calendario?${sp.toString()}`}
              className={`min-h-14 p-1 flex flex-col items-start gap-1 bg-bg-elev ${
                inMonth ? "" : "text-fg3 opacity-60"
              }`}
            >
              <span
                className={`text-xs tabular-nums ${
                  today ? "rounded-full px-1.5" : "font-medium"
                }`}
                style={
                  today
                    ? {
                        background: "var(--color-forest)",
                        color: "var(--color-sand-100)",
                      }
                    : undefined
                }
              >
                {formatDayNumber(day)}
              </span>
              {count > 0 && (
                <span className="text-[10px] text-fg2">
                  {count} {count === 1 ? "reserva" : "reservas"}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function countByDay(bookings: CalendarBooking[]) {
  const map = new Map<string, number>();
  for (const b of bookings) {
    if (!b.starts_at) continue;
    const key = dayKey(b.starts_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
