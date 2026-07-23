import type { DealCabin } from './deals';
import { getRouteBySlug, getDisplayDirectness, type Route } from './routes';

export interface FareObservation {
  id: string;
  routeSlug: string;
  cabin: DealCabin;
  /** ISO date this fare was actually checked — never a live price claim. */
  observedDate: string;
  price: number;
  priceNote: string;
  source: string; // airline the fare was observed on
  /**
   * ISO date of the outbound departure the fare was quoted FOR — record it
   * on every new observation. Without it, "how many days before departure
   * was this fare seen" can never be computed, and that days-out dimension
   * is what the Book-By Countdown's future price curves are built from
   * (JETSTASH_PRINCIPLES.md §14). Optional only because historic entries
   * predate the field — never backfill a guessed date onto an old entry.
   */
  departureDate?: string;
  /**
   * ISO date of the return the fare was quoted FOR (Truth Reset, July 2026).
   * Required alongside `departureDate` for an observation to be publicly
   * displayable — see `isPubliclyPublishable()`. A price with no travel
   * dates doesn't say what it actually applies to; §2 of the Truth Reset
   * treats that as a fare-integrity issue, not a cosmetic one.
   */
  returnDate?: string;
}

/**
 * Truth Reset (July 2026): an observation is only safe to show publicly —
 * as a "Verified Check", counted in any "N fares tracked" total, or included
 * in a price range — once it records BOTH the departure and return dates it
 * was quoted for. This is deliberately strict: as of this pass, **none** of
 * the 18 observations below satisfy it (only some have `departureDate`, and
 * `returnDate` didn't exist as a field before this pass), so every public
 * fare display on the site will honestly degrade to "no fare checks logged
 * yet" until fares are re-logged with both dates. That's an intentional,
 * disclosed consequence of the accuracy standard, not a bug — see
 * docs/LAUNCH_BLOCKERS.md (TR-002) for the founder-facing impact statement.
 * Never delete an incomplete observation to "fix" this — append complete
 * ones going forward instead.
 */
export function isPubliclyPublishable(o: FareObservation): boolean {
  return Boolean(o.departureDate && o.returnDate);
}

/**
 * Append-only fare history per route — the single source of truth for
 * every price shown on the site. Never overwrite an entry when a fare
 * changes; add a new one with a later observedDate so the trend stays
 * visible. DealCard reads this via getFareRangeSummary(), never a
 * hardcoded price — see data/deals.ts's header comment.
 *
 * Fast-logging template — copy, fill in, paste as a new entry below (never
 * edit an existing one). `departureDate` AND `returnDate` are both required
 * for a new observation to ever appear publicly — see `isPubliclyPublishable`
 * above:
 *
 *   { id: 'obs-<route>-<cabin>-<n>', routeSlug: '<route-slug>', cabin: 'Economy', observedDate: '2026-01-01', price: 0, priceNote: 'return, per person', source: '<airline>', departureDate: '2026-01-01', returnDate: '2026-01-15' },
 */
export const fareObservations: FareObservation[] = [
  { id: 'obs-man-lhe-economy-1', routeSlug: 'manchester-lahore', cabin: 'Economy', observedDate: '2026-06-15', price: 489, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-man-lhe-business-1', routeSlug: 'manchester-lahore', cabin: 'Business', observedDate: '2026-06-09', price: 1845, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-lhr-del-economy-1', routeSlug: 'london-heathrow-delhi', cabin: 'Economy', observedDate: '2026-06-14', price: 467, priceNote: 'return, per person', source: 'Virgin Atlantic' },
  { id: 'obs-lhr-del-business-1', routeSlug: 'london-heathrow-delhi', cabin: 'Business', observedDate: '2026-06-11', price: 2150, priceNote: 'return, per person', source: 'Virgin Atlantic' },
  { id: 'obs-bhx-atq-economy-1', routeSlug: 'birmingham-amritsar', cabin: 'Economy', observedDate: '2026-06-13', price: 521, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-bhx-atq-business-1', routeSlug: 'birmingham-amritsar', cabin: 'Business', observedDate: '2026-06-08', price: 2080, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-man-dxb-economy-1', routeSlug: 'manchester-dubai', cabin: 'Economy', observedDate: '2026-06-16', price: 349, priceNote: 'return, per person', source: 'Emirates' },
  { id: 'obs-man-dxb-business-1', routeSlug: 'manchester-dubai', cabin: 'Business', observedDate: '2026-06-12', price: 1840, priceNote: 'return, per person', source: 'Emirates' },
  { id: 'obs-lhr-doh-economy-1', routeSlug: 'london-heathrow-doha', cabin: 'Economy', observedDate: '2026-06-16', price: 398, priceNote: 'return, per person', source: 'Qatar Airways' },
  { id: 'obs-lhr-doh-business-1', routeSlug: 'london-heathrow-doha', cabin: 'Business', observedDate: '2026-06-11', price: 1640, priceNote: 'return, per person', source: 'Qatar Airways' },
  { id: 'obs-lhr-jed-economy-1', routeSlug: 'london-heathrow-jeddah', cabin: 'Economy', observedDate: '2026-06-09', price: 899, priceNote: '7 nights, flights + hotel, per person sharing', source: 'Saudia' },
  { id: 'obs-lhr-jed-business-1', routeSlug: 'london-heathrow-jeddah', cabin: 'Business', observedDate: '2026-06-10', price: 1730, priceNote: 'return, per person', source: 'Saudia' },
  { id: 'obs-man-med-economy-1', routeSlug: 'manchester-madinah', cabin: 'Economy', observedDate: '2026-06-09', price: 1149, priceNote: '14 nights Makkah & Madinah, flights + hotel, per person sharing', source: 'Saudia' },
  { id: 'obs-man-isb-business-1', routeSlug: 'manchester-islamabad', cabin: 'Business', observedDate: '2026-06-09', price: 1780, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-man-khi-economy-1', routeSlug: 'manchester-karachi', cabin: 'Economy', observedDate: '2026-06-16', price: 495, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-lgw-amd-economy-1', routeSlug: 'london-gatwick-ahmedabad', cabin: 'Economy', observedDate: '2026-06-17', price: 412, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-lgw-amd-business-1', routeSlug: 'london-gatwick-ahmedabad', cabin: 'Business', observedDate: '2026-06-17', price: 1620, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-lhr-bom-economy-1', routeSlug: 'london-heathrow-mumbai', cabin: 'Economy', observedDate: '2026-06-16', price: 498, priceNote: 'return, per person', source: 'British Airways' },
];

export function getObservationsByRoute(routeSlug: string) {
  return fareObservations
    .filter((o) => o.routeSlug === routeSlug)
    .sort((a, b) => a.observedDate.localeCompare(b.observedDate));
}

/** Latest observation regardless of publish-completeness — for internal/founder cadence tracking only, never public display. */
export function getLatestObservation(routeSlug: string) {
  const observations = getObservationsByRoute(routeSlug);
  return observations[observations.length - 1];
}

export function getObservationsByRouteAndCabin(routeSlug: string, cabin: DealCabin) {
  return fareObservations
    .filter((o) => o.routeSlug === routeSlug && o.cabin === cabin)
    .sort((a, b) => a.observedDate.localeCompare(b.observedDate));
}

/**
 * Pure predicate: is this exact observation safe to show publicly right
 * now? Requires ALL of:
 *  1. Date-completeness (isPubliclyPublishable).
 *  2. A defined route.
 *  3. `route.slug === observation.routeSlug` — the route passed in must
 *     actually be the one this observation was logged against, not merely
 *     any route object the caller happened to have on hand. Every current
 *     call site already looks the route up by the observation's own
 *     routeSlug, so this can't be hit in practice today — it's a defensive
 *     check against a future caller passing a mismatched pair (e.g. the
 *     wrong route object reused from an earlier loop iteration), which
 *     would otherwise silently judge an observation's publishability
 *     against a route it has nothing to do with.
 *  4. That route is currently evidenced (its directness is not
 *     'unverified'/pending).
 * A missing route is treated the same as an unevidenced one: nothing can be
 * safely attributed to a pair with no Route record at all.
 *
 * Deliberately takes an explicit `route` rather than looking one up
 * internally from a slug, so this is fully unit-testable against a
 * synthetic Route + FareObservation fixture — including the specific case
 * of a date-complete observation attached to a pending route — without
 * needing (or risking) a real, fabricated entry in the production dataset.
 * See tests/verification-pending-leakage.test.ts.
 */
export function isObservationPublishable(observation: FareObservation, route: Route | undefined, nowIso: string): boolean {
  if (!isPubliclyPublishable(observation)) return false;
  if (!route) return false;
  if (route.slug !== observation.routeSlug) return false;
  return getDisplayDirectness(route, nowIso) !== 'unverified';
}

/** Same as getObservationsByRouteAndCabin, filtered to what's safe to show publicly — see isObservationPublishable. */
export function getPublishableObservationsByRouteAndCabin(routeSlug: string, cabin: DealCabin, nowIso: string) {
  const route = getRouteBySlug(routeSlug);
  return getObservationsByRouteAndCabin(routeSlug, cabin).filter((o) => isObservationPublishable(o, route, nowIso));
}

/** Same as getPublishableObservationsByRouteAndCabin, across every cabin for the route — for surfaces like FareHistoryPanel that group by cabin themselves. */
export function getPublishableObservationsByRoute(routeSlug: string, nowIso: string) {
  const route = getRouteBySlug(routeSlug);
  return getObservationsByRoute(routeSlug).filter((o) => isObservationPublishable(o, route, nowIso));
}

/** Public-safe "last checked fare" for Book-By's Verified Check callout — never the internal getLatestObservation. Gated on both date-completeness and route evidence — see isObservationPublishable. */
export function getLatestPublishableObservation(routeSlug: string, nowIso: string) {
  const publishable = getPublishableObservationsByRoute(routeSlug, nowIso);
  return publishable[publishable.length - 1];
}

export interface FareRangeSummary {
  count: number;
  min: number;
  max: number;
  earliestDate: string;
  latestDate: string;
  /** Taken from the most recent observation — the most representative note for the range shown. */
  priceNote: string;
}

/**
 * Derives an honest price range from real logged observations — never a
 * "current price" claim. A single observation still returns a summary
 * (min === max), framed by the caller as "one check", not a range. Returns
 * null when nothing publishable has been logged yet for this route/cabin
 * (see isPubliclyPublishable), so callers fall back to non-perishable route
 * facts instead of showing a price.
 */
export function getFareRangeSummary(routeSlug: string, cabin: DealCabin, nowIso: string): FareRangeSummary | null {
  const observations = getPublishableObservationsByRouteAndCabin(routeSlug, cabin, nowIso);
  if (observations.length === 0) return null;
  const prices = observations.map((o) => o.price);
  return {
    count: observations.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    earliestDate: observations[0].observedDate,
    latestDate: observations[observations.length - 1].observedDate,
    priceNote: observations[observations.length - 1].priceNote,
  };
}
