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

// Timeline: 8 AM–9 PM en Bogotá
const HOUR_START = 8;
const HOUR_END = 21;
const RANGE_MINS = (HOUR_END - HOUR_START) * 60;
const HOUR_LABELS = [
  { label: "8 am", pct: 0 },
  { label: "12 m", pct: ((12 - HOUR_START) / (HOUR_END - HOUR_START)) * 100 },
  { label: "4 pm", pct: ((16 - HOUR_START) / (HOUR_END - HOUR_START)) * 100 },
  { label: "9 pm", pct: 100 },
];

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function bogotaHHMM(iso: string): { h: number; m: number } {
  const date = new Date(iso);
  const str = date.toLocaleString("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = str.split(":").map(Number);
  return { h, m };
}

function toTimeline(iso: string): number {
  const { h, m } = bogotaHHMM(iso);
  return Math.max(0, Math.min(100, (((h - HOUR_START) * 60 + m) / RANGE_MINS) * 100));
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

type SpaceRow = {
  id: string;
  name: string;
  status: string;
};

type BookingRow = {
  id: string | null;
  space_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  display_owner: string | null;
  use_type: string | null;
};

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
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
      .select("id, space_id, starts_at, ends_at, status, display_owner, use_type")
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

  const bySpace = new Map<string, BookingRow[]>();
  for (const b of bookings ?? []) {
    if (!b.space_id) continue;
    const arr = bySpace.get(b.space_id) ?? [];
    arr.push(b as BookingRow);
    bySpace.set(b.space_id, arr);
  }

  const isToday = dayKey(anchor) === dayKey(new Date());
  const dayLabel = isToday ? `Hoy, ${formatDayLabel(anchor)}` : formatDayLabel(anchor);

  const visibleSpaces = (spaces ?? []).filter(
    (s) => s.status !== "disabled"
  ) as SpaceRow[];

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
          <span
            className="flex-1 text-center text-sm py-1.5 rounded-[7px] font-semibold"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Día
          </span>
          <Link
            href={`/reservas?date=${dateParam}&view=mes`}
            className="flex-1 text-center text-sm py-1.5 rounded-[7px]"
            style={{ color: "var(--color-muted)" }}
          >
            Mes
          </Link>
        </div>

        {/* Day navigator */}
        <div
          className="flex items-center justify-between rounded-[10px] p-[6px]"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
        >
          <Link
            href={`/reservas?date=${prevDate}`}
            className="w-10 h-10 inline-flex items-center justify-center rounded-[8px] border text-lg"
            style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
            aria-label="Día anterior"
          >
            ‹
          </Link>
          <span
            className="font-semibold text-[15px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {dayLabel}
          </span>
          <Link
            href={`/reservas?date=${nextDate}`}
            className="w-10 h-10 inline-flex items-center justify-center rounded-[8px] border text-lg"
            style={{ borderColor: "var(--color-line)", color: "var(--color-muted)" }}
            aria-label="Día siguiente"
          >
            ›
          </Link>
        </div>

        {/* Hour labels */}
        <div
          className="flex justify-between text-[11px] px-[92px]"
          style={{ color: "var(--color-muted)" }}
        >
          {HOUR_LABELS.map((h) => (
            <span key={h.label}>{h.label}</span>
          ))}
        </div>

        {/* Space rows */}
        <div className="flex flex-col gap-2">
          {visibleSpaces.map((space) => {
            const unavailable = space.status === "maintenance";
            const spaceBookings = bySpace.get(space.id) ?? [];

            if (unavailable) {
              return (
                <div
                  key={space.id}
                  className="rounded-[10px] px-3 py-3 flex items-center gap-[10px]"
                  style={{
                    background: "var(--color-surface-2)",
                    border: "1px dashed var(--color-line)",
                    color: "var(--color-muted)",
                  }}
                >
                  <span className="w-[80px] flex-none font-semibold text-sm">{space.name}</span>
                  <span className="text-[12.5px]">No disponible por ahora</span>
                </div>
              );
            }

            const hasOwn = spaceBookings.some((b) => b.id && ownSet.has(b.id));

            return (
              <div
                key={space.id}
                className="card px-3 py-3 flex flex-col gap-2"
                style={hasOwn ? { borderColor: "var(--color-accent)" } : undefined}
              >
                <div className="flex items-center gap-[10px]">
                  <span className="w-[80px] flex-none font-semibold text-sm">{space.name}</span>
                  <div
                    className="relative flex-1 rounded-[6px] overflow-hidden"
                    style={{ height: "28px", background: "var(--color-surface-2)" }}
                  >
                    {spaceBookings.map((b, idx) => {
                      if (!b.starts_at || !b.ends_at) return null;
                      const left = toTimeline(b.starts_at);
                      const right = toTimeline(b.ends_at);
                      const width = Math.max(1, right - left);
                      const isOwn = !!b.id && ownSet.has(b.id);
                      const blockColor = isOwn
                        ? "#2F5E9E"
                        : b.status === "requested"
                        ? "var(--color-gold)"
                        : "var(--color-accent)";

                      const block = (
                        <span
                          className="absolute top-0 bottom-0 rounded-[6px] block"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: blockColor,
                            cursor: b.id ? "pointer" : "default",
                          }}
                          title={`${b.display_owner ?? "—"} · ${
                            b.use_type ? (USE_TYPE_LABELS[b.use_type] ?? b.use_type) : ""
                          }`}
                        />
                      );
                      return b.id ? (
                        <Link key={b.id} href={`/reservas/${b.id}`}>
                          {block}
                        </Link>
                      ) : (
                        <span key={idx}>{block}</span>
                      );
                    })}
                  </div>
                </div>

                {spaceBookings.length > 0 && (
                  <p className="text-[12.5px] pl-[90px]" style={{ color: "#3E4A45" }}>
                    {spaceBookings.map((b, i) => {
                      if (!b.starts_at) return null;
                      const time = new Date(b.starts_at).toLocaleTimeString("es-CO", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "America/Bogota",
                      });
                      const isOwn = !!b.id && ownSet.has(b.id);
                      return (
                        <span key={b.id ?? i}>
                          {i > 0 && " · "}
                          {time}{" "}
                          {isOwn ? (
                            <b>tu reserva: {b.display_owner}</b>
                          ) : b.use_type ? (
                            USE_TYPE_LABELS[b.use_type] ?? b.use_type
                          ) : (
                            b.display_owner
                          )}
                        </span>
                      );
                    })}
                  </p>
                )}
              </div>
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
            Ministerios
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <span
              className="w-[10px] h-[10px] rounded-[3px] inline-block"
              style={{ background: "#2F5E9E" }}
            />
            Tus reservas
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
