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
      <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-gray-500 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
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
              className={`min-h-14 p-1 flex flex-col items-start gap-1 bg-white dark:bg-gray-950 ${
                inMonth ? "" : "text-gray-400 dark:text-gray-600"
              }`}
            >
              <span
                className={`text-xs tabular-nums ${
                  today
                    ? "bg-blue-600 text-white rounded-full px-1.5"
                    : "font-medium"
                }`}
              >
                {formatDayNumber(day)}
              </span>
              {count > 0 && (
                <span className="text-[10px] text-gray-600 dark:text-gray-400">
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
