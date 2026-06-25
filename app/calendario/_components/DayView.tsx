import { BookingCard, type CalendarBooking } from "./BookingCard";

export function DayView({ bookings }: { bookings: CalendarBooking[] }) {
  if (bookings.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        No hay reservas este día.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {bookings.map((b) => (
        <li key={b.id ?? `${b.starts_at}-${b.space_id}`}>
          <BookingCard booking={b} />
        </li>
      ))}
    </ul>
  );
}
