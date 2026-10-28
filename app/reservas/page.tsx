import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  dayKey,
  endOfDayBogota,
  parseDateParam,
  startOfDayBogota,
  toDateParam,
  addDaysBogota,
  addMonthsBogota,
  startOfMonthBogota,
  monthGridRangeBogota,
  daysFrom,
  monthKey,
  formatMonthYear,
} from "@/lib/datetime";
import { ReservasDayView } from "./_components/ReservasDayView";
import type { BookingBlock } from "./_components/ReservasDayView";
import { ReservasMesView } from "./_components/ReservasMesView";
import { EventosEspacios } from "@/app/_components/portal/EventosEspacios";

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

type BookingRow = {
  id: string | null;
  space_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  display_owner: string | null;
  use_type: string | null;
  title: string | null;
};

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "mes" ? "mes" : "dia";
  const anchor = parseDateParam(params.date);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Month view ──────────────────────────────────────────────────────────────
  if (view === "mes") {
    const { start: gridStart, end: gridEnd } = monthGridRangeBogota(anchor);
    const gridDayCount = Math.round(
      (gridEnd.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000)
    );
    const gridDays = daysFrom(gridStart, gridDayCount);

    const [{ data: monthBookings }, { data: spaces }, { data: ownIdsMonth }] = await Promise.all([
      supabase
        .from("bookings_calendar")
        .select("id, space_id, starts_at, ends_at, status, display_owner, use_type, title")
        .lt("starts_at", gridEnd.toISOString())
        .gte("starts_at", gridStart.toISOString())
        .in("status", ["requested", "approved"]),
      supabase.from("spaces").select("id, name, status").order("name"),
      supabase
        .from("bookings_calendar")
        .select("id")
        .eq("created_by", user.id)
        .lt("starts_at", gridEnd.toISOString())
        .gte("starts_at", gridStart.toISOString())
        .in("status", ["requested", "approved"]),
    ]);

    const spaceMap = new Map((spaces ?? []).map((s) => [s.id, s.name]));
    const ownSetMonth = new Set(
      (ownIdsMonth ?? []).map((r) => r.id).filter((id): id is string => !!id)
    );

    const bookingsByDay: Record<string, BookingBlock[]> = {};
    for (const b of monthBookings ?? []) {
      if (!b.id || !b.space_id || !b.starts_at || !b.ends_at || !b.status) continue;
      const key = dayKey(b.starts_at);
      if (!bookingsByDay[key]) bookingsByDay[key] = [];
      bookingsByDay[key].push({
        id: b.id,
        space_id: b.space_id,
        space_name: spaceMap.get(b.space_id) ?? "",
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        status: b.status,
        display_owner: b.display_owner ?? null,
        use_type: b.use_type ?? null,
        title: b.title ?? null,
        isOwn: ownSetMonth.has(b.id),
      });
    }

    const prevMonthParam = toDateParam(startOfMonthBogota(addMonthsBogota(anchor, -1)));
    const nextMonthParam = toDateParam(startOfMonthBogota(addMonthsBogota(anchor, 1)));
    const anchorMonthKey = monthKey(anchor);

    return (
      <main className="min-h-dvh flex flex-col">
        <div className="flex-1 px-4 pt-6 pb-4 max-w-md md:max-w-[1180px] md:px-[clamp(12px,3vw,40px)] mx-auto w-full flex flex-col gap-4">
          <ReservasMesView
            gridDayKeys={gridDays.map(toDateParam)}
            bookingsByDay={bookingsByDay}
            anchorMonthKey={anchorMonthKey}
            prevMonthParam={prevMonthParam}
            nextMonthParam={nextMonthParam}
            anchorParam={toDateParam(anchor)}
            monthLabel={formatMonthYear(anchor)}
          />
        </div>
      </main>
    );
  }

  // ── Day view ────────────────────────────────────────────────────────────────
  const dateParam = toDateParam(anchor);
  const prevDate = toDateParam(addDaysBogota(anchor, -1));
  const nextDate = toDateParam(addDaysBogota(anchor, 1));

  const dayStart = startOfDayBogota(anchor);
  const dayEnd = endOfDayBogota(anchor);

  const [{ data: spaces }, { data: bookings }, { data: ownIds }] = await Promise.all([
    supabase.from("spaces").select("id, name, status").order("name"),
    supabase
      .from("bookings_calendar")
      .select("id, space_id, starts_at, ends_at, status, display_owner, use_type, title")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString())
      .in("status", ["requested", "approved"]),
    supabase
      .from("bookings_calendar")
      .select("id")
      .eq("created_by", user.id)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString())
      .in("status", ["requested", "approved"]),
  ]);

  const ownSet = new Set(
    (ownIds ?? []).map((r) => r.id).filter((id): id is string => !!id)
  );

  const isToday = dayKey(anchor) === dayKey(new Date());
  const dayLabel = isToday ? `Hoy, ${formatDayLabel(anchor)}` : formatDayLabel(anchor);

  const visibleSpaces = (spaces ?? []).filter((s) => s.status !== "disabled");

  const bookingBlocks = (bookings ?? [])
    .filter((b): b is BookingRow & { id: string; space_id: string; starts_at: string; ends_at: string; status: string } =>
      !!(b.id && b.space_id && b.starts_at && b.ends_at && b.status)
    )
    .map((b) => ({
      id: b.id,
      space_id: b.space_id,
      space_name: visibleSpaces.find((s) => s.id === b.space_id)?.name ?? "",
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      display_owner: b.display_owner,
      use_type: b.use_type,
      title: b.title,
      isOwn: ownSet.has(b.id),
    }));

  return (
    <main className="min-h-dvh flex flex-col">
      <EventosEspacios actual="espacios" />
      <div className="flex-1 px-4 pt-6 pb-4 max-w-md md:max-w-[1180px] md:px-[clamp(12px,3vw,40px)] mx-auto w-full flex flex-col gap-4">
        <h1 className="page-title md:hidden">Reservas</h1>
        <ReservasDayView
          spaces={visibleSpaces}
          bookings={bookingBlocks}
          dayLabel={dayLabel}
          prevDate={prevDate}
          nextDate={nextDate}
          dateParam={dateParam}
        />
      </div>
    </main>
  );
}
