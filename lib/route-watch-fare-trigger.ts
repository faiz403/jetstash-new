import type { FareObservation } from '@/data/fare-observations';
import { generateFareWatcherCandidates, type FareWatcherCandidate, type FareWatcherQualification } from '@/lib/fare-watcher';

/**
 * Route Watch meaningful lower-fare trigger (PR #143, August 2026).
 *
 * Reuses Fare Watcher's existing evidence engine unchanged — no second
 * threshold, no second comparability rule. See lib/fare-watcher.ts and
 * docs/project-control/FARE_WATCHER_DESIGN.md for the canonical £25-and-10%
 * drop standard, the ≥3-point comparable median baseline, and the full
 * route/cabin/currency/profile/trip-length/booking-horizon comparability
 * gate this derivation inherits by construction.
 *
 * Deliberately narrower than "any Fare Watcher candidate": a `new-recent-low`
 * clears the previous-low bar but not both meaningful-drop thresholds
 * together (see FARE_WATCHER_MIN_DROP_POUNDS / FARE_WATCHER_MIN_DROP_PERCENT
 * in lib/fare-watcher.ts) — real example from the archive, 17 August 2026:
 * manchester-lahore at £574 vs a £620 baseline median is only a 7.4% drop
 * (below the 10% floor), so Fare Watcher correctly labels it
 * 'new-recent-low', not 'standout-candidate' or 'notable-drop'. Route Watch
 * customers chose "I care most about a lower fare" — a £4-below-previous-low
 * movement is not the substantial change that promise should be spent on.
 * Only 'standout-candidate' and 'notable-drop' — the two qualifications that
 * clear BOTH the £ and % thresholds against the comparable median — ever
 * enter this queue. Zero qualifying candidates on a given day is an honest,
 * expected result, not a defect to work around.
 */
const ROUTE_WATCH_QUALIFYING_TIERS: readonly FareWatcherQualification[] = ['standout-candidate', 'notable-drop'];

/**
 * Deterministic from JetStash's own logged evidence only — no Brevo call,
 * no external request. The founder checks WATCH_ROUTE + WATCH_INTENT ===
 * 'best-fare' subscribers in Brevo manually at send time (see
 * docs/project-control/ROUTE_WATCH_PILOT_PROCEDURE.md); this function never
 * needs to know who, or how many, subscribers exist.
 */
export function generateRouteWatchFareCandidates(observations: FareObservation[], nowIso: string): FareWatcherCandidate[] {
  return generateFareWatcherCandidates(observations, nowIso).filter((candidate) =>
    ROUTE_WATCH_QUALIFYING_TIERS.includes(candidate.qualification)
  );
}
