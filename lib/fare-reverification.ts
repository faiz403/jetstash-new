import type { FareObservation } from '@/data/fare-observations';
import { fareReverifications, type FareReverification } from '@/data/fare-reverifications';
import { isLowestFarePolicyActive } from '@/lib/fare-window';

/**
 * FARE-SIGNAL-RECHECK-001 (7 October 2026). Pure helpers that turn the
 * explicit reverification ledger (data/fare-reverifications.ts) into the set
 * of observation ids that are no longer eligible for PUBLIC current-fare
 * selection. Used only by lib/fare-signal.ts; Fare Watcher, Route Watch and
 * Standout never call this.
 *
 * Every guard below is a structured-field comparison. There is no parsing of
 * `priceNote` and no fuzzy itinerary matching. A ledger entry only takes
 * effect when ALL of its structured evidence checks out against the
 * observations actually being evaluated; any doubt makes the entry inert, so
 * the target stays eligible (the failure mode is "show the older fare", never
 * "hide a fare on a hunch").
 */

function sameList(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (!a || !b) return false;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Strict structured itinerary identity: same carrier(s), same stops and
 * connection airports on both legs, and the same scheduled journey time on
 * both legs. Every field must be present on BOTH observations; a missing
 * field means "cannot be shown to be the same itinerary", not "assume it is".
 */
export function isSameStructuredItinerary(a: FareObservation, b: FareObservation): boolean {
  if (a.source !== b.source) return false;
  if (a.outboundStops === undefined || a.outboundStops !== b.outboundStops) return false;
  if (a.returnStops === undefined || a.returnStops !== b.returnStops) return false;
  if (!sameList(a.outboundConnectionAirports, b.outboundConnectionAirports)) return false;
  if (!sameList(a.returnConnectionAirports, b.returnConnectionAirports)) return false;
  if (a.outboundJourneyMinutes === undefined || a.outboundJourneyMinutes !== b.outboundJourneyMinutes) return false;
  if (a.returnJourneyMinutes === undefined || a.returnJourneyMinutes !== b.returnJourneyMinutes) return false;
  return true;
}

function isValidReverification(entry: FareReverification, target: FareObservation, recheck: FareObservation, nowIso: string): boolean {
  if (target.id === recheck.id) return false;
  if (recheck.observationReason !== 'emergency-recheck') return false;
  if (recheck.observedDate > nowIso) return false;
  if (target.observedDate > recheck.observedDate) return false;
  if (target.routeSlug !== recheck.routeSlug || target.cabin !== recheck.cabin) return false;
  if (!target.currency || target.currency !== recheck.currency) return false;
  if (!target.profileId || target.profileId !== recheck.profileId) return false;
  // The exact same travel window: a recheck of different dates says nothing about this fare.
  if (!target.departureDate || target.departureDate !== recheck.departureDate) return false;
  if (!target.returnDate || target.returnDate !== recheck.returnDate) return false;
  if (entry.action === 'supersede') return isSameStructuredItinerary(target, recheck);
  return entry.action === 'retire';
}

/**
 * Ids of observations in `observations` that a valid ledger entry has taken
 * out of public current-fare selection as of `nowIso`. Both the target and
 * the reverifying observation must be present in `observations` (i.e. both
 * already publicly publishable and causally available); otherwise the entry
 * does nothing.
 */
export function getReverifiedObservationIds(
  observations: readonly FareObservation[],
  nowIso: string,
  ledger: readonly FareReverification[] = fareReverifications
): Set<string> {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  const retired = new Set<string>();
  for (const entry of ledger) {
    const target = byId.get(entry.targetObservationId);
    const recheck = byId.get(entry.reverifyingObservationId);
    if (!target || !recheck) continue;
    if (isValidReverification(entry, target, recheck, nowIso)) retired.add(target.id);
  }
  return retired;
}

/**
 * `observations` without anything a valid reverification has retired.
 *
 * Applies only from the 4 October 2026 lowest-fare policy activation date. The
 * ledger corrects what that policy newly allowed (a lower older fare beating
 * its own later targeted recheck); every earlier as-of date keeps the
 * pre-migration semantics it already had, exactly like the policy itself
 * (lib/fare-window.ts), so historical replays are not rewritten.
 */
export function withoutReverifiedObservations(
  observations: FareObservation[],
  nowIso: string,
  ledger: readonly FareReverification[] = fareReverifications
): FareObservation[] {
  if (!isLowestFarePolicyActive(nowIso)) return observations;
  const retired = getReverifiedObservationIds(observations, nowIso, ledger);
  return retired.size === 0 ? observations : observations.filter((observation) => !retired.has(observation.id));
}
