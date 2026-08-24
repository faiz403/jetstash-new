import { getSmartFareComparisonForRoute } from '@/lib/smart-fare-route-adapter';
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
 * Reuses getSmartFareComparisonForRoute() — the exact same exact-match
 * comparison group PR #171 already selects — so Journey Choice can never
 * diverge from Smart Fare Comparison's own COMPARABLE OR NOT SHOWN
 * invariant. Never queries fare-observations.ts directly.
 */
export function getJourneyChoiceForRoute(routeSlug: string, nowIso: string): JourneyChoice | null {
  if (!isJourneyChoicePilotRoute(routeSlug)) return null;
  const comparison = getSmartFareComparisonForRoute(routeSlug, nowIso);
  if (!comparison) return null;
  return deriveJourneyChoice(comparison.options);
}
