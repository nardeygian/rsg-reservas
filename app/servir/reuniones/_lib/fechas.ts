import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

// Utilidades de fecha del módulo Servir. meeting_date es un día de Bogotá
// ("YYYY-MM-DD"); starts_at/ends_at son instantes UTC.

export const TZ = "America/Bogota";
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}(:\d{2})?$/;

export function esFecha(v: unknown): v is string {
  return typeof v === "string" && RE_FECHA.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
}

export function esHora(v: unknown): v is string {
  return typeof v === "string" && RE_HORA.test(v);
}

export function hoyBogota(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

// Fecha + hora de Bogotá → ISO UTC.
export function instanteBogota(fecha: string, hora: string): string {
  const h = hora.length === 5 ? `${hora}:00` : hora;
  return fromZonedTime(`${fecha}T${h}`, TZ).toISOString();
}

export function horaBogota(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "HH:mm");
}

// Misma hora del día en otra fecha (para duplicar y reprogramar).
export function moverAFecha(iso: string, fecha: string): string {
  return instanteBogota(fecha, formatInTimeZone(new Date(iso), TZ, "HH:mm:ss"));
}

// Día de la semana (0 = domingo) de una fecha "YYYY-MM-DD".
export function diaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

export function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Todas las fechas entre desde y hasta (inclusive) que caen en esos días.
export function fechasEnSerie(desde: string, hasta: string, dias: number[]): string[] {
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta || dias.length === 0) return [];
  const out: string[] = [];
  for (let f = desde; f <= hasta && out.length < 120; f = sumarDias(f, 1)) {
    if (dias.includes(diaSemana(f))) out.push(f);
  }
  return out;
}

export function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function fechaCorta(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

// 3725 → "1:02:05"; 300 → "5:00"
export function duracion(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
