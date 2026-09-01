/**
 * Fare copy must reflect the data actually available — never claim
 * "history" or "an example" without observations/deals to back it up.
 * Exported from lib/ rather than page.tsx since Next's typed-routes plugin
 * rejects extra exports from a page module; see tests for the "has
 * observations" case, which has no live example in current data yet.
 *
 * Fare History coherence fix (1 Sep 2026, User 5 real-user validation,
 * following the 31 Aug 2026 Fare Signal poor-itinerary suppression fix).
 * The rows this heading sits above are always truthful — every one states
 * its own checked date and price plainly. The heading itself went stale
 * for exactly the routes where the top (most recent) row is the same
 * observation Fare Signal just declined to show as "the" answer:
 * `hasObservations` alone can't tell "this route has a genuinely current
 * representative fare" from "this route has real archive evidence but no
 * current representative fare" — and "current example" asserts the
 * former unconditionally.
 *
 * `hasCurrentRepresentativeFare` is the durable, general condition —
 * literally "does getFareSignalForRoute() currently return a non-'none'
 * state for this route" — not a narrower "was this specific route
 * suppressed" flag. Today the false case maps exactly to the 7
 * poor-itinerary-suppressed routes, but the wording stays honest for any
 * other route that ever ends up with real observations and no current
 * representative signal for a different reason, without this function
 * needing to know why.
 */
export function getFareSectionCopy(hasObservations: boolean, hasDeals: boolean, hasCurrentRepresentativeFare: boolean): { heading: string; caption: string | null } {
  if (hasObservations && !hasCurrentRepresentativeFare) {
    return {
      heading: 'Fare history',
      caption: 'Previous tracked checks are shown for context. JetStash does not currently have a representative fare for this route.',
    };
  }
  if (hasObservations) {
    return {
      heading: 'Fare history & current example',
      caption: 'Every fare below is an example checked on the date shown, not a live quote. The history is what makes it worth tracking over time.',
    };
  }
  if (hasDeals) {
    return {
      heading: 'What we know about this route',
      caption: "We haven't logged fare history for this route yet, so there's no price shown below — just the route facts we do have, plus a live price check.",
    };
  }
  // NoFareFallback below already explains this route-specifically and gives
  // a live-search CTA — no caption here, or the two say the same thing twice.
  return {
    heading: 'No tracked fare yet',
    caption: null,
  };
}
