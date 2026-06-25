// Ocurrencias semanales. Bogotá está en UTC-5 sin DST, así que sumar 7×24h
// es seguro y no desplaza la hora local. Si algún día existiera DST esto
// tendría que volverse hora-local-aware.

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type Occurrence = { start: Date; end: Date };

// Genera ocurrencias semanales desde (firstStart, firstEnd) inclusive hasta
// el instante UTC `untilExclusive`. Si limit cap se alcanza primero, corta ahí.
export function weeklyOccurrences(
  firstStart: Date,
  firstEnd: Date,
  untilExclusive: Date,
  maxCount: number = 60
): Occurrence[] {
  const out: Occurrence[] = [];
  let sMs = firstStart.getTime();
  let eMs = firstEnd.getTime();
  const limitMs = untilExclusive.getTime();

  while (sMs < limitMs && out.length < maxCount) {
    out.push({ start: new Date(sMs), end: new Date(eMs) });
    sMs += ONE_WEEK_MS;
    eMs += ONE_WEEK_MS;
  }

  return out;
}

// Compone una RRULE textual mínima estilo iCalendar para guardar en el
// template. No la parseamos de vuelta — sirve como documentación del patrón.
export function weeklyRrule(untilExclusive: Date): string {
  // FORMAT en UTC: YYYYMMDDTHHMMSSZ
  const yyyy = untilExclusive.getUTCFullYear();
  const mm = String(untilExclusive.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(untilExclusive.getUTCDate()).padStart(2, "0");
  const hh = String(untilExclusive.getUTCHours()).padStart(2, "0");
  const mi = String(untilExclusive.getUTCMinutes()).padStart(2, "0");
  const ss = String(untilExclusive.getUTCSeconds()).padStart(2, "0");
  return `FREQ=WEEKLY;UNTIL=${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
