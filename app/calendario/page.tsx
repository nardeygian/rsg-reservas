import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  dayKey,
  endOfDayBogota,
  endOfWeekBogota,
  monthGridRangeBogota,
  parseDateParam,
  startOfDayBogota,
  startOfWeekBogota,
  toDateParam,
} from "@/lib/datetime";
import { CalendarHeader, type View } from "./_components/CalendarHeader";
import type { CalendarBooking } from "./_components/BookingCard";
import { DayView } from "./_components/DayView";
import { WeekView } from "./_components/WeekView";
import { MonthView } from "./_components/MonthView";
import { SpaceFilter } from "./_components/SpaceFilter";

function parseView(value: string | undefined): View {
  if (value === "dia" || value === "semana" || value === "mes") return value;
  return "semana";
}

function rangeForView(view: View, anchor: Date) {
  if (view === "dia") {
    return { start: startOfDayBogota(anchor), end: endOfDayBogota(anchor) };
  }
  if (view === "semana") {
    return { start: startOfWeekBogota(anchor), end: endOfWeekBogota(anchor) };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekStart = startOfWeekBogota(anchor);
  const weekEnd = endOfWeekBogota(anchor);

  // Tres queries en paralelo: reservas del período, puntos de la semana, lista de espacios
  const [
    { data: bookings, error: bookingsError },
    { data: weekDots },
    { data: ownWeekBookings },
    { data: spaces },
  ] = await Promise.all([
    // Reservas del rango seleccionado
    (() => {
      let q = supabase
        .from("bookings_calendar")
        .select("id, space_id, space_name, starts_at, ends_at, status, display_owner, use_type, has_montaje_lock")
        .lt("starts_at", end.toISOString())
        .gt("ends_at", start.toISOString())
        .in("status", ["requested", "approved"])
        .order("starts_at", { ascending: true });
      if (space) q = q.eq("space_id", space);
      return q;
    })(),
    // Días de la semana que tienen algún evento (para los dots)
    supabase
      .from("bookings_calendar")
      .select("starts_at")
      .lt("starts_at", weekEnd.toISOString())
      .gt("ends_at", weekStart.toISOString())
      .in("status", ["requested", "approved"]),
    // IDs de las reservas del usuario en la semana (para pintar azul)
    supabase
      .from("bookings_calendar")
      .select("id")
      .eq("created_by", user.id)
      .lt("starts_at", weekEnd.toISOString())
      .gt("ends_at", weekStart.toISOString())
      .in("status", ["requested", "approved"]),
    // Espacios disponibles para el filtro
    supabase.from("spaces").select("id, name").neq("status", "disabled").order("name"),
  ]);

  const daysWithEvents = new Set(
    (weekDots ?? []).map((b) => b.starts_at ? dayKey(b.starts_at) : "").filter(Boolean)
  );

  const ownBookingIds = new Set(
    (ownWeekBookings ?? []).map((b) => b.id).filter((id): id is string => !!id)
  );

  const today = toDateParam(new Date());
  const isThisWeek =
    toDateParam(weekStart) <= today && today <= toDateParam(weekEnd);

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="flex-1 px-4 pt-5 pb-4 max-w-2xl mx-auto w-full flex flex-col gap-4">
        <CalendarHeader
          view={view}
          anchor={anchor}
          space={space}
          daysWithEvents={daysWithEvents}
        />

        <SpaceFilter spaces={spaces ?? []} current={space} />

        {bookingsError ? (
          <p className="text-sm py-4" style={{ color: "var(--color-down)" }}>
            No se pudo cargar el calendario: {bookingsError.message}
          </p>
        ) : view === "dia" ? (
          <DayView
            bookings={(bookings ?? []) as CalendarBooking[]}
            ownBookingIds={ownBookingIds}
          />
        ) : view === "semana" ? (
          <WeekView
            weekStart={start}
            bookings={(bookings ?? []) as CalendarBooking[]}
            ownBookingIds={ownBookingIds}
          />
        ) : (
          <MonthView
            anchor={anchor}
            bookings={(bookings ?? []) as CalendarBooking[]}
            space={space}
          />
        )}
      </div>
    </main>
  );
}
