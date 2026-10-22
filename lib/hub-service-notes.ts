import { getRouteAirport, getRouteBySlug, getRouteDestination } from '@/data/routes';
import { getAirlinesBySlugs } from '@/data/airlines';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

/**
 * Hub practical notes that talk about *current* direct service are derived from
 * the canonical route verification (getEffectiveRoutePresentation), never
 * hand-written. First-impression sprint 1 (22 Oct 2026): the India hub said
 * Air India "currently runs direct services from Birmingham and Gatwick to
 * Amritsar" while the same page listed Gatwick-Amritsar as verification
 * pending. A hand-maintained sentence cannot stay true when a verification
 * lapses; this can.
 */

export interface VerifiedDirectService {
  routeSlug: string;
  originName: string;
  airlineNames: string[];
}

export function getVerifiedDirectServices(routeSlugs: readonly string[], nowIso: string): VerifiedDirectService[] {
  const services: VerifiedDirectService[] = [];
  for (const routeSlug of routeSlugs) {
    const route = getRouteBySlug(routeSlug);
    if (!route) continue;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
    if (presentation.status !== 'direct') continue;
    const airport = getRouteAirport(route);
    if (!airport) continue;
    services.push({
      routeSlug,
      originName: airport.name.replace(/ Airport$/, ''),
      airlineNames: getAirlinesBySlugs(presentation.airlineSlugs).map((a) => a.name),
    });
  }
  return services;
}

/**
 * Practical note listing which of a hub's routes are verified direct today,
 * derived from the same canonical verification. Names routes, not claims
 * about price or typical routing.
 */
export function buildDirectRoutesNote(
  regionLabel: string,
  routeSlugs: readonly string[],
  nowIso: string
): { title: string; body: string } {
  const services = getVerifiedDirectServices(routeSlugs, nowIso);
  const pairs = services.flatMap((s) => {
    const route = getRouteBySlug(s.routeSlug);
    const destination = route ? getRouteDestination(route) : undefined;
    return destination ? [`${s.originName} to ${destination.city}`] : [];
  });
  return {
    title: `Check which ${regionLabel} routes are verified direct`,
    body:
      pairs.length > 0
        ? `JetStash has a current direct-service check for ${joinNatural(pairs)}. Other routes here connect or are still being verified, so check each route guide. Don't assume a direct service runs every day.`
        : `JetStash has no currently verified direct service on the ${regionLabel} routes it covers. Check each route guide for what has been verified and when.`,
  };
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Practical note about direct service to one destination from a set of UK
 * routes. Names an airline only when that airline is individually verified for
 * the verified-direct route (presentation.airlineSlugs already filters this).
 */
export function buildDirectServiceNote(
  destinationCity: string,
  routeSlugs: readonly string[],
  nowIso: string
): { title: string; body: string } {
  const services = getVerifiedDirectServices(routeSlugs, nowIso);
  if (services.length === 0) {
    return {
      title: `Check each airport's ${destinationCity} service before you book`,
      body: `JetStash has no currently verified direct ${destinationCity} service from the UK airports it covers. Each route guide shows what has been checked and when. Connecting options may be available.`,
    };
  }
  return formatDirectServiceNote(destinationCity, services);
}

/**
 * Formats the note from already-verified services. An airline is named only
 * when every verified service has the same non-empty set of verified airlines;
 * otherwise the sentence names none, so an operator is never attached to an
 * origin it was not verified for.
 */
export function formatDirectServiceNote(
  destinationCity: string,
  services: VerifiedDirectService[]
): { title: string; body: string } {
  const origins = joinNatural(services.map((s) => s.originName));
  const airlineKeys = services.map((s) => [...s.airlineNames].sort().join('|'));
  const sameAirlines = airlineKeys.length > 0 && airlineKeys[0] !== '' && airlineKeys.every((k) => k === airlineKeys[0]);
  const operator = sameAirlines ? `${joinNatural(services[0].airlineNames)}'s direct ${destinationCity} service` : `The direct ${destinationCity} service`;
  return {
    title: `Direct ${destinationCity} flights: verified from ${origins}`,
    body: `${operator} from ${origins} is verified on JetStash, with the check date on each route guide. Don't assume a direct service runs every day, so confirm the exact flight date before booking. Other UK airports may need a connection.`,
  };
}
