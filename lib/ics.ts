import { formatIcsUtc } from "./datetime";

// Escape de TEXT en RFC 5545: backslash, coma, punto y coma y newline.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

const STATUS_MAP: Record<string, "TENTATIVE" | "CONFIRMED" | "CANCELLED"> = {
  requested: "TENTATIVE",
  approved: "CONFIRMED",
  rejected: "CANCELLED",
  cancelled: "CANCELLED",
};

export type IcsEvent = {
  uid: string;
  startsAt: Date | string;
  endsAt: Date | string;
  summary: string;
  status: string;
  location?: string | null;
  description?: string | null;
  dtstamp?: Date;
};

export function buildIcsCalendar(events: IcsEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RSG Reservas//ES",
    "CALSCALE:GREGORIAN",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${formatIcsUtc(ev.dtstamp ?? new Date())}`);
    lines.push(`DTSTART:${formatIcsUtc(ev.startsAt)}`);
    lines.push(`DTEND:${formatIcsUtc(ev.endsAt)}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.summary)}`);
    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    }
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    lines.push(`STATUS:${STATUS_MAP[ev.status] ?? "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 exige CRLF.
  return lines.join("\r\n") + "\r\n";
}
