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
  discipulado: "Reunión de discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
};

export function BookingCard({
  booking,
  isOwn = false,
}: {
  booking: CalendarBooking;
  isOwn?: boolean;
}) {
  if (!booking.starts_at || !booking.ends_at) return null;

  const useTypeLabel = booking.use_type
    ? USE_TYPE_LABELS[booking.use_type] ?? booking.use_type
    : null;

  const isPending = booking.status === "requested";

  // Dot color: azul = reserva propia, verde = otras aprobadas, amarillo = pendiente
  const dotColor = isOwn
    ? "#2F5E9E"
    : isPending
      ? "var(--color-gold)"
      : "var(--color-accent)";

  // Dot shape: cuadrado redondeado para reservas (igual al prototipo de Calendario)
  const dotRadius = isOwn ? "3px" : "50%";

  const subtitle = [
    booking.space_name,
    useTypeLabel,
    booking.has_montaje_lock ? "🔒 montaje" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <div className="flex gap-[10px] items-start">
      <span
        className="flex-none mt-[5px]"
        style={{
          width: "10px",
          height: "10px",
          borderRadius: dotRadius,
          background: dotColor,
        }}
        aria-hidden="true"
      />
      <div className="flex flex-col min-w-0">
        <b
          className="leading-snug truncate"
          style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}
        >
          {booking.display_owner ?? "—"}
        </b>
        <span className="text-[13px] truncate mt-[1px]" style={{ color: "var(--color-muted)" }}>
          {booking.space_name && useTypeLabel
            ? `${booking.space_name} · ${useTypeLabel}`
            : (subtitle || "—")}
        </span>
        <span className="text-[13px] tabular-nums mt-[1px]" style={{ color: "var(--color-muted)" }}>
          {formatTime(booking.starts_at)} – {formatTime(booking.ends_at)}
          {isPending && (
            <span
              className="ml-2 inline-flex items-center px-2 py-[1px] rounded-full text-[11px] font-semibold"
              style={{
                background: "var(--color-gold-soft)",
                color: "var(--color-gold-text)",
              }}
            >
              Por aprobar
            </span>
          )}
        </span>
      </div>
    </div>
  );

  const cardStyle = {
    background: "var(--color-surface)",
    borderColor: isOwn
      ? "#2F5E9E"
      : isPending
        ? "var(--color-gold)"
        : "var(--color-line)",
  };

  const className = "card block px-[14px] py-3";

  if (!booking.id) {
    return (
      <article className={className} style={cardStyle}>
        {inner}
      </article>
    );
  }

  return (
    <Link
      href={`/reservas/${booking.id}`}
      className={`${className} transition hover:-translate-y-[1px]`}
      style={cardStyle}
    >
      {inner}
    </Link>
  );
}
