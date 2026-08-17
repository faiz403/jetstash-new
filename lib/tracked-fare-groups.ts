import { routes as defaultRoutes, getRouteAirport, getRouteDestination, type Route } from '@/data/routes';
import { airports as defaultAirports, type Airport } from '@/data/airports';
import { getFareSignalForRoute, type FareSignalObservation } from '@/lib/fare-signal';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';

/**
 * Exhaustive Tracked Fares (PR #140) — the data/grouping half, mirroring
 * lib/route-country-groups.ts's own pattern exactly (a plain, pure,
 * directly-testable function the page renders from, not inline
 * derivation) — same reasoning: tests call the exact function the page
 * uses instead of re-implementing the grouping/search logic and risking
 * drift.
 *
 * The one and only source of "which routes belong here" is
 * getFareSignalForRoute(...).state === 'current' — the exact same standard
 * /deals and the homepage's own coverage stat already use (see
 * lib/fare-signal.ts's own doc comments and the Tracked Fares
 * discoverability audit, 16 August 2026). This page is deliberately NOT
 * derived from data/deals.ts — a Deal is a curated marketing selection, a
 * Fare Signal is evidence; conflating them again after the fare fallback
 * truth fix (PR #139) would undo the exact distinction that fix exists to
 * protect. See TrackedFareEntry's own fields for why nothing here invents
 * or infers anything beyond what FareSignalObservation already carries.
 */

export interface TrackedFareEntry {
  routeSlug: string;
  routeHref: string;
  destCity: string;
  destCountry: string;
  observation: FareSignalObservation;
  /** Fail-closed exactly like DealCard/NoFareFallback — null means no verified handoff exists, never a generic fallback link. */
  tripComUrl: string | null;
  /** Pre-lowercased "destination city + country + airport city/name" — the exact fields the search box must match. */
  searchIndex: string;
}

export interface TrackedFareAirportGroup {
  airportSlug: string;
  airportName: string;
  airportCity: string;
  entries: TrackedFareEntry[];
}

/**
 * Groups current Fare Signals by departure airport, in data/airports.ts's
 * own array order (the same source-array-order convention this codebase
 * already uses elsewhere rather than inventing a new sort) — an airport
 * with zero current Fare Signals is omitted entirely, never shown with a
 * "0" count (matches getVisibleFilters's reasoning in
 * components/sections/deals-explorer.tsx: an empty group reads as broken,
 * not honest).
 *
 * `routeList`/`airportList`/`nowIso` are optional purely so tests can pass
 * fixtures — the real page always uses the live data.
 */
export function buildTrackedFareAirportGroups(
  routeList: Route[] = defaultRoutes,
  airportList: Airport[] = defaultAirports,
  nowIso: string = new Date().toISOString().slice(0, 10)
): TrackedFareAirportGroup[] {
  const entriesByAirport = new Map<string, TrackedFareEntry[]>();

  for (const route of routeList) {
    const signal = getFareSignalForRoute(route.slug, nowIso);
    if (signal.state !== 'current' || !signal.observation) continue;

    const airport = getRouteAirport(route);
    const dest = getRouteDestination(route);
    if (!airport || !dest) continue;

    const entry: TrackedFareEntry = {
      routeSlug: route.slug,
      routeHref: `/routes/${route.slug}`,
      destCity: dest.city,
      destCountry: dest.country,
      observation: signal.observation,
      // Handoff parity fix (PR #141, August 2026): must pass the same
      // three arguments the route guide itself passes
      // (app/routes/[slug]/page.tsx's own tripComUrl line) — route-slug
      // alone only checks TRIPCOM_ROUTE_URLS and silently skips the
      // exact-pair TRIPCOM_DESTINATION_URLS fallback getTripComFlightHandoffUrl
      // already supports, which is exactly as verified/dashboard-generated
      // as the primary map (see lib/booking-providers.ts's own doc
      // comment) — never a broadened "LON" aggregate. Omitting these two
      // arguments here silently lost 16 already-approved handoffs that
      // the corresponding route guide correctly showed all along.
      tripComUrl: getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug),
      searchIndex: `${dest.city} ${dest.country} ${airport.city} ${airport.name}`.toLowerCase(),
    };

    const existing = entriesByAirport.get(airport.slug) ?? [];
    existing.push(entry);
    entriesByAirport.set(airport.slug, existing);
  }

  return airportList
    .map((airport): TrackedFareAirportGroup | null => {
      const entries = entriesByAirport.get(airport.slug);
      if (!entries || entries.length === 0) return null;
      return { airportSlug: airport.slug, airportName: airport.name, airportCity: airport.city, entries };
    })
    .filter((group): group is TrackedFareAirportGroup => group !== null);
}
