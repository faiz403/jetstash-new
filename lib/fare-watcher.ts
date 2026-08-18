import type { FareObservation } from '@/data/fare-observations';
import { hasTripComRoute } from '@/lib/booking-providers';
import { daysBetweenIso, OBSERVATION_FRESH_DAYS, OBSERVATION_STALE_DAYS } from '@/lib/freshness-thresholds';

/** Qualification is intentionally stricter than the public Fare Signal. */
export const FARE_WATCHER_MIN_BASELINE = 3;
export const FARE_WATCHER_BASELINE_WINDOW_DAYS = OBSERVATION_STALE_DAYS;
export const FARE_WATCHER_MAX_HORIZON_DRIFT_DAYS = 7;
export const FARE_WATCHER_MIN_DROP_POUNDS = 25;
export const FARE_WATCHER_MIN_DROP_PERCENT = 10;

export type FareWatcherQualification =
  | 'insufficient-baseline'
  | 'ordinary-fare'
  | 'notable-drop'
  | 'new-recent-low'
  | 'standout-candidate';

export type FareWatcherCandidateLifecycle =
  | 'detected'
  | 'needs-verification'
  | 'founder-approved'
  | 'eligible-for-publication'
  | 'expired'
  | 'rejected';

export interface FareWatcherExclusion {
  observationId: string;
  reason:
    | 'historical'
    | 'same-snapshot'
    | 'missing-required-fields'
    | 'currency-mismatch'
    | 'different-profile'
    | 'different-booking-horizon'
    | 'different-trip-length'
    | 'outside-baseline-window'
    | 'not-earlier-than-candidate';
}

export interface FareWatcherQualificationResult {
  candidate: FareObservation;
  qualification: FareWatcherQualification;
  baselineMedian: number | null;
  previousLow: number | null;
  differencePounds: number | null;
  differencePercent: number | null;
  baselineSampleSize: number;
  comparableBaseline: FareObservation[];
  exclusions: FareWatcherExclusion[];
  evidenceLimits: string[];
}

export interface FareWatcherCandidate {
  id: string;
  routeSlug: string;
  currentFare: number;
  currency: 'GBP';
  travelDates: { departureDate: string; returnDate: string };
  airlineOrProvider: string;
  checkedDate: string;
  baselineMedian: number;
  previousLow: number;
  differencePounds: number;
  differencePercent: number;
  baselineSampleSize: number;
  qualification: Exclude<FareWatcherQualification, 'insufficient-baseline' | 'ordinary-fare'>;
  lifecycle: FareWatcherCandidateLifecycle;
  founderVerificationRequired: true;
  safeExactPartnerUrl: boolean;
  evidenceLimits: string[];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validProfile(observation: FareObservation): boolean {
  return Boolean(
    observation.profileId
    && observation.currency === 'GBP'
    && observation.departureDate
    && observation.returnDate
    && observation.observedDate
  );
}

function bookingHorizon(observation: FareObservation): number | null {
  if (!observation.departureDate) return null;
  const days = daysBetweenIso(observation.observedDate, observation.departureDate);
  return days >= 0 ? days : null;
}

function tripLength(observation: FareObservation): number | null {
  if (!observation.departureDate || !observation.returnDate) return null;
  const days = daysBetweenIso(observation.departureDate, observation.returnDate);
  return days >= 0 ? days : null;
}

function exclusion(observation: FareObservation, reason: FareWatcherExclusion['reason']): FareWatcherExclusion {
  return { observationId: observation.id, reason };
}

/**
 * Compares one current observation with only like-for-like archive records.
 * Same-day alternatives are deliberately excluded: they are a single search
 * snapshot, not independent weekly baseline points.
 */
export function qualifyFareWatcherObservation(
  candidate: FareObservation,
  observations: FareObservation[],
  nowIso: string
): FareWatcherQualificationResult {
  const exclusions: FareWatcherExclusion[] = [];
  const candidateHorizon = bookingHorizon(candidate);
  const candidateTripLength = tripLength(candidate);
  const baseline: FareObservation[] = [];

  if (!validProfile(candidate) || candidate.comparisonEligibility !== 'current') {
    return {
      candidate,
      qualification: 'insufficient-baseline',
      baselineMedian: null,
      previousLow: null,
      differencePounds: null,
      differencePercent: null,
      baselineSampleSize: 0,
      comparableBaseline: [],
      exclusions: [],
      evidenceLimits: ['The candidate is not a complete, explicitly current GBP observation.'],
    };
  }
  const candidateAge = daysBetweenIso(candidate.observedDate, nowIso);
  if (candidateAge < 0 || candidateAge > OBSERVATION_FRESH_DAYS) {
    return {
      candidate,
      qualification: 'insufficient-baseline',
      baselineMedian: null,
      previousLow: null,
      differencePounds: null,
      differencePercent: null,
      baselineSampleSize: 0,
      comparableBaseline: [],
      exclusions: [],
      evidenceLimits: ['The current observation is outside the fresh-candidate window.'],
    };
  }

  for (const observation of observations) {
    if (observation.id === candidate.id) continue;
    if (observation.comparisonEligibility === 'historical') {
      exclusions.push(exclusion(observation, 'historical'));
      continue;
    }
    if (observation.observedDate === candidate.observedDate) {
      exclusions.push(exclusion(observation, 'same-snapshot'));
      continue;
    }
    if (observation.observedDate >= candidate.observedDate) {
      exclusions.push(exclusion(observation, 'not-earlier-than-candidate'));
      continue;
    }
    if (!validProfile(observation)) {
      exclusions.push(exclusion(observation, observation.currency && observation.currency !== candidate.currency ? 'currency-mismatch' : 'missing-required-fields'));
      continue;
    }
    if (observation.routeSlug !== candidate.routeSlug || observation.cabin !== candidate.cabin || observation.profileId !== candidate.profileId) {
      exclusions.push(exclusion(observation, 'different-profile'));
      continue;
    }
    const horizon = bookingHorizon(observation);
    if (candidateHorizon === null || horizon === null || Math.abs(candidateHorizon - horizon) > FARE_WATCHER_MAX_HORIZON_DRIFT_DAYS) {
      exclusions.push(exclusion(observation, 'different-booking-horizon'));
      continue;
    }
    if (candidateTripLength === null || tripLength(observation) !== candidateTripLength) {
      exclusions.push(exclusion(observation, 'different-trip-length'));
      continue;
    }
    const age = daysBetweenIso(observation.observedDate, nowIso);
    if (age < 0 || age > FARE_WATCHER_BASELINE_WINDOW_DAYS) {
      exclusions.push(exclusion(observation, 'outside-baseline-window'));
      continue;
    }
    baseline.push(observation);
  }

  if (baseline.length < FARE_WATCHER_MIN_BASELINE) {
    return {
      candidate,
      qualification: 'insufficient-baseline',
      baselineMedian: null,
      previousLow: baseline.length > 0 ? Math.min(...baseline.map((item) => item.price)) : null,
      differencePounds: null,
      differencePercent: null,
      baselineSampleSize: baseline.length,
      comparableBaseline: baseline,
      exclusions,
      evidenceLimits: [`At least ${FARE_WATCHER_MIN_BASELINE} comparable prior observations are required; only ${baseline.length} qualified.`],
    };
  }

  const baselineMedian = median(baseline.map((item) => item.price));
  const previousLow = Math.min(...baseline.map((item) => item.price));
  const differencePounds = baselineMedian - candidate.price;
  const differencePercent = (differencePounds / baselineMedian) * 100;
  const meaningfulDrop = differencePounds >= FARE_WATCHER_MIN_DROP_POUNDS
    && differencePercent >= FARE_WATCHER_MIN_DROP_PERCENT;
  const newRecentLow = candidate.price <= previousLow;

  let qualification: FareWatcherQualification = 'ordinary-fare';
  if (meaningfulDrop && newRecentLow) qualification = 'standout-candidate';
  else if (meaningfulDrop) qualification = 'notable-drop';
  else if (newRecentLow) qualification = 'new-recent-low';

  return {
    candidate,
    qualification,
    baselineMedian,
    previousLow,
    differencePounds,
    differencePercent,
    baselineSampleSize: baseline.length,
    comparableBaseline: baseline,
    exclusions,
    evidenceLimits: [
      'The comparison describes JetStash observations only; it is not a market-wide claim.',
      'Baggage, seat fees and other mandatory costs remain separate evidence fields and are not assumed to be zero.',
    ],
  };
}

function toCandidate(result: FareWatcherQualificationResult): FareWatcherCandidate | null {
  if (result.qualification === 'insufficient-baseline' || result.qualification === 'ordinary-fare') return null;
  const { candidate } = result;
  if (!candidate.departureDate || !candidate.returnDate || result.baselineMedian === null || result.previousLow === null || result.differencePounds === null || result.differencePercent === null) return null;
  return {
    id: `fare-watcher-${candidate.id}`,
    routeSlug: candidate.routeSlug,
    currentFare: candidate.price,
    currency: 'GBP',
    travelDates: { departureDate: candidate.departureDate, returnDate: candidate.returnDate },
    airlineOrProvider: candidate.source,
    checkedDate: candidate.observedDate,
    baselineMedian: result.baselineMedian,
    previousLow: result.previousLow,
    differencePounds: result.differencePounds,
    differencePercent: result.differencePercent,
    baselineSampleSize: result.baselineSampleSize,
    qualification: result.qualification,
    lifecycle: 'detected',
    founderVerificationRequired: true,
    safeExactPartnerUrl: hasTripComRoute(candidate.routeSlug),
    evidenceLimits: result.evidenceLimits,
  };
}

/**
 * True when `a` should replace `b` as the "latest" observation for the same
 * comparison identity: later observedDate wins; on a genuine same-day tie,
 * the lower price wins; a final id comparison makes the result fully
 * deterministic. Mirrors the existing "latest observation" tie-break
 * already used by `selectLatestObservation` in lib/fare-signal.ts, so the
 * two "what's the current one" derivations in the codebase agree.
 */
function isNewerCandidate(a: FareObservation, b: FareObservation): boolean {
  if (a.observedDate !== b.observedDate) return a.observedDate > b.observedDate;
  if (a.price !== b.price) return a.price < b.price;
  return a.id.localeCompare(b.id) < 0;
}

/**
 * Candidate supersession (Fare Watcher Current-Candidate Supersession fix,
 * 19 August 2026): FARE_WATCHER_DESIGN.md's own candidate-flow section
 * already states candidates "expire automatically when their checked date,
 * travel dates or source availability no longer support the claim" — the
 * third clause was never implemented. Discovered via a real live-verified
 * case: a route's 18 August observation independently qualified as
 * `standout-candidate`; a same-profile 19 August recheck found the fare no
 * longer reproducible and logged a fresh, lower-tier observation. Without
 * this filter, BOTH observations independently surface as separate
 * "current" candidates for the same route — including via Route Watch and
 * the founder Command Centre UI — even though the 18 August one no longer
 * reflects an available fare.
 *
 * Keeps exactly one 'current'-eligible observation per (routeSlug, cabin,
 * profileId) identity — the same triple `qualifyFareWatcherObservation`
 * already uses to decide whether two observations are comparable at all
 * (see its `different-profile` exclusion below). An observation with no
 * `profileId` has no stable identity to group by and is kept as its own
 * singleton group rather than risk an incorrect collapse.
 *
 * This ONLY decides which observation is ever promoted to a candidate. It
 * does not touch baseline computation: `qualifyFareWatcherObservation` is
 * still called with the full, unfiltered observation list, so a superseded
 * observation (like the 18 August one above) remains fully available as
 * comparable baseline evidence for whichever observation IS selected as the
 * candidate — exactly how it already legitimately became part of the 19
 * August observation's own baseline median.
 */
function latestCurrentObservationsByIdentity(observations: readonly FareObservation[], nowIso: string): FareObservation[] {
  const latestByIdentity = new Map<string, FareObservation>();
  for (const observation of observations) {
    if (observation.comparisonEligibility !== 'current') continue;
    // Never let an observation dated after nowIso supersede one that is
    // valid as of nowIso — an evaluation "as of" a given date must only
    // ever see what was actually known by then, exactly like
    // qualifyFareWatcherObservation's own candidateAge check below treats a
    // future-dated candidate as invalid rather than as evidence.
    if (observation.observedDate > nowIso) continue;
    const key = observation.profileId
      ? `${observation.routeSlug}|${observation.cabin}|${observation.profileId}`
      : `no-profile-id:${observation.id}`;
    const existing = latestByIdentity.get(key);
    if (!existing || isNewerCandidate(observation, existing)) {
      latestByIdentity.set(key, observation);
    }
  }
  return [...latestByIdentity.values()];
}

/** Generates internal leads only. It never writes the archive or publishes UI copy. */
export function generateFareWatcherCandidates(observations: FareObservation[], nowIso: string): FareWatcherCandidate[] {
  return latestCurrentObservationsByIdentity(observations, nowIso)
    .map((candidate) => toCandidate(qualifyFareWatcherObservation(candidate, observations, nowIso)))
    .filter((candidate): candidate is FareWatcherCandidate => candidate !== null);
}

export function isFareWatcherCandidateExpired(candidate: FareWatcherCandidate, nowIso: string): boolean {
  return daysBetweenIso(candidate.checkedDate, nowIso) > OBSERVATION_STALE_DAYS
    || daysBetweenIso(nowIso, candidate.travelDates.departureDate) < 0;
}

export function advanceFareWatcherCandidate(
  candidate: FareWatcherCandidate,
  action: 'request-verification' | 'approve' | 'make-eligible' | 'reject',
  nowIso: string
): FareWatcherCandidate {
  if (isFareWatcherCandidateExpired(candidate, nowIso)) return { ...candidate, lifecycle: 'expired' };
  if (action === 'request-verification' && candidate.lifecycle === 'detected') return { ...candidate, lifecycle: 'needs-verification' };
  if (action === 'approve' && candidate.lifecycle === 'needs-verification') return { ...candidate, lifecycle: 'founder-approved' };
  if (action === 'make-eligible' && candidate.lifecycle === 'founder-approved') return { ...candidate, lifecycle: 'eligible-for-publication' };
  if (action === 'reject') return { ...candidate, lifecycle: 'rejected' };
  return candidate;
}
