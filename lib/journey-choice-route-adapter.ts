import { getComparableOptionsByObservationIds } from '@/lib/smart-fare-route-adapter';
import { deriveJourneyChoice, type JourneyChoice } from '@/lib/journey-choice';

/**
 * Journey Choice pilot allowlist (24 Aug 2026, founder-approved).
 *
 * "SMART COMPARABLE does not automatically mean JOURNEY CHOICE READY."
 * getSmartFareComparisonForRoute() can currently return a valid comparison
 * for three routes (manchester-islamabad, birmingham-amritsar,
 * london-heathrow-jeddah — see PR #171). Only manchester-islamabad has
 * structured journey-duration evidence on every comparable option, which
 * deriveJourneyChoice() would already exclude the other two on its own —
 * but this explicit allowlist is a second, independent gate, deliberately
 * not relying on that data gap alone. Birmingham-Amritsar and
 * Heathrow-Jeddah are not evidence-ready for this specific Hero Product
 * today (see Journey Choice Brief Phase 0: both lack structured
 * outbound/return journey-duration data on their comparable observations,
 * and Heathrow-Jeddah's second observation additionally discloses separate
 * tickets). Add a route here only when a future evidence review earns it —
 * never automatically just because the lower-level comparison contract
 * happens to pass.
 */
export const JOURNEY_CHOICE_PILOT_ROUTE_SLUGS: readonly string[] = ['manchester-islamabad'];

export function isJourneyChoicePilotRoute(routeSlug: string): boolean {
  return JOURNEY_CHOICE_PILOT_ROUTE_SLUGS.includes(routeSlug);
}

/**
 * Frozen input set for each pilot route's controlled Journey Choice
 * experiment (13 Sept 2026 freeze-integrity fix, founder-approved).
 *
 * Journey Choice was always meant to be a frozen, controlled experiment —
 * see this file's own pilot-allowlist doc comment above — but its
 * comparison inputs were still being recomputed live from the fare archive
 * on every request via getSmartFareComparisonForRoute()'s exact-match
 * grouping (the same grouping every ordinary route correctly uses). That
 * meant a wholly legitimate, unrelated future fare append sharing the same
 * cabin/dates/profileId/currency could silently change which two
 * observations Journey Choice selects as lowerFare/fasterJourney, mutating
 * the approved £601/£626/"£25 more saves 14h15m" result as a side effect of
 * routine evidence collection — confirmed live during the MAN-ISB direct-
 * PIA fare-evidence check (13 Sept 2026): a same-window, same-profile PIA
 * observation would have replaced £626 as the faster option purely by being
 * faster, with zero code change.
 *
 * This pins each pilot route to the exact observation IDs that produced its
 * approved result, by ID rather than by group key — see
 * lib/smart-fare-route-adapter.ts's getComparableOptionsByObservationIds(),
 * which still enforces the identical comparability rule and mapping every
 * live-grouped option goes through. The archive itself stays completely
 * untouched, profileId keeps its truthful, shared meaning (it is NOT
 * repurposed to hide an observation from this pilot), and every other
 * surface (Fare Signal, Fare History, tracked fares, Book-By, Standout
 * Fare) keeps reading the live archive exactly as before — this only
 * changes Journey Choice's own input selection. A future, deliberate
 * change to the experiment is still possible by editing this list — it can
 * no longer happen silently as a side effect of an unrelated append.
 */
const JOURNEY_CHOICE_FROZEN_OBSERVATION_IDS: Readonly<Record<string, readonly string[]>> = {
  'manchester-islamabad': [
    'obs-man-isb-economy-20260811-8w-v1', // £601 Etihad — lowerFare
    'obs-man-isb-economy-20260810-tk-626-v1', // £626 Turkish — fasterJourney
    'obs-man-isb-economy-20260810-tk-621-v1', // £621 Turkish — otherOptions
  ],
};

/**
 * Every pilot route MUST have a frozen ID set — deliberately fails closed
 * (returns null) rather than falling back to a live re-derivation, which
 * would silently reintroduce the exact mutability this freeze exists to
 * remove. Never queries fare-observations.ts directly outside the shared
 * getComparableOptionsByObservationIds() helper.
 */
export function getJourneyChoiceForRoute(routeSlug: string, nowIso: string): JourneyChoice | null {
  if (!isJourneyChoicePilotRoute(routeSlug)) return null;
  const frozenIds = JOURNEY_CHOICE_FROZEN_OBSERVATION_IDS[routeSlug];
  if (!frozenIds) return null;
  const options = getComparableOptionsByObservationIds(routeSlug, frozenIds, nowIso);
  if (options.length < 2) return null;
  return deriveJourneyChoice(options);
}
