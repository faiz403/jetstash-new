import { routes as defaultRoutes, getRouteAirport, getRouteDestination, type Route } from '@/data/routes';
import { routeStatusEvents as defaultRouteStatusEvents, type RouteStatusEvent } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirportImage } from '@/lib/brand-images';
import type { RegionGroup } from '@/data/destinations';

/**
 * `/routes` usability fix — the data/grouping half. Kept as a plain,
 * pure, directly-testable function (matching this codebase's existing
 * convention for derivation logic — e.g. getEffectiveRoutePresentation,
 * computeBookByState) rather than living inline in the page component, so
 * tests can call the exact function the page renders from instead of
 * re-implementing the grouping algorithm and risking drift.
 */

export interface RouteCardData {
  slug: string;
  href: string;
  airportName: string;
  airportCity: string;
  airportCode: string;
  airportImage: { src: string; alt: string } | null;
  destCity: string;
  destCountry: string;
  statusLabel: string;
  isDirectStatus: boolean;
  /** Sub-line under the h3: flightTime for direct/connecting routes, statusLabel for pending/ended. */
  subLine: string;
  /** Pre-lowercased "country + destination city + origin airport/city + route title" — the exact fields the search box must match. */
  searchIndex: string;
}

export interface CountryGroup {
  country: string;
  routes: RouteCardData[];
}

// Matches the site-wide commercial ordering: India first, then Pakistan, then
// Bangladesh, then Gulf/Umrah, then Mediterranean, then North Africa — the
// same priority app/routes/page.tsx already used for its region sections,
// now used to order the finer-grained country groups instead.
const regionOrder: RegionGroup[] = ['india', 'pakistan', 'bangladesh', 'gulf', 'mediterranean', 'north-africa'];

/**
 * Groups routes by `Destination.country` — a real, existing, reliable
 * per-destination field (already shown on every card's MapPin badge),
 * never inferred from a route slug. Countries are ordered by regionOrder's
 * existing priority first, then by each country's first appearance in the
 * route list within that region, so this refines the site's current
 * ordering rather than inventing a new one.
 *
 * `routeList`/`nowIso` are optional purely so tests can pass fixtures —
 * production call sites (app/routes/page.tsx) always use the real data.
 */
export function buildRouteCountryGroups(
  routeList: Route[] = defaultRoutes,
  nowIso: string = new Date().toISOString().slice(0, 10),
  routeStatusEvents: RouteStatusEvent[] = defaultRouteStatusEvents
): CountryGroup[] {
  const countryFirstIndex = new Map<string, number>();
  const countryRegion = new Map<string, RegionGroup>();
  const routesByCountry = new Map<string, Route[]>();

  routeList.forEach((route, i) => {
    const dest = getRouteDestination(route);
    if (!dest) return;
    if (!countryFirstIndex.has(dest.country)) {
      countryFirstIndex.set(dest.country, i);
      countryRegion.set(dest.country, dest.region);
      routesByCountry.set(dest.country, []);
    }
    routesByCountry.get(dest.country)!.push(route);
  });

  const countryOrder = [...countryFirstIndex.keys()].sort((a, b) => {
    const regionDelta = regionOrder.indexOf(countryRegion.get(a)!) - regionOrder.indexOf(countryRegion.get(b)!);
    return regionDelta !== 0 ? regionDelta : countryFirstIndex.get(a)! - countryFirstIndex.get(b)!;
  });

  return countryOrder.map((country) => ({
    country,
    routes: routesByCountry
      .get(country)!
      .map((route): RouteCardData | null => {
        const airport = getRouteAirport(route);
        const dest = getRouteDestination(route);
        if (!airport || !dest) return null;
        // Verification-pending leakage fix: never read route.flightTime raw.
        const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
        // Deliberately the departure airport, not the destination: this index answers
        // "where am I flying from" (travellers scan by nearest airport first), and the
        // route guide it links to answers "where am I going" with the destination photo —
        // so the same image never appears twice in a row across the click.
        const airportImage = getAirportImage(airport.slug);
        const subLine = presentation.status === 'unverified' || presentation.status === 'service-ended' ? presentation.statusLabel : presentation.flightTime;
        return {
          slug: route.slug,
          href: `/routes/${route.slug}`,
          airportName: airport.name,
          airportCity: airport.city,
          airportCode: airport.code,
          airportImage,
          destCity: dest.city,
          destCountry: dest.country,
          statusLabel: presentation.statusLabel,
          isDirectStatus: presentation.status === 'direct',
          subLine,
          searchIndex: `${dest.country} ${dest.city} ${airport.city} ${airport.name} ${airport.city} to ${dest.city}`.toLowerCase(),
        };
      })
      .filter((card): card is RouteCardData => card !== null),
  }));
}
