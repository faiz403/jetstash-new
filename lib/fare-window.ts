import type { FareObservation, FareSearchCoverageLevel } from '@/data/fare-observations';
import { daysBetweenIso } from '@/lib/freshness-thresholds';

export const STANDARD_FARE_STAY_PROFILES = [7, 14, 21, 28, 42] as const;
/** Historical fixtures before this migration retain their previous semantics. */
export const LOWEST_FARE_POLICY_START_DATE = '2026-10-04';
export const MIN_SENSIBLE_FARE_STAY_DAYS = 7;
export const MAX_SENSIBLE_FARE_STAY_DAYS = 42;

export interface RollingFareTravelWindow {
  startDate: string;
  endDate: string;
}

function addCalendarMonths(dateIso: string, months: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString().slice(0, 10);
}

export function getRollingFareTravelWindow(nowIso: string): RollingFareTravelWindow {
  return { startDate: nowIso, endDate: addCalendarMonths(nowIso, 3) };
}

export function isLowestFarePolicyActive(nowIso: string): boolean {
  return nowIso >= LOWEST_FARE_POLICY_START_DATE;
}

export function getStayLengthDays(observation: Pick<FareObservation, 'departureDate' | 'returnDate'>): number | null {
  if (!observation.departureDate || !observation.returnDate) return null;
  const departure = Date.parse(`${observation.departureDate}T12:00:00Z`);
  const returned = Date.parse(`${observation.returnDate}T12:00:00Z`);
  if (!Number.isFinite(departure) || !Number.isFinite(returned)) return null;
  return Math.round((returned - departure) / 86_400_000);
}

export function isSensibleFareStay(observation: Pick<FareObservation, 'departureDate' | 'returnDate'>): boolean {
  const stay = getStayLengthDays(observation);
  return stay !== null && stay >= MIN_SENSIBLE_FARE_STAY_DAYS && stay <= MAX_SENSIBLE_FARE_STAY_DAYS;
}

export function isObservationWithinRollingFareWindow(
  observation: Pick<FareObservation, 'departureDate' | 'returnDate'>,
  nowIso: string,
): boolean {
  const window = getRollingFareTravelWindow(nowIso);
  return Boolean(
    observation.departureDate
      && observation.returnDate
      && observation.departureDate >= window.startDate
      && observation.departureDate <= window.endDate
      && observation.returnDate >= window.startDate
      && observation.returnDate <= window.endDate
      && isSensibleFareStay(observation),
  );
}

/** True only for a recorded broad search that covers the active full window. */
export function getFreshFareCoverageLevel(observation: FareObservation, nowIso: string): FareSearchCoverageLevel | null {
  const coverage = observation.searchCoverage;
  if (!coverage) return null;
  const window = getRollingFareTravelWindow(nowIso);
  const searchedAtDate = coverage.searchedAt.slice(0, 10);
  const freshWindow = coverage.windowStart <= window.startDate
    && coverage.windowEnd >= window.endDate
    && searchedAtDate <= nowIso
    && daysBetweenIso(searchedAtDate, nowIso) <= 14;
  if (!freshWindow) return null;
  if (coverage.level === 'full-continuous') {
    const range = coverage.continuousStayRange;
    return coverage.method === 'flexible-date'
      && range !== undefined
      && range.minNights <= MIN_SENSIBLE_FARE_STAY_DAYS
      && range.maxNights >= MAX_SENSIBLE_FARE_STAY_DAYS
      ? 'full-continuous' : null;
  }
  if (coverage.level === 'full-profiled') {
    const profiles = [...new Set(coverage.stayProfiles ?? [])].sort((a, b) => a - b);
    return coverage.method === 'flexible-date'
      && profiles.length === STANDARD_FARE_STAY_PROFILES.length
      && profiles.every((profile, index) => profile === STANDARD_FARE_STAY_PROFILES[index])
      ? 'full-profiled' : null;
  }
  if (coverage.level === 'partial' && coverage.method === 'partial') return 'partial';
  if (coverage.level === 'fixed' && coverage.method === 'fixed-date') return 'fixed';
  return null;
}

/** Generic three-month wording is reserved for continuous coverage only. */
export function hasFreshThreeMonthSearchCoverage(observation: FareObservation, nowIso: string): boolean {
  return getFreshFareCoverageLevel(observation, nowIso) === 'full-continuous';
}
