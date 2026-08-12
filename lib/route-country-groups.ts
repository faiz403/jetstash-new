import { routes as defaultRoutes, getRouteAirport, getRouteDestination, type Route } from '@/data/routes';
import { routeStatusEvents as defaultRouteStatusEvents, type RouteStatusEvent } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirportImage, getDestinationImage } from '@/lib/brand-images';
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
  /** Compact representative photo for the collapsed accordion header — see COUNTRY_REPRESENTATIVE_DESTINATION_SLUG. Null for any country not yet given a deliberate choice, same graceful fallback every other image resolver in this codebase uses. */
  image: { src: string; alt: string } | null;
}

// Matches the site-wide commercial ordering: India first, then Pakistan, then
// Bangladesh, then Gulf/Umrah, then Mediterranean, then North Africa — the
// same priority app/routes/page.tsx already used for its region sections,
// now used to order the finer-grained country groups instead.
const regionOrder: RegionGroup[] = ['india', 'pakistan', 'bangladesh', 'gulf', 'mediterranean', 'north-africa'];

/**
 * `/routes` country-header images — a deliberate, explicit per-country
 * choice, never inferred from a country string or "first route in the
 * group" at runtime (both would be fragile against reordering). Each slug
 * is an existing, already-approved data/destinations.ts entry with real
 * Signature Collection photography (see lib/brand-images.ts) — no new
 * image was generated, downloaded or introduced for this feature.
 *
 * Where a country has more than one photographed destination, the busier
 * one in data/routes.ts was chosen as the more representative pick for a
 * page whose header literally shows a route count (Mumbai: 3 routes vs
 * Delhi's 2; Islamabad: 3 vs Lahore's 2). India's choice also matches the
 * site's existing Manchester→Mumbai flagship narrative elsewhere
 * (components/journey-brief/journey-brief-manchester-mumbai.tsx). Where
 * two destinations tie (Saudi Arabia: Jeddah and Madinah both have 2),
 * Jeddah was chosen as the more general representative of the country —
 * Madinah is specifically the Umrah/religious-travel destination, and
 * this header groups the whole country, not that narrower journey.
 *
 * Keys are the exact Destination.country strings — 'United Arab Emirates',
 * not 'UAE' (see data/destinations.ts).
 */
export const COUNTRY_REPRESENTATIVE_DESTINATION_SLUG: Record<string, string> = {
  India: 'mumbai',
  Pakistan: 'islamabad',
  Bangladesh: 'dhaka',
  'United Arab Emirates': 'dubai',
  Qatar: 'doha',
  'Saudi Arabia': 'jeddah',
  Turkey: 'istanbul',
};

/**
 * Resolves a country's header image via the explicit mapping above —
 * never string concatenation or a country-name-derived slug guess. A
 * country absent from the mapping (a future addition not yet given a
 * deliberate choice) returns null, the same silent, graceful fallback
 * every other image resolver in lib/brand-images.ts already uses — the
 * header simply renders without an image rather than breaking.
 *
 * A country that IS mapped but whose target destination has no actual
 * approved image file is a different problem — a real configuration
 * mistake, not a legitimate "not yet photographed" case — so that throws
 * outside production, per the requirement to fail clearly in development
 * and tests rather than ever silently render a broken image. Production
 * still degrades to no image rather than crashing a live page over a
 * missing photo.
 */
function getCountryHeaderImage(country: string): { src: string; alt: string } | null {
  const slug = COUNTRY_REPRESENTATIVE_DESTINATION_SLUG[country];
  if (!slug) return null;
  const image = getDestinationImage(slug);
  if (!image && process.env.NODE_ENV !== 'production') {
    throw new Error(
      `/routes country header image mapping is broken: '${country}' maps to destination slug '${slug}', but lib/brand-images.ts has no approved image for that slug. Fix COUNTRY_REPRESENTATIVE_DESTINATION_SLUG in lib/route-country-groups.ts or add the missing asset.`
    );
  }
  return image;
}

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
    image: getCountryHeaderImage(country),
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
