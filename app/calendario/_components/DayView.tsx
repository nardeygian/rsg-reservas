import { BookingCard, type CalendarBooking } from "./BookingCard";

export function DayView({
  bookings,
  ownBookingIds,
}: {
  bookings: CalendarBooking[];
  ownBookingIds: Set<string>;
}) {
  if (bookings.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--color-faint)" }}>
        No hay reservas este día.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {bookings.map((b) => (
        <li key={b.id ?? `${b.starts_at}-${b.space_id}`}>
          <BookingCard booking={b} isOwn={!!b.id && ownBookingIds.has(b.id)} />
        </li>
      ))}
    </ul>
  );
}
