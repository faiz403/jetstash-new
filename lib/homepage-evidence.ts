import { getRouteBySlug } from '@/data/routes';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFareSignalForRoute, type FareSignalObservation } from '@/lib/fare-signal';
import { FARE_AGE_WARNING_AFTER_DAYS } from '@/lib/fare-age-warning';
import { daysBetweenIso, meetsPromotedDepartureLeadTime } from '@/lib/freshness-thresholds';

/**
 * Homepage evidence example (Stage 2, 23 Oct 2026). One compact, genuinely
 * evidenced example of what a JetStash check shows, chosen for the UK–Pakistan
 * audience. Everything here is derived from the canonical sources the route
 * page itself uses (getEffectiveRoutePresentation and getFareSignalForRoute);
 * this module owns only the *selection* and the stricter homepage eligibility,
 * never a fact of its own.
 *
 * Eligibility is deliberately stricter than the route page's:
 *   - a fare is promoted only when the Fare Signal is 'current' and 'fresh',
 *     was checked within FARE_AGE_WARNING_AFTER_DAYS (the age at which the route
 *     page itself starts warning), and its departure still meets the promoted
 *     departure lead-time guard;
 *   - otherwise the example falls back to a verified-direct route finding with
 *     its own verification date;
 *   - otherwise nothing is shown. Never an invented example, never a stale price.
 * Candidates are tried in a fixed order, so the result is a pure function of
 * (data, nowIso).
 *
 * Deliberately a single UK-Pakistan route that the homepage ALREADY links to
 * (the Route Atlas panel). The SEO indexing pilot (21 Oct 2026) is measuring
 * the effect of the existing internal link set, so this card must not add a
 * link to any page the homepage did not already link to. Widening the list
 * means widening the link graph: log it as a pilot event first.
 */
export const HOMEPAGE_EVIDENCE_CANDIDATE_SLUGS = ['manchester-islamabad'] as const;

export interface HomepageEvidenceRoute {
  slug: string;
  originName: string;
  destinationCity: string;
  routeStatusHeadline: string;
  /** True only for a verified direct route (the fallback finding requires it). */
  routeIsDirect: boolean;
  /** ISO date of the route's own verification record; null unless that record is 'verified'. */
  verifiedDate: string | null;
}

export type HomepageEvidenceExample =
  | { kind: 'fare'; route: HomepageEvidenceRoute; fare: FareSignalObservation; connectingFareOnDirectRoute: boolean }
  | { kind: 'route'; route: HomepageEvidenceRoute };

function describeRoute(slug: string, nowIso: string): HomepageEvidenceRoute | null {
  const route = getRouteBySlug(slug);
  if (!route) return null;
  const airport = getAirportBySlug(route.airportSlug);
  const destination = getDestinationBySlug(route.destinationSlug);
  if (!airport || !destination) return null;
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  return {
    slug,
    originName: airport.name.replace(/ Airport$/, ''),
    destinationCity: destination.city,
    routeStatusHeadline: presentation.statusHeadline,
    routeIsDirect: presentation.status === 'direct',
    verifiedDate: route.verification?.status === 'verified' ? route.verification.verifiedDate : null,
  };
}

export function getHomepageEvidenceExample(nowIso: string): HomepageEvidenceExample | null {
  for (const slug of HOMEPAGE_EVIDENCE_CANDIDATE_SLUGS) {
    const described = describeRoute(slug, nowIso);
    if (!described) continue;
    const signal = getFareSignalForRoute(slug, nowIso);
    const fare = signal.observation;
    if (
      signal.state === 'current' &&
      signal.freshness === 'fresh' &&
      fare &&
      fare.cabin === 'Economy' &&
      daysBetweenIso(fare.observedDate, nowIso) <= FARE_AGE_WARNING_AFTER_DAYS &&
      meetsPromotedDepartureLeadTime(fare.departureDate, nowIso)
    ) {
      return {
        kind: 'fare',
        route: described,
        fare,
        connectingFareOnDirectRoute: described.routeIsDirect && fare.directness === 'connecting',
      };
    }
  }
  for (const slug of HOMEPAGE_EVIDENCE_CANDIDATE_SLUGS) {
    const described = describeRoute(slug, nowIso);
    if (described?.routeIsDirect && described.verifiedDate) {
      return { kind: 'route', route: described };
    }
  }
  return null;
}

/**
 * First UK date (ISO) on which the example for `nowIso` is no longer what
 * getHomepageEvidenceExample would return (a different kind or a different
 * fare, or nothing). If nothing changes within `horizonDays` the horizon date is
 * returned, i.e. an unknown expiry is treated as a conservative re-check date, never as
 * unlimited validity. Null only when there is no example at all. Pages are
 * ISR-cached, so the card carries this date and hides itself in the browser
 * once it arrives (see HomepageEvidenceExpiryGuard) rather than relying only
 * on the next successful regeneration. Derived by re-running the same
 * eligibility, never from a second rule that could drift.
 */
export function getHomepageEvidenceExpiryIso(nowIso: string, horizonDays = 120): string | null {
  const current = getHomepageEvidenceExample(nowIso);
  if (!current) return null;
  const key = (e: HomepageEvidenceExample | null) => (e ? e.kind + ':' + e.route.slug + ':' + (e.kind === 'fare' ? e.fare.id : '') : 'none');
  const start = new Date(nowIso + 'T12:00:00Z').getTime();
  for (let i = 1; i <= horizonDays; i += 1) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    if (key(getHomepageEvidenceExample(day)) !== key(current)) return day;
  }
  return new Date(start + horizonDays * 86_400_000).toISOString().slice(0, 10);
}
