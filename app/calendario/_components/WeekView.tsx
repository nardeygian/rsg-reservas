import {
  dayKey,
  daysFrom,
  formatDateShort,
  isTodayBogota,
} from "@/lib/datetime";
import { BookingCard, type CalendarBooking } from "./BookingCard";

export function WeekView({
  weekStart,
  bookings,
}: {
  weekStart: Date;
  bookings: CalendarBooking[];
}) {
  const days = daysFrom(weekStart, 7);
  const byDay = groupByDay(bookings);

  return (
    <ol className="space-y-4">
      {days.map((day) => {
        const key = dayKey(day);
        const items = byDay.get(key) ?? [];
        const today = isTodayBogota(day);
        return (
          <li key={key}>
            <h2
              className={`text-sm font-semibold mb-2 capitalize ${
                today ? "text-blue-700 dark:text-blue-300" : ""
              }`}
            >
              {formatDateShort(day)}
              {today && (
                <span className="ml-2 text-[10px] uppercase tracking-wide bg-blue-600 text-white rounded px-1 py-0.5">
                  hoy
                </span>
              )}
            </h2>
            {items.length === 0 ? (
              <p className="text-xs text-gray-500 pl-1">Sin reservas.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((b) => (
                  <li key={b.id ?? `${b.starts_at}-${b.space_id}`}>
                    <BookingCard booking={b} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function groupByDay(bookings: CalendarBooking[]) {
  const map = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    if (!b.starts_at) continue;
    const key = dayKey(b.starts_at);
    const arr = map.get(key) ?? [];
    arr.push(b);
    map.set(key, arr);
  }
  return map;
}
