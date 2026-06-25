import Link from "next/link";
import { formatTime } from "@/lib/datetime";

export type CalendarBooking = {
  id: string | null;
  space_id: string | null;
  space_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  display_owner: string | null;
  use_type: string | null;
  has_montaje_lock: boolean | null;
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

const STATUS_STYLES: Record<string, string> = {
  approved:
    "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
  requested:
    "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
};

export function BookingCard({ booking }: { booking: CalendarBooking }) {
  if (!booking.starts_at || !booking.ends_at) return null;

  const useTypeLabel = booking.use_type
    ? USE_TYPE_LABELS[booking.use_type] ?? booking.use_type
    : null;

  const statusClass =
    STATUS_STYLES[booking.status ?? ""] ??
    "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40";

  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium tabular-nums">
          {formatTime(booking.starts_at)} – {formatTime(booking.ends_at)}
        </span>
        {booking.status === "requested" && (
          <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Por aprobar
          </span>
        )}
      </div>
      <p className="font-medium truncate">{booking.display_owner ?? "—"}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
        {booking.space_name}
        {useTypeLabel && <span> · {useTypeLabel}</span>}
        {booking.has_montaje_lock && <span> · 🔒 montaje</span>}
      </p>
    </>
  );

  const baseClass = `rounded-md border px-3 py-2 text-sm ${statusClass}`;

  if (!booking.id) {
    return <article className={baseClass}>{inner}</article>;
  }

  return (
    <Link
      href={`/reservas/${booking.id}`}
      className={`${baseClass} block transition hover:brightness-95 dark:hover:brightness-110`}
    >
      {inner}
    </Link>
  );
}
