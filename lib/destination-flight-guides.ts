import { getAirportBySlug, type Airport } from '@/data/airports';
import { type Destination } from '@/data/destinations';
import { getRouteByAirportAndDestination, getRoutesByDestination, type RoutePresentation } from '@/data/routes';
import { getFareSignalForRoute, type FareSignal } from '@/lib/fare-signal';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

export interface DestinationFlightGuideEntry {
  airport: Airport;
  routeSlug: string | null;
  href: string | null;
  routeStatus: RoutePresentation['status'] | null;
  fareSignal: FareSignal | null;
}

/**
 * Builds the destination-first flight choices shown on a destination page.
 *
 * An airport is never allowed to become a generic airport-page fallback here:
 * either JetStash has an exact airport-to-destination route guide, or the
 * entry remains an honest, non-clickable "guide not yet available" state.
 * Existing route guides are included even if a destination's editorial airport
 * list has not caught up, so a public route never disappears from its own
 * destination journey.
 */
export function getDestinationFlightGuideEntries(
  destination: Destination,
  nowIso: string,
): DestinationFlightGuideEntry[] {
  const routeAirportSlugs = getRoutesByDestination(destination.slug).map((route) => route.airportSlug);
  const airportSlugs = [...new Set([...destination.ukAirports, ...routeAirportSlugs])];

  const entries: DestinationFlightGuideEntry[] = [];

  for (const airportSlug of airportSlugs) {
    const airport = getAirportBySlug(airportSlug);
    if (!airport) continue;

    const route = getRouteByAirportAndDestination(airportSlug, destination.slug);
    if (!route) {
      entries.push({ airport, routeSlug: null, href: null, routeStatus: null, fareSignal: null });
      continue;
    }

    entries.push({
      airport,
      routeSlug: route.slug,
      href: `/routes/${route.slug}`,
      routeStatus: getEffectiveRoutePresentation(route, routeStatusEvents, nowIso).status,
      fareSignal: getFareSignalForRoute(route.slug, nowIso),
    });
  }

  return entries;
}
