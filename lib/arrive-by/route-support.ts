import { routes, getRouteAirport, getRouteDestination, type Route } from '@/data/routes';
import { routeStatusEvents, getEventsForRoute, getActiveEvents, type RouteStatusEvent } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import type { ArriveByJourneyType } from './types';

/**
 * Stage 1's controlled initial route set. Every entry is chosen because its
 * underlying Route Status and airport/destination data is already reliable
 * (see docs/product/ARRIVE_BY_MVP.md §14 for the full reasoning per route).
 * Adding a route here requires also adding its destination's IANA timezone
 * to lib/arrive-by/timezones.ts — getArriveByRouteSupport() below returns
 * `insufficient-timezone-data` rather than silently guessing if that step
 * is missed.
 *
 * Manchester–Delhi and Manchester–Mumbai are both genuinely
 * withdrawal-announced (IndiGo, effective 2026-08-31 — see
 * data/route-status-events.ts) — Delhi is included on exactly the same
 * honest footing as Mumbai, not a lesser one, even though only Mumbai was
 * named as conditional in the original brief.
 */
export const SUPPORTED_ROUTE_SLUGS = [
  'manchester-lahore',
  'manchester-islamabad',
  'manchester-dubai',
  'manchester-dhaka',
  'manchester-delhi',
  'manchester-mumbai',
] as const;

export type SupportedRouteSlug = (typeof SUPPORTED_ROUTE_SLUGS)[number];

export function isSupportedRouteSlug(slug: string): slug is SupportedRouteSlug {
  return (SUPPORTED_ROUTE_SLUGS as readonly string[]).includes(slug);
}

const SUPPORTED_ROUTES: Route[] = routes.filter((r) => isSupportedRouteSlug(r.slug));

export type RouteSupportRejectionReason = 'unsupported-destination' | 'unsupported-origin-for-destination';

export interface RouteSupportFound {
  supported: true;
  route: Route;
  routeSlug: SupportedRouteSlug;
  /** The journey type for THIS request's travel date — never a cached "current" value, always freshly derived. */
  journeyType: ArriveByJourneyType;
  /**
   * True when a verified Route Status ledger event (withdrawal-announced,
   * service-ended, or a rescheduled withdrawal) has an effective date on or
   * before the requested travel date. journeyType is 'verification-pending'
   * or 'service-ended' whenever this is true — Arrive By never assumes a
   * service continues past a date it has itself announced as an end.
   */
  blockedForTravelDate: boolean;
  /**
   * Existing route-status/warning wording only — the ledger event's own
   * customer-facing headline, or the route's safe pending summary, or an
   * active route-warning title. Never authored fresh here.
   */
  routeWarning: string | null;
  /** route.flightTime, verbatim — shown for context, never parsed for arithmetic. */
  routeFlightTimeText: string;
  sourceProvenance: string[];
}

export interface RouteSupportNotFound {
  supported: false;
  reason: RouteSupportRejectionReason;
}

export type RouteSupportResult = RouteSupportFound | RouteSupportNotFound;

/** Earliest ledger-verified date (across all non-superseded, non-cancelled lifecycle events) on or after which this route's current direct/connecting service is no longer confirmed. Null if no such event exists. */
function getEarliestServiceBoundaryDate(routeEvents: RouteStatusEvent[]): { date: string; event: RouteStatusEvent } | null {
  const active = getActiveEvents(routeEvents);
  const cancelledTargets = new Set(
    active.filter((e): e is typeof e & { relatedEventId: string } => e.type === 'withdrawal-cancelled' && Boolean(e.relatedEventId)).map((e) => e.relatedEventId)
  );

  let earliest: { date: string; event: RouteStatusEvent } | null = null;
  for (const e of active) {
    if (cancelledTargets.has(e.id)) continue;
    let boundary: string | undefined;
    if (e.type === 'withdrawal-announced') boundary = e.effectiveFrom;
    else if (e.type === 'service-ended') boundary = e.effectiveFrom;
    else if (e.type === 'withdrawal-rescheduled') boundary = e.newEffectiveFrom;
    if (!boundary) continue;
    if (!earliest || boundary < earliest.date) earliest = { date: boundary, event: e };
  }
  return earliest;
}

export function getArriveByRouteSupport(originAirportSlug: string, destinationSlug: string, travelDateLocal: string, nowIso: string): RouteSupportResult {
  const route = SUPPORTED_ROUTES.find((r) => r.airportSlug === originAirportSlug && r.destinationSlug === destinationSlug);

  if (!route) {
    const destinationSupportedAtAll = SUPPORTED_ROUTES.some((r) => r.destinationSlug === destinationSlug);
    return { supported: false, reason: destinationSupportedAtAll ? 'unsupported-origin-for-destination' : 'unsupported-destination' };
  }

  const routeSlug = route.slug as SupportedRouteSlug;
  const routeEvents = getEventsForRoute(route.slug, routeStatusEvents);
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  const boundary = getEarliestServiceBoundaryDate(routeEvents);
  const blockedForTravelDate = boundary !== null && travelDateLocal >= boundary.date;

  const sourceProvenance = [`JetStash Route Status (${routeSlug})`, 'JetStash verified route data (data/routes.ts)'];

  if (presentation.status === 'unverified') {
    return {
      supported: true,
      route,
      routeSlug,
      journeyType: 'verification-pending',
      blockedForTravelDate: true,
      routeWarning: presentation.summary,
      routeFlightTimeText: route.flightTime,
      sourceProvenance,
    };
  }

  if (presentation.status === 'service-ended') {
    return {
      supported: true,
      route,
      routeSlug,
      journeyType: 'service-ended',
      blockedForTravelDate: true,
      routeWarning: presentation.summary,
      routeFlightTimeText: route.flightTime,
      sourceProvenance,
    };
  }

  // status is 'direct' or 'connecting' as of nowIso.
  if (blockedForTravelDate) {
    // Mirrors data/route-status-events.ts's own core invariant: an
    // announcement's effective date passing produces verification-pending,
    // never a silent transition to "ended" — only a freshly verified
    // service-ended event may assert the service actually stopped. Applied
    // here to a FUTURE travel date, not just to "now".
    const boundaryEventType = boundary!.event.type;
    const journeyType: ArriveByJourneyType = boundaryEventType === 'service-ended' ? 'service-ended' : 'verification-pending';
    return {
      supported: true,
      route,
      routeSlug,
      journeyType,
      blockedForTravelDate: true,
      routeWarning: `Your required arrival date falls on or after the date this service's operator named for a change. ${boundary!.event.headline}`,
      routeFlightTimeText: route.flightTime,
      sourceProvenance: [...sourceProvenance, ...boundary!.event.sources.map((s) => s.publisher)],
    };
  }

  // Not blocked, but a future boundary may still exist — surface it as an honest heads-up, never suppressed.
  const activeWarning = getActiveWarningsByRoute(route.slug)[0];
  const routeWarning = boundary ? boundary.event.headline : (activeWarning?.title ?? null);

  return {
    supported: true,
    route,
    routeSlug,
    journeyType: presentation.status,
    blockedForTravelDate: false,
    routeWarning,
    routeFlightTimeText: route.flightTime,
    sourceProvenance: boundary ? [...sourceProvenance, ...boundary.event.sources.map((s) => s.publisher)] : sourceProvenance,
  };
}

export function getRouteOriginDestinationLabels(route: Route): { originLabel: string; destinationLabel: string } {
  const airport = getRouteAirport(route);
  const destination = getRouteDestination(route);
  return {
    originLabel: airport?.name ?? route.airportSlug,
    destinationLabel: destination ? `${destination.city}, ${destination.country}` : route.destinationSlug,
  };
}
