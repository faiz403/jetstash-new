import type { Destination } from '@/data/destinations';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

/** Keep destination summaries consistent with the canonical route-status ledger. */
export function getDestinationFlightTimeFromUK(destination: Destination, nowIso: string): string {
  const base = destination.flightTimeFromUK;
  const manchesterRoute = getRouteByAirportAndDestination('manchester', destination.slug);
  if (!manchesterRoute || !/Manchester/i.test(base)) return base;

  const presentation = getEffectiveRoutePresentation(manchesterRoute, routeStatusEvents, nowIso);
  if (presentation.status !== 'service-ended') return base;
  if (/former Manchester direct service ended/i.test(base)) return base;

  return `${base.replace(/\s+or\s+Manchester\b/i, '').replace(/\s+from\s+Manchester\b/i, '')}; Manchester direct service ended`;
}
