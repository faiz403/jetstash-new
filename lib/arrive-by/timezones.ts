import type { ZonedDateTime } from './types';

/**
 * Timezone safety for Arrive By.
 *
 * No file in this codebase carries IANA timezone data today (confirmed by
 * inspection: neither data/airports.ts nor data/destinations.ts has a
 * timezone field — every existing date display, e.g.
 * lib/route-status-copy.ts's formatDate, only ever formats a date-only ISO
 * string with a fixed T12:00:00Z anchor, and never does real local-time
 * arithmetic). This module is Arrive By's own, deliberately small,
 * explicit mapping — scoped only to the airports/destinations this MVP
 * actually supports (lib/arrive-by/route-support.ts) — plus a pure,
 * dependency-free conversion layer.
 *
 * No timezone library was added. Node's `Intl` (ECMA-402) ships with full
 * ICU data by default in every Node version this project targets, so
 * `Intl.DateTimeFormat` already resolves any real IANA zone correctly,
 * including its historical and future DST transitions — a small dependency
 * would only wrap the same platform capability this module already uses
 * directly. If a future stage needs broader IANA coverage than a short,
 * explicit map can reasonably hold, that is the point to stop and ask
 * before adding one, per the Stage 1 brief.
 */

/** UK airports Arrive By currently supports — every one uses the single UK IANA zone, DST included. */
const AIRPORT_TIME_ZONES: Record<string, string> = {
  manchester: 'Europe/London',
};

/** Destinations Arrive By currently supports. Values are the destination's real, well-known IANA identifier — never invented, never a fixed UTC offset. */
const DESTINATION_TIME_ZONES: Record<string, string> = {
  dubai: 'Asia/Dubai',
  lahore: 'Asia/Karachi',
  islamabad: 'Asia/Karachi',
  dhaka: 'Asia/Dhaka',
  delhi: 'Asia/Kolkata',
  mumbai: 'Asia/Kolkata',
};

/** Real check, not a lookup-table trust exercise — confirms Intl can actually resolve the zone in this runtime. */
function isResolvableTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getAirportTimeZone(airportSlug: string): string | null {
  const tz = AIRPORT_TIME_ZONES[airportSlug];
  if (!tz || !isResolvableTimeZone(tz)) return null;
  return tz;
}

export function getDestinationTimeZone(destinationSlug: string): string | null {
  const tz = DESTINATION_TIME_ZONES[destinationSlug];
  if (!tz || !isResolvableTimeZone(tz)) return null;
  return tz;
}

// ── Date/time validation ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Strict — rejects e.g. '2026-02-30' (real calendar overflow), not just malformed shape. */
export function isValidLocalDate(dateIso: string): boolean {
  if (!DATE_RE.test(dateIso)) return false;
  const [y, m, d] = dateIso.split('-').map(Number);
  const asUtc = new Date(Date.UTC(y, m - 1, d));
  return asUtc.getUTCFullYear() === y && asUtc.getUTCMonth() === m - 1 && asUtc.getUTCDate() === d;
}

export function isValidLocalTime(timeHHmm: string): boolean {
  if (!TIME_RE.test(timeHHmm)) return false;
  const [h, m] = timeHHmm.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// ── Zoned <-> UTC conversion ────────────────────────────────────────────

/**
 * The real UTC offset (in minutes, positive = ahead of UTC) of `timeZone`
 * at the instant `utcMs`. Implemented by re-reading `utcMs` as if it were a
 * wall-clock time already IN `timeZone` (via Intl.DateTimeFormat), then
 * diffing that reinterpretation against the real instant — the standard
 * offset-probe technique used by full timezone libraries, built here
 * directly on Intl rather than pulling one in.
 */
function getOffsetMinutesAt(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asIfUtc - utcMs) / 60000);
}

export interface ZonedConversionResult {
  utcIso: string;
  /**
   * True when the requested local wall-clock time falls in a daylight-saving
   * transition (a skipped "spring forward" hour, or a repeated "fall back"
   * hour) for `timeZone`. The returned instant is still a reasonable
   * best-effort interpretation; callers should surface this as a planning
   * warning rather than a hard failure — the deadline itself is still
   * meaningful even when the exact UTC instant is DST-ambiguous by up to an
   * hour.
   */
  dstTransitionAmbiguous: boolean;
}

/** Does re-formatting `utcMs` in `timeZone` reproduce the exact requested wall-clock date+time? */
function roundTripsTo(utcMs: number, timeZone: string, dateIso: string, timeHHmm: string): boolean {
  const roundTrip = utcToZoned(new Date(utcMs).toISOString(), timeZone);
  return roundTrip.dateIso === dateIso && roundTrip.timeHHmm === timeHHmm;
}

/**
 * Converts a local wall-clock date+time in `timeZone` to a real UTC
 * instant.
 *
 * A single offset probe cannot detect DST ambiguity: a "fall back" repeated
 * hour has TWO different real UTC instants that both correctly round-trip
 * back to the same requested wall-clock time (whichever one a naive probe
 * lands on looks perfectly self-consistent on its own) — the ambiguity is
 * that a *different* instant is equally valid, which only shows up by
 * checking both sides of a nearby transition explicitly. This probes the
 * offset well clear of the guess on both sides (+/- 3 hours, safely outside
 * any real transition's own duration) to detect a nearby change, then
 * tests both candidate offsets' resulting instants against the requested
 * wall-clock time:
 *   - both match  -> a genuinely ambiguous "fall back" repeated hour.
 *   - neither matches -> a genuinely nonexistent "spring forward" gap hour.
 *   - exactly one matches -> the ordinary, unambiguous case (including
 *     ordinary DST offset changes across the year, away from the
 *     transition boundary itself).
 */
export function zonedTimeToUtc(dateIso: string, timeHHmm: string, timeZone: string): ZonedConversionResult {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const [h, mi] = timeHHmm.split(':').map(Number);
  const guessUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0);
  const PROBE_MS = 3 * 60 * 60000;

  const offsetBefore = getOffsetMinutesAt(guessUtcMs - PROBE_MS, timeZone);
  const offsetAfter = getOffsetMinutesAt(guessUtcMs + PROBE_MS, timeZone);

  if (offsetBefore === offsetAfter) {
    // No nearby transition — the ordinary case.
    const utcMs = guessUtcMs - offsetBefore * 60000;
    return { utcIso: new Date(utcMs).toISOString(), dstTransitionAmbiguous: false };
  }

  const candidateBeforeUtcMs = guessUtcMs - offsetBefore * 60000;
  const candidateAfterUtcMs = guessUtcMs - offsetAfter * 60000;
  const beforeMatches = roundTripsTo(candidateBeforeUtcMs, timeZone, dateIso, timeHHmm);
  const afterMatches = roundTripsTo(candidateAfterUtcMs, timeZone, dateIso, timeHHmm);

  if (beforeMatches && !afterMatches) {
    return { utcIso: new Date(candidateBeforeUtcMs).toISOString(), dstTransitionAmbiguous: false };
  }
  if (afterMatches && !beforeMatches) {
    return { utcIso: new Date(candidateAfterUtcMs).toISOString(), dstTransitionAmbiguous: false };
  }
  if (beforeMatches && afterMatches) {
    // Genuinely ambiguous (repeated hour) — prefer the later, safer instant for a deadline-planning tool.
    const chosen = Math.max(candidateBeforeUtcMs, candidateAfterUtcMs);
    return { utcIso: new Date(chosen).toISOString(), dstTransitionAmbiguous: true };
  }
  // Neither matches: a nonexistent (spring-forward gap) local time. Best-effort: the later candidate.
  const chosen = Math.max(candidateBeforeUtcMs, candidateAfterUtcMs);
  return { utcIso: new Date(chosen).toISOString(), dstTransitionAmbiguous: true };
}

/** Converts a real UTC instant to its local wall-clock date+time in `timeZone`. */
export function utcToZoned(utcIso: string, timeZone: string): { dateIso: string; timeHHmm: string } {
  const utcMs = new Date(utcIso).getTime();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    dateIso: `${get('year')}-${get('month')}-${get('day')}`,
    timeHHmm: `${get('hour')}:${get('minute')}`,
  };
}

/** Builds a full ZonedDateTime from a UTC instant, for a given display zone. */
export function toZonedDateTime(utcIso: string, timeZone: string): ZonedDateTime {
  const { dateIso, timeHHmm } = utcToZoned(utcIso, timeZone);
  return { dateIso, timeHHmm, timeZone, utcIso };
}

/** Adds `minutes` (may be negative) to a UTC instant, returning the new instant. */
export function addMinutesUtc(utcIso: string, minutes: number): string {
  return new Date(new Date(utcIso).getTime() + minutes * 60000).toISOString();
}

/** Whole-day difference between two UTC instants' LOCAL calendar dates in the same `timeZone` — used to bucket departure timing relative to the arrival deadline. Positive when `laterUtcIso` falls on a later local calendar date. */
export function localCalendarDayDiff(earlierUtcIso: string, laterUtcIso: string, timeZone: string): number {
  const toDayMs = (dateIso: string): number => {
    const [y, mo, d] = dateIso.split('-').map(Number);
    return Date.UTC(y, mo - 1, d);
  };
  const a = toDayMs(utcToZoned(earlierUtcIso, timeZone).dateIso);
  const b = toDayMs(utcToZoned(laterUtcIso, timeZone).dateIso);
  return Math.round((b - a) / 86400000);
}
