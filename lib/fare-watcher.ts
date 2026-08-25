import { isIndependentComparisonObservation, isMethodologyExcluded, type FareObservation } from '@/data/fare-observations';
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
    | 'not-earlier-than-candidate'
    | 'methodology-excluded'
    | 'verification-recheck';
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
  /**
   * Verified-Candidate Price Integrity (25 Aug 2026). The full observation
   * that `currentFare`/`airlineOrProvider`/`differencePounds`/`differencePercent`/
   * `qualification` above were actually evaluated from -- the matching
   * `emergency-recheck` when one exists, otherwise the original detection
   * observation itself (never null; a candidate always has SOME evidence).
   * Carries every field a future publication surface would need (routing,
   * baggage, priceNote -- self-transfer evidence is derivable from
   * priceNote via lib/fare-self-transfer.ts) without this interface having
   * to enumerate each one individually. `verifiedObservation.observationReason
   * === 'emergency-recheck'` is how a consumer distinguishes "detected and
   * later re-verified" from "detected, not yet rechecked" -- `id` and
   * `checkedDate` above stay anchored to the ORIGINAL detection either way
   * (see findLatestVerificationRecheck()'s doc comment for why).
   */
  verifiedObservation: FareObservation;
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
  // Fare Watcher Methodology-Exclusion audit (22 August 2026): an
  // observation excluded from public output because its retained itinerary
  // evidence is insufficient to confirm ticketing structure must not
  // itself become an internal candidate lead either -- the same
  // insufficiency that blocks it from Fare Signal applies here.
  if (isMethodologyExcluded(candidate.id)) {
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
      evidenceLimits: ['The candidate is methodology-excluded (see data/fare-observations.ts) and cannot itself be evaluated.'],
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
    // Fare Watcher Methodology-Exclusion audit (22 August 2026): checked
    // before every other baseline test. An observation methodology-
    // excludes for insufficient retained itinerary evidence (data/fare-
    // observations.ts's methodologyExcludedObservationIds, checked via
    // isMethodologyExcluded()) must never silently influence whether a
    // later fare reads as an ordinary movement or a Standout Fare --
    // FARE_WATCHER_DESIGN.md's own stated exclusion list (historical,
    // incomplete, outside the baseline window) predates this mechanism and
    // was never updated to include it, which is exactly how this gap
    // stayed latent: e.g. obs-bhx-del-economy-20260818-8w-v1 (and the
    // equivalent 18 August records on birmingham-lahore, birmingham-
    // islamabad and manchester-karachi) reused their route's existing
    // profileId, so they passed every other check and silently counted as
    // that route's sole comparable baseline point in PR #163.
    if (isMethodologyExcluded(observation.id)) {
      exclusions.push(exclusion(observation, 'methodology-excluded'));
      continue;
    }
    if (!isIndependentComparisonObservation(observation)) {
      exclusions.push(exclusion(observation, 'verification-recheck'));
      continue;
    }
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

/**
 * `detection` is the observation that first surfaced this candidate identity
 * (`latestCurrentObservationsByIdentity()`'s output) -- `id` and `checkedDate`
 * are always anchored to it, preserving detection identity/lifecycle
 * continuity even when `result` was actually evaluated from a later
 * verification recheck (see generateFareWatcherCandidates() and
 * findLatestVerificationRecheck()).
 */
function toCandidate(result: FareWatcherQualificationResult, detection: FareObservation): FareWatcherCandidate | null {
  if (result.qualification === 'insufficient-baseline' || result.qualification === 'ordinary-fare') return null;
  const { candidate: evaluatedObservation } = result;
  if (!evaluatedObservation.departureDate || !evaluatedObservation.returnDate || result.baselineMedian === null || result.previousLow === null || result.differencePounds === null || result.differencePercent === null) return null;
  return {
    id: `fare-watcher-${detection.id}`,
    routeSlug: detection.routeSlug,
    currentFare: evaluatedObservation.price,
    currency: 'GBP',
    travelDates: { departureDate: evaluatedObservation.departureDate, returnDate: evaluatedObservation.returnDate },
    airlineOrProvider: evaluatedObservation.source,
    checkedDate: detection.observedDate,
    baselineMedian: result.baselineMedian,
    previousLow: result.previousLow,
    differencePounds: result.differencePounds,
    differencePercent: result.differencePercent,
    baselineSampleSize: result.baselineSampleSize,
    qualification: result.qualification,
    lifecycle: 'detected',
    founderVerificationRequired: true,
    safeExactPartnerUrl: hasTripComRoute(detection.routeSlug),
    evidenceLimits: result.evidenceLimits,
    verifiedObservation: evaluatedObservation,
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
    // Verified-Candidate Price Integrity (25 August 2026): an
    // emergency-recheck is evidence *about* an already-detected candidate
    // (see isMatchingVerificationRecheck() / findLatestVerificationRecheck()
    // below), never a detection in its own right. Without this exclusion, a
    // recheck with no matching earlier detection in the identity group (or
    // one that simply won isNewerCandidate() on date/price) could become the
    // detection observation itself, which would both mint a second
    // candidate id for the same real-world fare lead and let the recheck
    // count as a comparable baseline point for its own evaluation.
    if (observation.observationReason === 'emergency-recheck') continue;
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

/**
 * True when `other` is an `emergency-recheck` that verifies `detection`
 * under the exact same comparison identity: same route, cabin, exact travel
 * dates, opaque profile and currency. Airline/routing/stops/price are
 * deliberately NOT required to match — the entire point of a verification
 * recheck is to discover the currently available lowest fare for that exact
 * profile, which may legitimately differ in every one of those fields.
 * `other.observedDate >= detection.observedDate` guards against an
 * unrelated, earlier recheck of a different (e.g. superseded) detection
 * accidentally matching a later one that happens to share every other field.
 */
function isMatchingVerificationRecheck(detection: FareObservation, other: FareObservation): boolean {
  return other.observationReason === 'emergency-recheck'
    && other.routeSlug === detection.routeSlug
    && other.cabin === detection.cabin
    && other.profileId === detection.profileId
    && other.departureDate === detection.departureDate
    && other.returnDate === detection.returnDate
    && other.currency === detection.currency
    && other.observedDate >= detection.observedDate;
}

/**
 * Finds the current verification evidence for a detected candidate: the
 * latest `emergency-recheck` observation matching `detection` under
 * `isMatchingVerificationRecheck()`'s exact-profile contract, or `null` when
 * no matching recheck exists yet. Reuses `isNewerCandidate()` — the same
 * "latest observation" tie-break already used everywhere else in this file
 * — so "latest matching recheck wins" follows one shared ordering rule
 * rather than a second one invented here.
 */
function findLatestVerificationRecheck(detection: FareObservation, observations: readonly FareObservation[]): FareObservation | null {
  let latest: FareObservation | null = null;
  for (const observation of observations) {
    if (!isMatchingVerificationRecheck(detection, observation)) continue;
    if (!latest || isNewerCandidate(observation, latest)) {
      latest = observation;
    }
  }
  return latest;
}

/** Generates internal leads only. It never writes the archive or publishes UI copy. */
export function generateFareWatcherCandidates(observations: FareObservation[], nowIso: string): FareWatcherCandidate[] {
  return latestCurrentObservationsByIdentity(observations, nowIso)
    .map((detection) => {
      const recheck = findLatestVerificationRecheck(detection, observations);
      const evaluationSource = recheck ?? detection;
      const result = qualifyFareWatcherObservation(evaluationSource, observations, nowIso);
      return toCandidate(result, detection);
    })
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
