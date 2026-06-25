import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const TZ = "America/Bogota";

// Lunes como inicio de semana (es-CO).
const WEEK_OPTS = { weekStartsOn: 1 as const };

// Convierte una fecha "YYYY-MM-DD" (interpretada como local de Bogotá) a un Date UTC
// que apunta a las 00:00 de ese día en Bogotá.
export function parseDateParam(value: string | undefined): Date {
  const today = new Date();
  if (!value) return startOfDayBogota(today);

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return startOfDayBogota(today);

  const [, y, m, d] = match;
  // 12:00 local para evitar bordes de DST/offset.
  return fromZonedTime(`${y}-${m}-${d}T12:00:00`, TZ);
}

// "YYYY-MM-DD" en hora de Bogotá, útil para enlaces.
export function toDateParam(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

// Bordes en hora de Bogotá: convertimos al "wall time" local, calculamos el
// borde con date-fns, y reinterpretamos ese instante como Bogotá → UTC.
export function startOfDayBogota(date: Date): Date {
  return fromZonedTime(startOfDay(toZonedTime(date, TZ)), TZ);
}

export function endOfDayBogota(date: Date): Date {
  return fromZonedTime(endOfDay(toZonedTime(date, TZ)), TZ);
}

export function startOfWeekBogota(date: Date): Date {
  return fromZonedTime(startOfWeek(toZonedTime(date, TZ), WEEK_OPTS), TZ);
}

export function endOfWeekBogota(date: Date): Date {
  return fromZonedTime(endOfWeek(toZonedTime(date, TZ), WEEK_OPTS), TZ);
}

export function startOfMonthBogota(date: Date): Date {
  return fromZonedTime(startOfMonth(toZonedTime(date, TZ)), TZ);
}

export function endOfMonthBogota(date: Date): Date {
  return fromZonedTime(endOfMonth(toZonedTime(date, TZ)), TZ);
}

// La cuadrícula del mes empieza el lunes anterior al día 1 y termina el domingo
// posterior al fin de mes; así llenamos exactamente 5 o 6 semanas.
export function monthGridRangeBogota(anchor: Date): { start: Date; end: Date } {
  return {
    start: startOfWeekBogota(startOfMonthBogota(anchor)),
    end: endOfWeekBogota(endOfMonthBogota(anchor)),
  };
}

export function addDaysBogota(date: Date, n: number): Date {
  const local = toZonedTime(date, TZ);
  return fromZonedTime(addDays(local, n), TZ);
}

export function addMonthsBogota(date: Date, n: number): Date {
  const local = toZonedTime(date, TZ);
  return fromZonedTime(addMonths(local, n), TZ);
}

// Lista de N días consecutivos a partir de `start` (inicio de día en Bogotá).
export function daysFrom(start: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => addDaysBogota(start, i));
}

// Formatos de presentación, todos en Bogotá y español.
export function formatTime(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "HH:mm");
}

export function formatDateLong(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "EEEE d 'de' MMMM, yyyy", {
    locale: es,
  });
}

export function formatDateShort(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "EEE d MMM", { locale: es });
}

export function formatMonthYear(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "MMMM yyyy", { locale: es });
}

export function formatDayNumber(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "d");
}

export function formatWeekRange(start: Date, end: Date): string {
  const startStr = formatInTimeZone(start, TZ, "d MMM", { locale: es });
  const endStr = formatInTimeZone(end, TZ, "d MMM yyyy", { locale: es });
  return `${startStr} – ${endStr}`;
}

// "YYYY-MM" para comparar si un día pertenece al mes ancla.
export function monthKey(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM");
}

// "YYYY-MM-DD" en Bogotá — clave estable para agrupar reservas por día.
export function dayKey(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM-dd");
}

export function isSameDayBogota(a: Date | string, b: Date | string): boolean {
  return dayKey(a) === dayKey(b);
}

export function isTodayBogota(date: Date | string): boolean {
  return dayKey(date) === dayKey(new Date());
}

// Para <input type="datetime-local">: produce "YYYY-MM-DDTHH:mm" en Bogotá.
export function toDatetimeLocalBogota(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm");
}

// Interpreta una cadena "YYYY-MM-DDTHH:mm" como hora local de Bogotá.
// Devuelve null si el formato no calza.
export function parseBogotaDatetimeLocal(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  return fromZonedTime(`${match[1]}T${match[2]}:00`, TZ);
}

// Formato UTC del .ics / iCalendar (RFC 5545): YYYYMMDDTHHmmssZ.
export function formatIcsUtc(date: Date | string): string {
  return formatInTimeZone(new Date(date), "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

// Devuelve "now" en Bogotá redondeado a la próxima hora completa.
export function nextHourBogota(now: Date = new Date()): Date {
  const local = toZonedTime(now, TZ);
  local.setMinutes(0, 0, 0);
  local.setHours(local.getHours() + 1);
  return fromZonedTime(local, TZ);
}
