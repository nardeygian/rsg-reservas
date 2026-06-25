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
  approved: "border-[color:var(--color-sage-200)]",
  requested: "border-[color:#f3ecdc]",
};

export function BookingCard({ booking }: { booking: CalendarBooking }) {
  if (!booking.starts_at || !booking.ends_at) return null;

  const useTypeLabel = booking.use_type
    ? USE_TYPE_LABELS[booking.use_type] ?? booking.use_type
    : null;

  const statusClass = STATUS_STYLES[booking.status ?? ""] ?? "border-line";

  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm tabular-nums text-forest-500 dark:text-sage-400">
          {formatTime(booking.starts_at)} – {formatTime(booking.ends_at)}
        </span>
        {booking.status === "requested" && (
          <span className="badge badge-pending">Por aprobar</span>
        )}
      </div>
      <p className="font-serif text-lg truncate mt-1">
        {booking.display_owner ?? "—"}
      </p>
      <p className="text-xs text-fg2 truncate">
        {booking.space_name}
        {useTypeLabel && <span> · {useTypeLabel}</span>}
        {booking.has_montaje_lock && <span> · 🔒 montaje</span>}
      </p>
    </>
  );

  const baseClass = `rounded-[14px] border bg-bg-elev px-3 py-3 text-sm ${statusClass}`;

  if (!booking.id) {
    return <article className={baseClass}>{inner}</article>;
  }

  return (
    <Link
      href={`/reservas/${booking.id}`}
      className={`${baseClass} block transition hover:shadow-md hover:-translate-y-[2px]`}
    >
      {inner}
    </Link>
  );
}
