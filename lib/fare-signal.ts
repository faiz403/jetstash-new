import {
  getPublishableObservationsByRoute,
  getPublishableObservationsByRouteAndCabin,
  isPubliclyPublishable,
  type FareObservation,
} from '@/data/fare-observations';
import type { DealCabin } from '@/data/deals';
import { daysBetweenIso, getFareFreshnessState, type FareFreshnessState } from '@/lib/freshness-thresholds';

export type FareSignalState = 'current' | 'recent' | 'none';

export interface FareSignalObservation {
  id: string;
  cabin: FareObservation['cabin'];
  airline: string;
  price: number;
  currency: FareObservation['currency'];
  observedDate: string;
  departureDate: string;
  returnDate: string;
  directness: Exclude<FareObservation['fareDirectness'], undefined | 'unknown'> | null;
  outboundStops: number | null;
  returnStops: number | null;
  connectionAirports: string[];
}

export interface FareSignal {
  state: FareSignalState;
  observation: FareSignalObservation | null;
  freshness: FareFreshnessState | null;
  /** Reserved for a future evidence-backed archive comparison. Never populated by V1. */
  strongerSignal: string | null;
}

function toSignalObservation(observation: FareObservation): FareSignalObservation | null {
  if (!isPubliclyPublishable(observation)) return null;

  return {
    id: observation.id,
    cabin: observation.cabin,
    airline: observation.source,
    price: observation.price,
    currency: observation.currency!,
    observedDate: observation.observedDate,
    departureDate: observation.departureDate!,
    returnDate: observation.returnDate!,
    directness: observation.fareDirectness === 'direct' || observation.fareDirectness === 'connecting'
      ? observation.fareDirectness
      : null,
    outboundStops: observation.outboundStops ?? null,
    returnStops: observation.returnStops ?? null,
    connectionAirports: [...new Set([
      ...(observation.outboundConnectionAirports ?? []),
      ...(observation.returnConnectionAirports ?? []),
    ])],
  };
}

function selectLatestObservation(observations: FareObservation[]): { observation?: FareObservation; historicalOnly: boolean } {
  const nonHistorical = observations.filter((observation) => observation.comparisonEligibility !== 'historical');
  const candidates = nonHistorical.length > 0 ? nonHistorical : observations;
  return {
    observation: [...candidates]
      .sort((a, b) => b.observedDate.localeCompare(a.observedDate) || a.price - b.price || a.id.localeCompare(b.id))[0],
    historicalOnly: nonHistorical.length === 0 && candidates.length > 0,
  };
}

/**
 * Generic Fare Signal cabin safety (23 August 2026). Business Fare Evidence
 * Batch 1 (PR #166) exposed a defect that pre-dates it but was never
 * exercised: deriveFareSignal()'s plain "latest observation wins" sort has
 * no cabin awareness at all, so once a route ever gets a Business
 * observation dated the same day or later than its current Economy one, the
 * generic route page (and every other surface that reuses
 * getFareSignalForRoute() -- app/routes/[slug]/page.tsx's hero,
 * lib/destination-flight-guides.ts's per-airport destination cards, and
 * lib/tracked-fare-groups.ts's /tracked-fares listing) would silently start
 * leading with a Business fare a normal, non-Business-shopping visitor never
 * asked to see. Traced through git history before fixing: the original
 * "add universal route fare signal" commit (a909ed2, 11 Aug 2026) carries no
 * cabin reasoning at all, and tests/fare-signal.test.ts has never once
 * exercised a mixed-cabin scenario -- every fixture is hardcoded Economy.
 * This was an unexamined default, not a deliberate design choice.
 *
 * The fix: prefer a current (fresh, non-historical, publicly publishable)
 * Economy observation outright, whenever one exists, regardless of what any
 * other cabin's latest check date is -- a stale or missing Economy
 * observation must never block a fresh Business one from surfacing (a route
 * with no Economy evidence, or whose Economy has aged past
 * OBSERVATION_FRESH_DAYS, correctly falls through to the pre-existing
 * cabin-blind latest-wins behaviour below).
 *
 * Deliberately narrow: this only changes deriveFareSignal()'s own default
 * selection, called in production from getFareSignalForRoute() (the
 * cabin-mixed, all-cabins case) and from
 * hasCurrentFareSignalForCabinAmongRoutes() (which pre-filters its input to
 * one cabin via getPublishableObservationsByRouteAndCabin() before ever
 * reaching here -- with only one cabin present, this preference is
 * structurally a no-op, so /business-class and every other cabin-specific
 * surface are unaffected by construction, not by a special case).
 */
function selectCurrentEconomyObservation(observations: FareObservation[], nowIso: string): FareObservation | undefined {
  // Deliberately NOT selectLatestObservation()'s "fall back to historical
  // entries when nothing else exists" behaviour -- that fallback exists so
  // the overall signal still shows *something* rather than nothing, marked
  // 'recent'/'historical' accordingly. A historical-only entry must never
  // be treated as the preferred *current* Economy signal, or a lone
  // historical Economy record would wrongly block a genuinely current
  // Business observation from ever surfacing.
  return [...observations]
    .filter((observation) =>
      observation.cabin === 'Economy'
      && observation.comparisonEligibility !== 'historical'
      && isPubliclyPublishable(observation)
      && getFareFreshnessState(daysBetweenIso(observation.observedDate, nowIso)) === 'fresh'
    )
    .sort((a, b) => b.observedDate.localeCompare(a.observedDate) || a.price - b.price || a.id.localeCompare(b.id))[0];
}

/**
 * Book-By cabin safety (23 August 2026, founder-approved, following an
 * independent P0 verification — the second confirmed Sol Ultra Full Big
 * Review finding, after Smart Fare Comparison). Confirmed live defect:
 * lib/booking-intelligence.ts's computeBookBySnapshot() selected its
 * "Verified check" via a cabin-blind getLatestPublishableObservation() —
 * "whichever observation was checked most recently, any cabin" — a
 * completely separate policy from this file's own Economy-preference fix
 * above (PR #167). On manchester-lahore this meant the generic Fare
 * Signal correctly led with £628 Economy while Book-By's own "Verified
 * check" badge showed £3,051 Business, directly beneath booking-timing
 * guidance a normal Economy-shopper never asked to see Business pricing
 * from.
 *
 * The fix is this exported function: the exact same selection policy
 * deriveFareSignal() (below) already applies — prefer a current Economy
 * observation, otherwise fall back to the latest observation regardless
 * of cabin — but returning the raw FareObservation rather than the public
 * FareSignalObservation view model deriveFareSignal() builds. Book-By
 * needs fields (priceNote) that view model deliberately doesn't carry;
 * rather than force Book-By through a shape that doesn't fit, or write a
 * second Economy-preference algorithm that could drift from this one
 * again, this is the ONE representative-fare selection policy, and
 * deriveFareSignal() itself is now just a thin wrapper around it.
 */
export function selectRepresentativeObservation(
  observations: FareObservation[],
  nowIso: string
): { observation: FareObservation | null; state: FareSignalState; freshness: FareFreshnessState | null } {
  const currentEconomy = selectCurrentEconomyObservation(observations, nowIso);
  if (currentEconomy) {
    return {
      observation: currentEconomy,
      state: 'current',
      freshness: getFareFreshnessState(daysBetweenIso(currentEconomy.observedDate, nowIso)),
    };
  }

  const { observation: latest, historicalOnly } = selectLatestObservation(observations);
  if (!latest || !isPubliclyPublishable(latest)) {
    return { observation: null, state: 'none', freshness: null };
  }

  const freshness = getFareFreshnessState(daysBetweenIso(latest.observedDate, nowIso));
  return {
    observation: latest,
    state: freshness === 'fresh' && !historicalOnly ? 'current' : 'recent',
    freshness,
  };
}

/**
 * Derives the single public Fare Signal from the same publishability and
 * freshness rules used by the existing fare surfaces. Historical entries can
 * remain in the archive, but never displace a current observation when one is
 * available. V1 deliberately has no stronger-price signal: the archive does
 * not yet provide a defensible same-profile baseline for every route.
 */
export function deriveFareSignal(observations: FareObservation[], nowIso: string): FareSignal {
  const { observation: selected, state, freshness } = selectRepresentativeObservation(observations, nowIso);
  const signalObservation = selected ? toSignalObservation(selected) : null;
  if (!selected || !signalObservation) {
    return { state: 'none', observation: null, freshness: null, strongerSignal: null };
  }
  return { state, observation: signalObservation, freshness, strongerSignal: null };
}

export function getFareSignalForRoute(routeSlug: string, nowIso: string): FareSignal {
  return deriveFareSignal(getPublishableObservationsByRoute(routeSlug, nowIso), nowIso);
}

/** A route with any renderable Fare Signal must not show the no-fare fallback. */
export function shouldShowNoFareFallback(fareSignal: FareSignal): boolean {
  return fareSignal.state === 'none';
}

/**
 * Fare fallback truth fix (August 2026): the correct question for a
 * multi-route scope (an airport, a destination, a region hub) is "does ANY
 * route in this scope have a current, publicly-safe Fare Signal" — a
 * completely separate question from "does a curated Deal card exist for
 * this scope" (`data/deals.ts`). A page must never render "we haven't
 * logged a tracked fare" copy just because it has zero curated Deals; the
 * Tracked Fares discoverability audit (16 August 2026) found this
 * conflation live on the Glasgow, Newcastle and Edinburgh airport pages —
 * each has a genuine current Fare Signal on at least one route, but zero
 * curated Deal, and so incorrectly rendered the "no tracked fare" fallback.
 *
 * Deliberately reuses getFareSignalForRoute() — the one canonical
 * freshness/verification-aware derivation — rather than a raw
 * FareObservation presence check, which would bypass the route-status gate
 * (see isObservationPublishable in data/fare-observations.ts) and could
 * resurface the exact class of leakage that gate exists to prevent.
 *
 * `'current'` only, not `'recent'` — matches "current display-ready Fare
 * Signal," the same standard `/deals`'s and the homepage's own coverage
 * stats already use, so this never claims stronger evidence exists than
 * what a visitor would actually see if they followed through to the route.
 */
export function hasCurrentFareSignalAmongRoutes(routeSlugs: string[], nowIso: string): boolean {
  return routeSlugs.some((slug) => getFareSignalForRoute(slug, nowIso).state === 'current');
}

/**
 * Cabin-scoped sibling of hasCurrentFareSignalAmongRoutes, for a
 * category page like /business-class where the relevant question is "does a
 * current Business fare exist anywhere", not "does a current fare of any
 * cabin exist on this specific route" — feeds deriveFareSignal() an already
 * cabin-filtered observation list (getPublishableObservationsByRouteAndCabin)
 * rather than duplicating its fresh/recent/none derivation logic locally.
 * deriveFareSignal() itself now prefers a current Economy observation when
 * one exists among its input (see its own "Generic Fare Signal cabin
 * safety" doc comment) — irrelevant here by construction, since this
 * function's input never contains more than one cabin to begin with.
 */
export function hasCurrentFareSignalForCabinAmongRoutes(routeSlugs: string[], cabin: DealCabin, nowIso: string): boolean {
  return routeSlugs.some(
    (slug) => deriveFareSignal(getPublishableObservationsByRouteAndCabin(slug, cabin, nowIso), nowIso).state === 'current'
  );
}
