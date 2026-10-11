import Link from "next/link";
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
  isTodayBogota,
  monthKey,
  formatMonthYear,
  formatDayNumber,
} from "@/lib/datetime";
import { ReservasDayView } from "./_components/ReservasDayView";

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

    const { data: monthBookings } = await supabase
      .from("bookings_calendar")
      .select("id, starts_at, status")
      .lt("starts_at", gridEnd.toISOString())
      .gte("starts_at", gridStart.toISOString())
      .in("status", ["requested", "approved"]);

    const bookingsByDay = new Map<string, { approved: number; pending: number }>();
    for (const b of monthBookings ?? []) {
      if (!b.starts_at) continue;
      const key = dayKey(b.starts_at);
      const cur = bookingsByDay.get(key) ?? { approved: 0, pending: 0 };
      if (b.status === "approved") cur.approved++;
      else cur.pending++;
      bookingsByDay.set(key, cur);
    }

    const prevMonthParam = toDateParam(startOfMonthBogota(addMonthsBogota(anchor, -1)));
    const nextMonthParam = toDateParam(startOfMonthBogota(addMonthsBogota(anchor, 1)));
    const anchorMonthKey = monthKey(anchor);

    return (
      <main className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg)" }}>
        <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-3">

          <header className="flex flex-col gap-0.5">
            <span className="eyebrow">Reservas de espacios</span>
            <h1
              className="text-[22px] font-semibold leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ¿Qué espacio necesitas?
            </h1>
          </header>

          {/* View toggle */}
          <div
            className="flex rounded-[10px] p-[4px] gap-1"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
          >
            <Link
              href={`/reservas?date=${toDateParam(anchor)}`}
              className="flex-1 text-center text-sm py-1.5 rounded-[7px]"
              style={{ color: "var(--color-muted)" }}
            >
              Día
            </Link>
            <span
              className="flex-1 text-center text-sm py-1.5 rounded-[7px] font-semibold"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              Mes
            </span>
          </div>

          {/* Month navigator */}
          <div
            className="flex items-center justify-between rounded-[10px] p-[6px]"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
          >
            <Link
              href={`/reservas?date=${prevMonthParam}&view=mes`}
              className="w-10 h-10 inline-flex items-center justify-center rounded-[8px] border text-lg"
              style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
              aria-label="Mes anterior"
            >
              ‹
            </Link>
            <span
              className="font-semibold text-[15px] capitalize"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatMonthYear(anchor)}
            </span>
            <Link
              href={`/reservas?date=${nextMonthParam}&view=mes`}
              className="w-10 h-10 inline-flex items-center justify-center rounded-[8px] border text-lg"
              style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
              aria-label="Mes siguiente"
            >
              ›
            </Link>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 text-center">
            {DAY_HEADERS.map((d) => (
              <span
                key={d}
                className="text-[11px] font-semibold py-1"
                style={{ color: "var(--color-muted)" }}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {gridDays.map((d) => {
              const key = dayKey(d);
              const inMonth = monthKey(d) === anchorMonthKey;
              const data = bookingsByDay.get(key);
              const isToday = isTodayBogota(d);

              return (
                <Link
                  key={key}
                  href={`/reservas?date=${key}`}
                  className="flex flex-col items-center py-1.5 gap-[3px] rounded-[8px]"
                  style={
                    isToday
                      ? { background: "var(--color-accent)", color: "#fff" }
                      : inMonth
                      ? { color: "var(--color-ink)" }
                      : { color: "var(--color-faint)" }
                  }
                >
                  <span className="text-sm font-semibold leading-none">{formatDayNumber(d)}</span>
                  {data && (
                    <div className="flex gap-[3px]">
                      {data.approved > 0 && (
                        <span
                          className="w-[5px] h-[5px] rounded-full block"
                          style={{
                            background: isToday
                              ? "rgba(255,255,255,0.75)"
                              : "var(--color-accent)",
                          }}
                        />
                      )}
                      {data.pending > 0 && (
                        <span
                          className="w-[5px] h-[5px] rounded-full block"
                          style={{
                            background: isToday
                              ? "rgba(255,255,255,0.75)"
                              : "var(--color-gold)",
                          }}
                        />
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap text-xs mt-1" style={{ color: "#3E4A45" }}>
            <span className="inline-flex items-center gap-[6px]">
              <span
                className="w-[10px] h-[10px] rounded-[3px] inline-block"
                style={{ background: "var(--color-accent)" }}
              />
              Aprobadas
            </span>
            <span className="inline-flex items-center gap-[6px]">
              <span
                className="w-[10px] h-[10px] rounded-[3px] inline-block"
                style={{ background: "var(--color-gold)" }}
              />
              Por aprobar
            </span>
          </div>

          <Link href="/reservas/nueva" className="btn-primary w-full mt-auto">
            Nueva reserva
          </Link>
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
    <main className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="flex-1 px-4 pt-5 pb-4 max-w-md mx-auto w-full flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <span className="eyebrow">Reservas de espacios</span>
          <h1
            className="text-[22px] font-semibold leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ¿Qué espacio necesitas?
          </h1>
        </header>
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
