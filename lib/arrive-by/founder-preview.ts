import { routes } from '@/data/routes';
import { getRouteAirport, getRouteDestination } from '@/data/routes';
import { SUPPORTED_ROUTE_SLUGS, type SupportedRouteSlug } from './route-support';
import { planArriveBy } from './engine';
import { toZonedDateTime } from './timezones';
import type {
  ArriveByConfidence,
  ArriveByJourneyType,
  ArriveByResult,
  BaggageType,
  ConnectionRiskPreference,
  DeadlineStrictness,
  DepartureTiming,
  ZonedDateTime,
} from './types';

/**
 * Stage 2 — founder preview only. Pure presentation/wiring glue around the
 * unmodified Stage 1 engine (`./engine`): builds the six-route option list
 * from real `data/routes.ts` records, wraps `planArriveBy` with a UI-only
 * "form not complete yet" pre-check, and turns an `ArriveByResult` into
 * plain-language display strings. Never recomputes a planning number itself
 * — every date/time/warning/assumption shown is read directly from the
 * engine's own output, never re-derived here.
 *
 * Deliberately still in `lib/arrive-by/` (not `components/`): keeps it
 * covered by `tests/arrive-by-integrity.test.ts`'s existing no-analytics/
 * no-network sweep of this directory, and colocated with the feature it
 * previews rather than split across two top-level folders.
 */

// ── Route options (closed set — exactly Stage 1's six routes) ────────────

export interface FounderPreviewRouteOption {
  slug: SupportedRouteSlug;
  originAirportSlug: string;
  destinationSlug: string;
  /** e.g. "Manchester → Lahore" */
  label: string;
  /** e.g. "Lahore, Pakistan" */
  destinationLabel: string;
  /** route.flightTime, verbatim, from data/routes.ts — the same real, un-parsed context text route-support.ts's own routeFlightTimeText carries (see engine.ts §6.1); shown for context, never used in the engine's arithmetic. */
  flightTimeText: string;
}

export const FOUNDER_PREVIEW_ROUTE_OPTIONS: FounderPreviewRouteOption[] = SUPPORTED_ROUTE_SLUGS.map((slug) => {
  const route = routes.find((r) => r.slug === slug)!;
  const airport = getRouteAirport(route);
  const destination = getRouteDestination(route);
  const originCity = airport?.city ?? route.airportSlug;
  const destinationCity = destination?.city ?? route.destinationSlug;
  const destinationLabel = destination ? `${destination.city}, ${destination.country}` : route.destinationSlug;
  return {
    slug,
    originAirportSlug: route.airportSlug,
    destinationSlug: route.destinationSlug,
    label: `${originCity} → ${destinationCity}`,
    destinationLabel,
    flightTimeText: route.flightTime,
  };
});

export function findFounderPreviewRoute(slug: string): FounderPreviewRouteOption | undefined {
  return FOUNDER_PREVIEW_ROUTE_OPTIONS.find((r) => r.slug === slug);
}

/** True only for the one route in the Stage 1 set that is genuinely a connecting journey — used to gate the connection-risk-preference control, never shown for a direct route. */
export function isConnectingRouteSlug(slug: string): boolean {
  return slug === 'manchester-dhaka';
}

// ── Form input (UI shape) and the one UI-only pre-check ──────────────────

export interface FounderPreviewForm {
  routeSlug: string;
  requiredArrivalDateLocal: string;
  requiredArrivalTimeLocal: string;
  deadlineStrictness: DeadlineStrictness;
  baggage: BaggageType;
  connectionRiskPreference: ConnectionRiskPreference;
}

export type FounderPreviewOutcome = { kind: 'incomplete' } | { kind: 'result'; result: ArriveByResult; route: FounderPreviewRouteOption };

/**
 * The only logic this file adds ahead of the engine: whether the form has
 * enough entered to be worth calling `planArriveBy` at all. An unselected
 * route or a blank date/time is never sent to the engine as a fabricated
 * value — it just means nothing to calculate yet, distinct from the engine
 * actively rejecting a bad value (which still runs through `planArriveBy`
 * and returns its own `invalid_deadline`/`unsupported_route` reason).
 */
export function runFounderPreview(form: FounderPreviewForm, nowIso: string): FounderPreviewOutcome {
  const route = findFounderPreviewRoute(form.routeSlug);
  if (!route || !form.requiredArrivalDateLocal || !form.requiredArrivalTimeLocal) {
    return { kind: 'incomplete' };
  }

  const input = {
    originAirportSlug: route.originAirportSlug,
    destinationSlug: route.destinationSlug,
    requiredArrivalDateLocal: form.requiredArrivalDateLocal,
    requiredArrivalTimeLocal: form.requiredArrivalTimeLocal,
    deadlineStrictness: form.deadlineStrictness,
    baggage: form.baggage,
    ...(isConnectingRouteSlug(route.slug) ? { connectionRiskPreference: form.connectionRiskPreference } : {}),
  };
  const result = planArriveBy(input, nowIso);
  return { kind: 'result', result, route };
}

// ── Plain-language copy maps (Stage 1 already supports every value here) ─

export const DEPARTURE_TIMING_COPY: Record<DepartureTiming, string> = {
  same_day: 'You can leave the UK the same day as your deadline.',
  previous_evening: 'Plan to leave the UK the evening before your deadline.',
  previous_day: 'Plan to leave the UK the day before your deadline.',
  more_than_one_day_earlier: 'Plan to leave the UK more than one day before your deadline.',
};

export const CONFIDENCE_COPY: Record<ArriveByConfidence, string> = {
  normal: 'Normal confidence — no announced service change affects this window.',
  limited: 'Limited confidence — see the warning below before relying on this window.',
};

export const JOURNEY_TYPE_COPY: Record<ArriveByJourneyType, string> = {
  direct: 'Direct route',
  connecting: 'Connecting route (one stop)',
  'verification-pending': 'Verification pending',
  'service-ended': 'Service ended',
};

// ── Formatting (display only — every value read straight from the engine) ─

const WEEKDAY_DATE = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const;

export function formatZonedDate(z: ZonedDateTime): string {
  return new Date(`${z.dateIso}T12:00:00Z`).toLocaleDateString('en-GB', WEEKDAY_DATE);
}

export function formatZonedTime(z: ZonedDateTime): string {
  return z.timeHHmm;
}

export function formatZonedDateTime(z: ZonedDateTime): string {
  return `${formatZonedDate(z)}, ${formatZonedTime(z)}`;
}

/** Short, human timezone label — the IANA identifier's city segment, e.g. "Asia/Karachi" -> "Karachi time". Falls back to the raw identifier if it doesn't have the usual Area/City shape. */
export function formatTimeZoneLabel(timeZone: string): string {
  const city = timeZone.split('/').pop();
  return city ? `${city.replace(/_/g, ' ')} time` : timeZone;
}

/**
 * DISCOVERED STAGE 1 DEFECT (reported, not silently patched — see the Stage
 * 2 delivery report; `lib/arrive-by/engine.ts` itself is untouched):
 * `ArriveByPlan.indicativeUkDepartureWindow.earliest`/`.latest` are named
 * backwards relative to real chronological order. `.earliest` is computed
 * from the SHORTER duration bound (closer to the fixed landing time -> a
 * LATER clock time) and `.latest` from the LONGER bound (further from
 * landing -> an EARLIER clock time) — see engine.ts's own
 * `earliestDepartureUtc`/`indicativeDepartureUtc` and
 * docs/product/ARRIVE_BY_MVP.md §7 point 4, which documents exactly this
 * construction. Because the duration range's min is always less than its
 * max (DIRECT/CONNECTING_JOURNEY_DURATION_RANGE_HOURS in config.ts), `.earliest`
 * is chronologically AFTER `.latest` for every single request, not just an
 * edge case. This function re-sorts the pair by real UTC instant so the
 * founder preview never displays an "earliest" time later than the "latest"
 * time it's paired with — a Stage 2 presentation fix only; the underlying
 * field names in Stage 1's own type/engine are left exactly as they are.
 */
export function chronologicalDepartureWindow(window: { earliest: ZonedDateTime; latest: ZonedDateTime }): { earlier: ZonedDateTime; later: ZonedDateTime } {
  const earliestMs = new Date(window.earliest.utcIso).getTime();
  const latestMs = new Date(window.latest.utcIso).getTime();
  return earliestMs <= latestMs ? { earlier: window.earliest, later: window.latest } : { earlier: window.latest, later: window.earliest };
}

/**
 * When the destination-local calendar date differs from what that same
 * instant is, locally, in the UK — reads only `requiredArrivalLocal`, and
 * re-expresses it in Europe/London via Stage 1's own `toZonedDateTime`
 * (never a fresh offset calculation) — null when they're the same date.
 */
export function describeUkCalendarShift(requiredArrivalLocal: ZonedDateTime): string | null {
  const ukEquivalent = toZonedDateTime(requiredArrivalLocal.utcIso, 'Europe/London');
  if (ukEquivalent.dateIso === requiredArrivalLocal.dateIso) return null;
  return `That instant falls on ${formatZonedDate(ukEquivalent)} in the UK — a different calendar date from the destination.`;
}
