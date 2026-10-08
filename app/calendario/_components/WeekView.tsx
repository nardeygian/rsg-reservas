import {
  dayKey,
  daysFrom,
  isTodayBogota,
} from "@/lib/datetime";
import { BookingCard, type CalendarBooking } from "./BookingCard";

const DAY_LABELS_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function eyebrowDay(date: Date): string {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  return `${DAY_LABELS_LONG[d.getDay()]} ${d.getDate()}`;
}

export function WeekView({
  weekStart,
  bookings,
  ownBookingIds,
}: {
  weekStart: Date;
  bookings: CalendarBooking[];
  ownBookingIds: Set<string>;
}) {
  const days = daysFrom(weekStart, 7);
  const byDay = groupByDay(bookings);

  // Sólo renderiza días que tengan reservas (o que sea hoy)
  const relevantDays = days.filter(
    (d) => isTodayBogota(d) || (byDay.get(dayKey(d)) ?? []).length > 0
  );

  if (relevantDays.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--color-faint)" }}>
        Sin reservas esta semana.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {relevantDays.map((day) => {
        const key = dayKey(day);
        const items = byDay.get(key) ?? [];
        const today = isTodayBogota(day);

        return (
          <li key={key}>
            <h2 className="eyebrow mb-2" style={today ? { color: "var(--color-accent)" } : undefined}>
              {today ? "Hoy · " : ""}
              {eyebrowDay(day)}
            </h2>
            {items.length === 0 ? (
              <p className="text-xs pl-1" style={{ color: "var(--color-faint)" }}>
                Sin reservas.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((b) => (
                  <li key={b.id ?? `${b.starts_at}-${b.space_id}`}>
                    <BookingCard
                      booking={b}
                      isOwn={!!b.id && ownBookingIds.has(b.id)}
                    />
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
