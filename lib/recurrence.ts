import { addMonths } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const TZ = "America/Bogota";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "custom";

export type RecurrencePattern =
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "monthly" }
  | { kind: "custom"; byday: number[] }; // 0=Domingo..6=Sábado

export type Occurrence = { start: Date; end: Date };

export const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  daily: "diaria",
  weekly: "semanal",
  monthly: "mensual",
  custom: "personalizada",
};

// Devuelve el día de la semana 0-6 (domingo=0) en hora local de Bogotá.
export function getBogotaWeekday(d: Date): number {
  return toZonedTime(d, TZ).getDay();
}

function addMonthsInBogota(d: Date, n: number): Date {
  const local = toZonedTime(d, TZ);
  return fromZonedTime(addMonths(local, n), TZ);
}

// Genera la lista de ocurrencias según el patrón hasta `untilExclusive`.
// La primera ocurrencia siempre es (firstStart, firstEnd). Para patrones
// "custom" la primera debe caer en uno de los byday — la action valida eso
// antes de llamar acá.
export function generateOccurrences(
  firstStart: Date,
  firstEnd: Date,
  untilExclusive: Date,
  pattern: RecurrencePattern,
  maxCount: number = 365
): Occurrence[] {
  const out: Occurrence[] = [];
  const limit = untilExclusive.getTime();

  if (pattern.kind === "monthly") {
    let s = firstStart;
    let e = firstEnd;
    while (s.getTime() < limit && out.length < maxCount) {
      out.push({ start: s, end: e });
      s = addMonthsInBogota(s, 1);
      e = addMonthsInBogota(e, 1);
    }
    return out;
  }

  if (pattern.kind === "custom") {
    let sMs = firstStart.getTime();
    let eMs = firstEnd.getTime();
    while (sMs < limit && out.length < maxCount) {
      const dow = getBogotaWeekday(new Date(sMs));
      if (pattern.byday.includes(dow)) {
        out.push({ start: new Date(sMs), end: new Date(eMs) });
      }
      sMs += ONE_DAY_MS;
      eMs += ONE_DAY_MS;
    }
    return out;
  }

  // daily / weekly: paso fijo en milisegundos. Bogotá no tiene DST, por eso
  // sumar 24h o 7×24h es seguro y mantiene la hora local.
  const step = pattern.kind === "daily" ? ONE_DAY_MS : 7 * ONE_DAY_MS;
  let sMs = firstStart.getTime();
  let eMs = firstEnd.getTime();
  while (sMs < limit && out.length < maxCount) {
    out.push({ start: new Date(sMs), end: new Date(eMs) });
    sMs += step;
    eMs += step;
  }
  return out;
}

// RRULE textual estilo iCalendar para guardar en el template como documentación.
export function recurrenceRrule(
  pattern: RecurrencePattern,
  untilExclusive: Date
): string {
  const until = formatRruleDate(untilExclusive);
  switch (pattern.kind) {
    case "daily":
      return `FREQ=DAILY;UNTIL=${until}`;
    case "weekly":
      return `FREQ=WEEKLY;UNTIL=${until}`;
    case "monthly":
      return `FREQ=MONTHLY;UNTIL=${until}`;
    case "custom": {
      const dayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const byday = pattern.byday
        .slice()
        .sort()
        .map((d) => dayCodes[d])
        .join(",");
      return `FREQ=WEEKLY;BYDAY=${byday};UNTIL=${until}`;
    }
  }
}

function formatRruleDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}
