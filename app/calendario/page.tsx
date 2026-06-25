import { createClient } from "@/lib/supabase/server";
import {
  endOfDayBogota,
  endOfWeekBogota,
  monthGridRangeBogota,
  parseDateParam,
  startOfDayBogota,
  startOfWeekBogota,
} from "@/lib/datetime";
import { CalendarHeader, type View } from "./_components/CalendarHeader";
import type { CalendarBooking } from "./_components/BookingCard";
import { DayView } from "./_components/DayView";
import { WeekView } from "./_components/WeekView";
import { MonthView } from "./_components/MonthView";

function parseView(value: string | undefined): View {
  if (value === "dia" || value === "semana" || value === "mes") return value;
  return "semana";
}

function rangeForView(view: View, anchor: Date) {
  if (view === "dia") {
    return { start: startOfDayBogota(anchor), end: endOfDayBogota(anchor) };
  }
  if (view === "semana") {
    return {
      start: startOfWeekBogota(anchor),
      end: endOfWeekBogota(anchor),
    };
  }
  return monthGridRangeBogota(anchor);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; space?: string }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const anchor = parseDateParam(params.date);
  const space = params.space?.trim() || null;

  const { start, end } = rangeForView(view, anchor);

  const supabase = await createClient();

  // Solapamiento: una reserva entra si comienza antes del fin del rango Y
  // termina después del inicio. Evita perder eventos que arrancan en el día
  // anterior y siguen activos.
  let bookingsQuery = supabase
    .from("bookings_calendar")
    .select(
      "id, space_id, space_name, starts_at, ends_at, status, display_owner, use_type, has_montaje_lock"
    )
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .in("status", ["requested", "approved"])
    .order("starts_at", { ascending: true });

  if (space) {
    bookingsQuery = bookingsQuery.eq("space_id", space);
  }

  const [{ data: bookings, error: bookingsError }, { data: spaces }] =
    await Promise.all([
      bookingsQuery,
      supabase
        .from("spaces")
        .select("id, name")
        .neq("status", "disabled")
        .order("name"),
    ]);

  return (
    <main className="min-h-dvh px-4 py-4 max-w-3xl mx-auto space-y-4">
      <CalendarHeader
        view={view}
        anchor={anchor}
        rangeStart={start}
        rangeEnd={end}
        space={space}
        spaces={spaces ?? []}
      />

      {bookingsError ? (
        <p className="text-sm text-red-600">
          No se pudo cargar el calendario: {bookingsError.message}
        </p>
      ) : view === "dia" ? (
        <DayView bookings={(bookings ?? []) as CalendarBooking[]} />
      ) : view === "semana" ? (
        <WeekView
          weekStart={start}
          bookings={(bookings ?? []) as CalendarBooking[]}
        />
      ) : (
        <MonthView
          anchor={anchor}
          bookings={(bookings ?? []) as CalendarBooking[]}
          space={space}
        />
      )}
    </main>
  );
}
