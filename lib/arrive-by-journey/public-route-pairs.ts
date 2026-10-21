import { getRouteAirport, getRouteDestination, routes, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getArrivalAirportOptions, getDepartureAirportOptions } from './airport-options';

/**
 * The small, public contract between a verified JetStash route and Arrive
 * By.  It deliberately carries airport codes only: flight times, the
 * traveller's start, final destination and every allowance remain theirs to
 * enter.
 */
export interface PublicJourneyRoutePair {
  departureAirport: string;
  arrivalAirport: string;
  routeSlug: string;
  departureLabel: string;
  arrivalLabel: string;
}

/**
 * A route guide points to Arrive By only while the route page itself presents
 * the route as Direct or Connecting. A service-ended, verification-pending or
 * otherwise unconfirmed route gets no Arrive By entry point, even when both of
 * its airports are supported. A lapsed review date alone does not remove it:
 * the panel makes no route claim, and the traveller enters their own flights.
 */
export function isRouteCurrentForArriveBy(route: Route, nowIso: string): boolean {
  // Date-only, like the route page.
  const { status } = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso.slice(0, 10));
  return status === 'direct' || status === 'connecting';
}

export function getPublicJourneyRoutePairs(nowIso: string = new Date().toISOString().slice(0, 10)): PublicJourneyRoutePair[] {
  const departures = new Set(getDepartureAirportOptions().map((airport) => airport.code));
  const arrivals = new Set(getArrivalAirportOptions('public').map((airport) => airport.code));

  return routes.flatMap((route) => {
    const departure = getRouteAirport(route);
    const arrival = getRouteDestination(route);
    if (!departure || !arrival || !departures.has(departure.code) || !arrivals.has(arrival.iataCode)) return [];
    if (!isRouteCurrentForArriveBy(route, nowIso)) return [];
    return [{
      departureAirport: departure.code,
      arrivalAirport: arrival.iataCode,
      routeSlug: route.slug,
      departureLabel: departure.city,
      arrivalLabel: arrival.city,
    }];
  });
}

export function getPublicJourneyRoutePair(departureAirport: string, arrivalAirport: string, nowIso?: string) {
  return getPublicJourneyRoutePairs(nowIso).find((pair) => pair.departureAirport === departureAirport && pair.arrivalAirport === arrivalAirport);
}
