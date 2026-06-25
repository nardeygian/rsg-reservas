"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  dayKey,
  endOfDayBogota,
  formatDateShort,
  formatTime,
  isTodayBogota,
  startOfDayBogota,
} from "@/lib/datetime";

type BusySlot = { id: string; starts_at: string; ends_at: string };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_AHEAD = 7;

export function SpaceAvailability({ spaceId }: { spaceId: string }) {
  const [slots, setSlots] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spaceId) return;
    setLoading(true);
    const supabase = createClient();
    const fromUtc = startOfDayBogota(new Date()).toISOString();
    const toUtc = endOfDayBogota(
      new Date(Date.now() + (DAYS_AHEAD - 1) * ONE_DAY_MS)
    ).toISOString();

    let cancelled = false;
    supabase
      .from("busy_slots")
      .select("id, starts_at, ends_at")
      .eq("space_id", spaceId)
      .gte("starts_at", fromUtc)
      .lt("starts_at", toUtc)
      .order("starts_at")
      .then(({ data }) => {
        if (cancelled) return;
        setSlots(
          (data ?? []).map((d) => ({
            id: d.id ?? "",
            starts_at: d.starts_at ?? "",
            ends_at: d.ends_at ?? "",
          }))
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const days: Date[] = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDay = new Map<string, BusySlot[]>();
  for (const s of slots) {
    const k = dayKey(s.starts_at);
    const arr = byDay.get(k) ?? [];
    arr.push(s);
    byDay.set(k, arr);
  }

  return (
    <details className="rounded-md border border-gray-200 dark:border-gray-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Ver disponibilidad próximos {DAYS_AHEAD} días
        {loading && (
          <span className="ml-2 text-xs text-gray-500 font-normal">
            cargando…
          </span>
        )}
      </summary>
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-2">
        {days.map((d) => {
          const k = dayKey(d);
          const items = byDay.get(k) ?? [];
          const today = isTodayBogota(d);
          return (
            <div key={k} className="text-sm">
              <p
                className={`text-xs uppercase tracking-wide ${
                  today
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-500"
                }`}
              >
                {formatDateShort(d)}
                {today && <span className="ml-1">· hoy</span>}
              </p>
              {items.length === 0 ? (
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                  ● Libre todo el día
                </p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className="text-xs tabular-nums rounded bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 px-2 py-0.5"
                    >
                      {formatTime(s.starts_at)} – {formatTime(s.ends_at)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
