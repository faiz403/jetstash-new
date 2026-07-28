/**
 * The featured journey is an editorial choice, while every operational fact
 * about it still comes from the Route Status ledger. Keep this deliberately
 * small: route identity is data, and labels, airport, destination and map
 * placement are derived from it at render time rather than duplicated here.
 *
 * A replacement must be a Manchester route with a destination plotted in the
 * Route Atlas and a deliberate visual treatment. Tests enforce the map
 * compatibility so this never silently falls back to an unrelated journey.
 */
export const HOMEPAGE_FLAGSHIP = {
  routeSlug: 'manchester-mumbai',
  journeyImageKey: 'manchester-mumbai-journey',
} as const;
