/**
 * Fare copy must reflect the data actually available — never claim
 * "history" or "an example" without observations/deals to back it up.
 * Exported from lib/ rather than page.tsx since Next's typed-routes plugin
 * rejects extra exports from a page module; see tests for the "has
 * observations" case, which has no live example in current data yet.
 */
export function getFareSectionCopy(hasObservations: boolean, hasDeals: boolean): { heading: string; caption: string } {
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
  return {
    heading: 'No tracked fare yet',
    caption: "We haven't logged a tracked fare for this route yet. Search live prices with our travel partners below.",
  };
}
