/**
 * Local wall-clock <-> instant conversion for the full-journey model. Every
 * time a traveller types (a flight's departure, its landing, a deadline) is a
 * LOCAL time at a specific airport, so it must be read in that airport's IANA
 * zone -- never the server's or browser's -- and must be rejected when the
 * local time does not name exactly one instant:
 *
 *   nonexistent   spring-forward gap (e.g. 01:30 on the London clock-change day)
 *   ambiguous     fall-back repeat (e.g. 01:30 on the last Sunday of October)
 *
 * The older shared helper (shared/timezone.ts) resolves such inputs silently;
 * for a flight that would put a wrong instant into a whole-journey plan, so
 * this module fails closed instead.
 */

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** UTC offset (minutes) of an IANA zone at an instant. */
export function zoneOffsetMinutes(timeZone: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(atMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / 60000);
}

export type LocalTimeResult =
  | { ok: true; ms: number; iso: string }
  | { ok: false; reason: 'INVALID_FORMAT' | 'NONEXISTENT_LOCAL_TIME' | 'AMBIGUOUS_LOCAL_TIME' | 'INVALID_ZONE' };

export function parseLocalDateTime(value: string, timeZone: string): LocalTimeResult {
  const match = LOCAL_PATTERN.exec(value);
  if (!match) return { ok: false, reason: 'INVALID_FORMAT' };
  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const roundTrips = new Date(naiveUtc);
  if (roundTrips.getUTCFullYear() !== year || roundTrips.getUTCMonth() !== month - 1 || roundTrips.getUTCDate() !== day || roundTrips.getUTCHours() !== hour) {
    return { ok: false, reason: 'INVALID_FORMAT' }; // e.g. 2027-02-30 or hour 25
  }

  try {
    // Candidate offsets: the zone's offset a day before and a day after the naive instant covers every real transition.
    const offsets = new Set([zoneOffsetMinutes(timeZone, naiveUtc - 86400000), zoneOffsetMinutes(timeZone, naiveUtc + 86400000)]);
    const valid = new Set<number>();
    for (const offset of offsets) {
      const candidateMs = naiveUtc - offset * 60000;
      if (zoneOffsetMinutes(timeZone, candidateMs) === offset) valid.add(candidateMs);
    }
    if (valid.size === 0) return { ok: false, reason: 'NONEXISTENT_LOCAL_TIME' };
    if (valid.size > 1) return { ok: false, reason: 'AMBIGUOUS_LOCAL_TIME' };
    const [ms] = [...valid];
    return { ok: true, ms, iso: new Date(ms).toISOString() };
  } catch {
    return { ok: false, reason: 'INVALID_ZONE' };
  }
}

/** "YYYY-MM-DDTHH:MM" wall clock of an instant in a zone -- the inverse of parseLocalDateTime for unambiguous times. */
export function formatLocalDateTime(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Clock "HH:MM" of an instant in a zone, exact (no rounding). */
export function clockOf(ms: number, timeZone: string): string {
  return formatLocalDateTime(ms, timeZone).slice(11);
}

/** Rounds an instant DOWN to a whole number of minutes-multiples (default 5). Used for "leave by": earlier is the safe direction. */
export function floorToMinutes(ms: number, multiple = 5): number {
  const size = multiple * 60000;
  return Math.floor(ms / size) * size;
}
