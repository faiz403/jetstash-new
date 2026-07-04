import type { Airport } from '@/data/airports';
import type { Destination } from '@/data/destinations';

/**
 * Partner deep links.
 *
 * Currently generic Skyscanner search URLs with no affiliate tracking ID —
 * the same pattern used by Deal.partnerUrl in data/deals.ts. When a
 * Skyscanner Partners (or other affiliate) account is live, this is the ONE
 * place to add the tracking parameter for route-level links; per-deal links
 * in data/deals.ts must be updated separately.
 */
export function skyscannerRouteUrl(airport: Airport, destination: Destination): string {
  return `https://www.skyscanner.net/transport/flights/${airport.code.toLowerCase()}/${destination.iataCode.toLowerCase()}/`;
}
