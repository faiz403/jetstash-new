import { getRouteAirport, getRouteDestination, routes } from '@/data/routes';
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

export function getPublicJourneyRoutePairs(): PublicJourneyRoutePair[] {
  const departures = new Set(getDepartureAirportOptions().map((airport) => airport.code));
  const arrivals = new Set(getArrivalAirportOptions('public').map((airport) => airport.code));

  return routes.flatMap((route) => {
    const departure = getRouteAirport(route);
    const arrival = getRouteDestination(route);
    if (!departure || !arrival || !departures.has(departure.code) || !arrivals.has(arrival.iataCode)) return [];
    return [{
      departureAirport: departure.code,
      arrivalAirport: arrival.iataCode,
      routeSlug: route.slug,
      departureLabel: departure.city,
      arrivalLabel: arrival.city,
    }];
  });
}

export function getPublicJourneyRoutePair(departureAirport: string, arrivalAirport: string) {
  return getPublicJourneyRoutePairs().find((pair) => pair.departureAirport === departureAirport && pair.arrivalAirport === arrivalAirport);
}
