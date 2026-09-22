import { utcToZoned, zonedTimeToUtc, toZonedDateTime } from './timezones';
import type { ZonedDateTime } from './types';
import type { MinuteRange } from './deadline-comparison';
import type { Place } from './door-to-door';

/**
 * Turn-up-and-go ground transport (Arrive By Type B).
 *
 * Some ground legs are genuinely timetabled — an intercity train leaves at
 * 05:48 and that departure is published, so a traveller can be told which
 * service to catch. Others are not: on a high-frequency metro the operator
 * may publish only an operating window ("05:00 to midnight") and, at best, a
 * headway band ("every 5-7 minutes"). For those, naming "the 20:43 train"
 * would be an invention, not a plan.
 *
 * This module models the second kind honestly. It answers the question the
 * evidence can actually support — IS THE SERVICE RUNNING WHEN YOU ARE READY,
 * and what does that imply for the deadline — without ever manufacturing an
 * individual departure. Where the evidence is too thin to produce an arrival
 * time at all, it says so and names the missing input rather than filling the
 * gap with a plausible-looking number.
 *
 * Nothing here is specific to any one operator or city. A finding about one
 * operator's currently published data is a finding about that evidence today,
 * not a permanent property of the service — operators and data feeds change,
 * and a leg can legitimately move from Type B to Type A if exact departures
 * later become available.
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * Where a planning input came from. `OFFICIAL` means the operator publishes
 * it; `ASSUMPTION` means a human entered it. The distinction is carried
 * through to the result so an assumption can never be silently promoted into
 * timetable truth.
 */
export type EvidenceClass = 'OFFICIAL' | 'ASSUMPTION';

export interface OperatingWindow {
  /** Local weekdays on which this window OPENS (a window that runs past midnight still belongs to its opening day). */
  days: Weekday[];
  /** Local HH:mm the service starts. */
  opens: string;
  /** Local HH:mm the service stops. */
  closes: string;
  /** True when `closes` falls on the day after `opens` (e.g. 05:00 -> 01:00, or 05:00 -> 00:00 midnight). */
  closesNextDay: boolean;
}

export interface TurnUpAndGoTransport {
  kind: 'turn-up-and-go';
  mode: 'metro' | 'urban rail' | 'frequent bus';
  from: Place;
  to: Place;
  /** Access allowance before boarding is possible (ticket hall, gateline, platform). */
  minimumBeforeDeparture: number | null;
  /** Published operating hours. Treated as OFFICIAL evidence. */
  operatingWindows: OperatingWindow[];
  /** End-to-end running time for this leg, if known. */
  journeyMinutes: number | null;
  journeyMinutesBasis: EvidenceClass;
  /** Officially published headway band, e.g. every 5-7 minutes. Null when the operator publishes none. */
  headwayMinutes: MinuteRange | null;
  /** Explicit entered wait allowance, used only when no official headway exists. */
  plannedWaitMinutes: number | null;
}

export type AvailabilityState = 'SERVICE AVAILABLE' | 'SERVICE CLOSED AT READY TIME';

export interface AvailabilityAssessment {
  state: AvailabilityState;
  /** Instant the traveller is ready to board, in the boarding stop's zone. */
  readyAt: ZonedDateTime;
  /** End of the operating window currently in force, when open. */
  windowClosesAt?: ZonedDateTime;
  /** Start of the next operating window, when closed and one is found. */
  nextOpening?: ZonedDateTime;
  /** Minutes from ready time until the next opening, when closed. */
  waitUntilOpeningMinutes?: number;
  /** True when a window boundary landed on a DST transition and is ambiguous by up to an hour. */
  dstAmbiguous: boolean;
  notes: string[];
}

/** A wait that is planned from evidence or an entered allowance — never a specific departure. */
export interface PlanningWait {
  /** Conservative planning wait in minutes, or null when nothing supports one. */
  minutes: number | null;
  basis: EvidenceClass | 'NONE';
  /** Human-readable, honest about what it is. */
  label: string;
}

const MINUTE = 60000;
const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Weekday of a plain calendar date, independent of any zone offset. */
export function weekdayOf(dateIso: string): Weekday {
  const [y, m, d] = dateIso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Calendar-date arithmetic that never touches wall-clock time. */
export function addCalendarDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-${String(moved.getUTCDate()).padStart(2, '0')}`;
}

export function validateTurnUpAndGo(transport: TurnUpAndGoTransport, prefix: string, errors: string[]): void {
  if (!transport.from.name.trim() || !transport.to.name.trim()) errors.push(`${prefix}: enter both stop/station names.`);
  if (transport.minimumBeforeDeparture === null || !Number.isSafeInteger(transport.minimumBeforeDeparture) || transport.minimumBeforeDeparture < 0 || transport.minimumBeforeDeparture > 10080) {
    errors.push(`${prefix}: enter the station access allowance, including an explicit 0 if none.`);
  }
  if (!transport.operatingWindows.length) errors.push(`${prefix}: NO OPERATING WINDOW PROVIDED. Turn-up-and-go transport needs published operating hours.`);
  if (transport.operatingWindows.length > 8) errors.push(`${prefix}: enter at most eight operating windows.`);
  for (const window of transport.operatingWindows) {
    if (!window.days.length) errors.push(`${prefix}: each operating window needs at least one weekday.`);
    if (!HHMM.test(window.opens) || !HHMM.test(window.closes)) errors.push(`${prefix}: operating windows need valid 24h HH:mm opening and closing times.`);
    else if (!window.closesNextDay && window.closes <= window.opens) {
      errors.push(`${prefix}: a window closing at or before it opens must be marked as closing the next day.`);
    }
  }
  if (transport.journeyMinutes !== null && (!Number.isSafeInteger(transport.journeyMinutes) || transport.journeyMinutes <= 0 || transport.journeyMinutes > 10080)) {
    errors.push(`${prefix}: journey duration must be whole minutes above zero, or left unknown.`);
  }
  const headway = transport.headwayMinutes;
  if (headway && (!Number.isSafeInteger(headway.min) || !Number.isSafeInteger(headway.max) || headway.min <= 0 || headway.max < headway.min || headway.max > 10080)) {
    errors.push(`${prefix}: headway must be a valid minute range, or left unknown.`);
  }
  if (transport.plannedWaitMinutes !== null && (!Number.isSafeInteger(transport.plannedWaitMinutes) || transport.plannedWaitMinutes < 0 || transport.plannedWaitMinutes > 10080)) {
    errors.push(`${prefix}: planning wait allowance must be whole minutes, or left unknown.`);
  }
}

/**
 * The conservative wait to plan on. An official headway band plans on its
 * UPPER bound, because a deadline has to survive the worst published case.
 * With no official headway, an entered allowance may be used but is labelled
 * an assumption. With neither, there is no honest number.
 */
export function planningWait(transport: TurnUpAndGoTransport): PlanningWait {
  if (transport.headwayMinutes) {
    const { min, max } = transport.headwayMinutes;
    const band = min === max ? `${max} min` : `${min}-${max} min`;
    return { minutes: max, basis: 'OFFICIAL', label: `PLANNING WAIT: up to ${max} min (official service frequency: every ${band})` };
  }
  if (transport.plannedWaitMinutes !== null) {
    return { minutes: transport.plannedWaitMinutes, basis: 'ASSUMPTION', label: `PLANNING WAIT: ${transport.plannedWaitMinutes} min (ASSUMPTION — entered allowance, no official frequency published)` };
  }
  return { minutes: null, basis: 'NONE', label: 'EXACT DEPARTURE NOT PROVIDED and no official frequency or entered wait allowance to plan from.' };
}

interface ResolvedWindow { opensMs: number; closesMs: number; ambiguous: boolean }

/** Every operating window that could contain or follow `aroundDateIso`, resolved to real instants. */
function resolveWindows(transport: TurnUpAndGoTransport, aroundDateIso: string, zone: string, dayOffsets: number[]): ResolvedWindow[] {
  const resolved: ResolvedWindow[] = [];
  for (const offset of dayOffsets) {
    const startDate = addCalendarDays(aroundDateIso, offset);
    const weekday = weekdayOf(startDate);
    for (const window of transport.operatingWindows) {
      if (!window.days.includes(weekday)) continue;
      const open = zonedTimeToUtc(startDate, window.opens, zone);
      const closeDate = window.closesNextDay ? addCalendarDays(startDate, 1) : startDate;
      const close = zonedTimeToUtc(closeDate, window.closes, zone);
      const opensMs = Date.parse(open.utcIso);
      const closesMs = Date.parse(close.utcIso);
      if (!Number.isFinite(opensMs) || !Number.isFinite(closesMs) || closesMs <= opensMs) continue;
      resolved.push({ opensMs, closesMs, ambiguous: open.dstTransitionAmbiguous || close.dstTransitionAmbiguous });
    }
  }
  return resolved.sort((a, b) => a.opensMs - b.opensMs);
}

/**
 * Is the service running when the traveller is ready, and if not, when does
 * it next run? Handles windows that cross midnight, weekday-specific windows,
 * and next-day reopening, all in the boarding stop's own time zone.
 */
export function assessAvailability(transport: TurnUpAndGoTransport, readyMs: number): AvailabilityAssessment {
  const zone = transport.from.timeZone;
  const readyAt = toZonedDateTime(new Date(readyMs).toISOString(), zone);
  const local = utcToZoned(new Date(readyMs).toISOString(), zone);
  const notes: string[] = [];

  // Look back a day (a window opened yesterday may still be running) and
  // forward far enough to find the next opening on a weekday-limited service.
  const windows = resolveWindows(transport, local.dateIso, zone, [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const current = windows.find((w) => readyMs >= w.opensMs && readyMs < w.closesMs);

  if (current) {
    return {
      state: 'SERVICE AVAILABLE',
      readyAt,
      windowClosesAt: toZonedDateTime(new Date(current.closesMs).toISOString(), zone),
      dstAmbiguous: current.ambiguous,
      notes,
    };
  }

  const next = windows.find((w) => w.opensMs > readyMs);
  if (!next) {
    notes.push('No further operating window found within the next eight days from the entered operating hours.');
    return { state: 'SERVICE CLOSED AT READY TIME', readyAt, dstAmbiguous: false, notes };
  }
  notes.push('Service is closed at your ready time. The next operating window is a reopening time, not a specific departure.');
  return {
    state: 'SERVICE CLOSED AT READY TIME',
    readyAt,
    nextOpening: toZonedDateTime(new Date(next.opensMs).toISOString(), zone),
    waitUntilOpeningMinutes: Math.round((next.opensMs - readyMs) / MINUTE),
    dstAmbiguous: next.ambiguous,
    notes,
  };
}

export interface TurnUpAndGoOutcome {
  availability: AvailabilityAssessment;
  wait: PlanningWait;
  /** Earliest honest boarding instant: ready + access allowance + planning wait. Null when unconfirmable. */
  boardingMs: number | null;
  /** Boarding + journey duration. Null when unconfirmable. */
  arrivalMs: number | null;
  /** Inputs that are missing before a full journey time can be stated. */
  missing: string[];
  /** True when the whole leg can be timed; false when only availability can be stated. */
  timingConfirmed: boolean;
}

/**
 * Plan the leg from a ready instant. Availability is answered whenever
 * operating hours exist; timing is answered only when there is both a
 * journey duration and something to plan a wait from.
 */
export function planTurnUpAndGo(transport: TurnUpAndGoTransport, readyMs: number): TurnUpAndGoOutcome {
  const availability = assessAvailability(transport, readyMs);
  const wait = planningWait(transport);
  const missing: string[] = [];
  if (transport.journeyMinutes === null) missing.push('journey duration for this leg');
  if (wait.basis === 'NONE') missing.push('official service frequency or an entered planning wait allowance');

  if (availability.state === 'SERVICE CLOSED AT READY TIME' || missing.length) {
    return { availability, wait, boardingMs: null, arrivalMs: null, missing, timingConfirmed: false };
  }

  const boardingMs = readyMs + (transport.minimumBeforeDeparture! + wait.minutes!) * MINUTE;
  // A wait that runs past closing cannot be served by this window.
  if (availability.windowClosesAt && boardingMs > Date.parse(availability.windowClosesAt.utcIso)) {
    return {
      availability: {
        ...availability,
        notes: [...availability.notes, 'Service is open at your ready time, but the station access allowance and planning wait run past the published closing time.'],
      },
      wait,
      boardingMs: null,
      arrivalMs: null,
      missing: ['a departure before the published closing time'],
      timingConfirmed: false,
    };
  }
  return { availability, wait, boardingMs, arrivalMs: boardingMs + transport.journeyMinutes! * MINUTE, missing, timingConfirmed: true };
}

export interface LatestSafeReady {
  /** Planning boundary instant, or null when the evidence cannot support one. */
  ms: number | null;
  /** Why no boundary could be derived. */
  reason?: string;
}

/**
 * The backwards-planning boundary for a turn-up-and-go leg.
 *
 * For a timetabled leg this is a specific service ("the latest
 * deadline-compatible train"). Here there is no such service to name, so the
 * boundary is expressed as the latest moment the traveller can be READY and
 * still make the deadline under the planned wait — and it must also fall
 * inside an operating window.
 */
export function latestSafeReadyTime(transport: TurnUpAndGoTransport, latestArrivalMs: number): LatestSafeReady {
  const wait = planningWait(transport);
  if (transport.journeyMinutes === null) return { ms: null, reason: 'CANNOT CONFIRM — no journey duration entered for this leg.' };
  if (wait.basis === 'NONE') return { ms: null, reason: 'CANNOT CONFIRM — no official service frequency or entered planning wait allowance.' };

  const candidate = latestArrivalMs - (transport.journeyMinutes + wait.minutes! + transport.minimumBeforeDeparture!) * MINUTE;
  const availability = assessAvailability(transport, candidate);
  if (availability.state === 'SERVICE AVAILABLE') return { ms: candidate };
  return { ms: null, reason: 'CANNOT CONFIRM — the latest ready time that would meet the deadline falls outside the published operating hours.' };
}
