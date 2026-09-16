import {
  getPublishableObservationsByRoute,
  getPublishableObservationsByRouteAndCabin,
  isPubliclyPublishable,
  type FareObservation,
} from '@/data/fare-observations';
import type { DealCabin } from '@/data/deals';
import { getRouteBySlug } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { daysBetweenIso, getFareFreshnessState, type FareFreshnessState } from '@/lib/freshness-thresholds';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';
import { getJourneyConsequences, formatJourneyConsequenceSummary, extractStopViaFromText } from '@/lib/journey-consequence';
import { isPoorItinerarySuitability } from '@/lib/itinerary-suitability';

export type FareSignalState = 'current' | 'recent' | 'none';

/**
 * Suppressed-fare explanation (2 Sep 2026, traveller-POV live product
 * review). The only reason ever recorded here is the one
 * isPoorItinerarySuitability() itself decided — never inferred from a
 * sibling fact like "Fare History has entries" (a route could have history
 * for a completely different reason, e.g. an old historical-only record).
 * `null` covers every other 'none' cause (no observations at all, an
 * observation that failed publishability, etc.) and must keep rendering the
 * existing plain "No current fare tracked" copy unchanged.
 */
export type FareSignalNoneReason = 'poor-itinerary-suppressed';

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
  /** See lib/fare-self-transfer.ts -- true only when the observation's own priceNote explicitly, unambiguously records a self-transfer or separate-ticket itinerary. Never inferred from stop/airline count. */
  isSelfTransfer: boolean;
  /**
   * Bad-fare prominence fix (5 Sept 2026, independently reproduced Astra
   * findings) — see lib/journey-consequence.ts's own doc comment for the
   * full "decisive consequence" scope and extraction discipline. Empty
   * array when no decisive consequence was found (or none is confidently
   * extractable); never a claim beyond what the observation's own priceNote
   * or structured fields actually record.
   */
  journeyConsequences: string[];
}

export interface FareSignal {
  state: FareSignalState;
  observation: FareSignalObservation | null;
  freshness: FareFreshnessState | null;
  /** Reserved for a future evidence-backed archive comparison. Never populated by V1. */
  strongerSignal: string | null;
  /** Populated only when state === 'none' AND the specific reason is isPoorItinerarySuitability() — see FareSignalNoneReason's own doc comment. Every other 'none' cause leaves this null. */
  noneReason: FareSignalNoneReason | null;
}

/**
 * Exported for lib/standout-fare.ts (First Standout Fare Pilot, 25 Aug
 * 2026): the public Standout Fare presentation must derive its
 * customer-facing evidence (airline, routing, dates, self-transfer flag)
 * from the exact same view-model builder Fare Signal itself uses, rather
 * than re-deriving those fields independently from a raw FareObservation —
 * one mapping, reused, so the two surfaces can never silently disagree
 * about what a given observation's public-safe fields are.
 */
export function toSignalObservation(observation: FareObservation): FareSignalObservation | null {
  if (!isPubliclyPublishable(observation)) return null;

  // Itinerary-shape disclosure fix (8 September 2026, founder review):
  // when the observation's own structured fareDirectness/outboundStops/
  // outboundConnectionAirports fields are absent, fall back to the
  // conservative "N stop(s) via City ... outbound|return" text extraction
  // (lib/journey-consequence.ts's extractStopViaFromText) rather than
  // silently rendering no itinerary-shape information at all next to the
  // price. Only ever ADDS to a structured field that's genuinely missing —
  // never overrides one that's already set, and never asserts anything
  // about the OTHER leg the text doesn't itself state (see formatStops()'s
  // existing null-if-either-unknown rule in components/route/fare-signal.tsx,
  // which already handles that asymmetry correctly once fed this).
  const stopVia = !observation.fareDirectness || observation.fareDirectness === 'unknown'
    ? extractStopViaFromText(observation.priceNote)
    : null;

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
      : (stopVia ? 'connecting' : null),
    outboundStops: observation.outboundStops ?? (stopVia?.leg === 'outbound' ? stopVia.stops : null),
    returnStops: observation.returnStops ?? (stopVia?.leg === 'return' ? stopVia.stops : null),
    connectionAirports: [...new Set([
      ...(observation.outboundConnectionAirports ?? []),
      ...(observation.returnConnectionAirports ?? []),
      ...(stopVia ? [stopVia.connectionCity] : []),
    ])],
    isSelfTransfer: isSelfTransferItinerary(observation.priceNote),
    journeyConsequences: formatJourneyConsequenceSummary(
      getJourneyConsequences(observation, getDestinationIataCode(observation.routeSlug))
    ),
  };
}

/** The route's own destination IATA code, or null if the route/destination can't be resolved — used only to detect an arrival-airport mismatch; see lib/journey-consequence.ts. */
function getDestinationIataCode(routeSlug: string): string | null {
  const route = getRouteBySlug(routeSlug);
  if (!route) return null;
  return getDestinationBySlug(route.destinationSlug)?.iataCode ?? null;
}

/**
 * Same-day verification-recheck representative priority (25 Aug 2026,
 * founder-approved narrow rule, following the confirmed £480/£547/£361/£591
 * finding: the deferred four-observation append would have left every one
 * of those routes still displaying its cheaper, same-day, already-superseded
 * routine fare, since the old chain broke an observedDate tie on price
 * alone).
 *
 * The schema records only a calendar date, never a time of day, so two
 * observations logged on the same date are otherwise indistinguishable in
 * sequence. An `emergency-recheck` is explicitly a LATER verification step
 * of evidence already observed earlier that same day (see
 * data/fare-observations.ts's `isIndependentComparisonObservation()` doc
 * comment: "A verification recheck is evidence about the current
 * representative fare, not an independent option"). Preferring it on a
 * same-day tie is an evidence-recency rule, not a price preference — it
 * must win regardless of whether its price is higher, lower or equal to the
 * routine observation it re-verifies (see
 * tests/fare-signal-recheck-priority.test.ts's "same-day recheck falls"
 * case, where a CHEAPER recheck must still win on the same evidentiary
 * ground).
 *
 * Deliberately generic: no route slug, price or date is hardcoded here.
 * This only reorders observations already eligible under every existing
 * rule (cabin, currentness, freshness, publishability) — those filters run
 * BEFORE this comparator is ever applied (see selectCurrentEconomyPool
 * and selectLatestObservation's own filter chains), so recheck priority can
 * never let an otherwise-ineligible observation win, and it never expands
 * or bypasses the existing profile/date-window-blind nature of the prior
 * price tie-break (a pre-existing characteristic of this sort, not
 * something this change introduces or widens).
 */
function compareByRepresentativePriority(a: FareObservation, b: FareObservation): number {
  const byDate = b.observedDate.localeCompare(a.observedDate);
  if (byDate !== 0) return byDate;
  const aIsRecheck = a.observationReason === 'emergency-recheck';
  const bIsRecheck = b.observationReason === 'emergency-recheck';
  if (aIsRecheck !== bIsRecheck) return aIsRecheck ? -1 : 1;
  return a.price - b.price || a.id.localeCompare(b.id);
}

/**
 * Suitability walk (16 Sept 2026, full-portfolio selector-impact review —
 * see docs/project-control/fare-evidence/full-portfolio-controlled-batch-2026-09-15.md).
 * Both selectLatestObservation() and selectCurrentEconomyPool() build
 * an already-eligible candidate array (their own pre-existing filters are
 * completely unchanged by this helper) and sort it by
 * compareByRepresentativePriority. Previously only that array's very first
 * (newest-by-priority) member was ever tested against
 * isPoorItinerarySuitability() — a poor newest observation failed the whole
 * pool closed immediately, even when an older, equally-eligible, equally-
 * current member of the SAME pool was perfectly suitable. This walks the
 * SAME sorted array, in the SAME order, for the first suitable member —
 * it never adds a candidate that would not already have been in the pool,
 * never relaxes freshness/cabin/eligibility, and returns undefined (not a
 * fallback guess) when every member of the pool is poor, so the caller can
 * still fail closed exactly as before.
 */
function firstSuitableByPriority(sortedCandidates: FareObservation[]): FareObservation | undefined {
  return sortedCandidates.find((observation) => !isPoorItinerarySuitability(observation));
}

function selectLatestObservation(observations: FareObservation[]): { observation?: FareObservation; historicalOnly: boolean } {
  const nonHistorical = observations.filter((observation) => observation.comparisonEligibility !== 'historical');
  const candidates = nonHistorical.length > 0 ? nonHistorical : observations;
  const sorted = [...candidates].sort(compareByRepresentativePriority);
  const publishableSorted = sorted.filter(isPubliclyPublishable);
  return {
    // firstSuitableByPriority() only ever walks the SAME already-eligible,
    // already-publishable, already-sorted array -- falls back to the plain
    // newest publishable candidate when every one of them is poor, so the
    // caller's existing isPoorItinerarySuitability(latest) check still
    // fires and fails closed exactly as before. Falls back further to
    // sorted[0] (possibly unpublishable) only to preserve the pre-existing
    // "no publishable evidence at all" bail-out in the caller, which must
    // see the same non-publishable candidate it always did.
    observation: firstSuitableByPriority(publishableSorted) ?? publishableSorted[0] ?? sorted[0],
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
/**
 * Returns the current-Economy candidate pool itself (already filtered and
 * sorted, exactly as before this function ever returned only its first
 * member) so the caller can tell "no current Economy evidence exists at
 * all" (empty array — falls through to selectLatestObservation()'s
 * separate, any-cabin pool) apart from "current Economy evidence exists but
 * every member of it is poor" (non-empty array, firstSuitableByPriority()
 * finds nothing) — the two must never collapse into the same branch, or a
 * route with only poor current-Economy evidence could wrongly fall through
 * to the any-cabin/historical fallback pool and surface stale or wrong-
 * cabin evidence it was never eligible for.
 */
function selectCurrentEconomyPool(observations: FareObservation[], nowIso: string): FareObservation[] {
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
    .sort(compareByRepresentativePriority);
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
/**
 * PR #232 decisive-duration correction (5 Sept 2026): this function now
 * lives in lib/itinerary-suitability.ts — a small, dependency-free module
 * lib/journey-consequence.ts also needs to import from, which this file
 * (lib/fare-signal.ts) cannot supply directly without creating a circular
 * import (lib/fare-signal.ts already imports FROM lib/journey-
 * consequence.ts). Re-exported here (see the import above) so every
 * existing import site (`from '@/lib/fare-signal'`) keeps working
 * unchanged — see that module's own doc comment for the full rule and its
 * history.
 */
export { isPoorItinerarySuitability };

/**
 * The ONE representative-fare selection policy — see this function's own
 * pre-existing doc comment above (Book-By cabin safety, 23 August 2026) for
 * why Fare Signal and Book-By Countdown must never derive this
 * independently. The poor-itinerary suitability check is applied HERE, at
 * the single shared choke point, precisely so it can never again let the
 * two surfaces drift apart the way they did before the 31 Aug 2026 fix — a
 * route whose ONLY eligible evidence is a poor Frankenstein itinerary must
 * still show "no current fare" identically on both the generic Fare Signal
 * and the Book-By "Verified check" callout.
 *
 * Suitability walk (16 Sept 2026 — see firstSuitableByPriority()'s doc
 * comment above): a poor observation no longer fails its WHOLE pool closed
 * merely for being newest. It is skipped, in favour of the next
 * already-eligible, already-current member of the SAME pool, if one is
 * suitable. The archive itself is untouched either way — this only changes
 * which already-genuine observation gets to represent the route publicly;
 * see data/fare-observations.ts and lib/itinerary-suitability.ts for what
 * "genuine" and "suitable" mean, neither of which this function redefines.
 */
export function selectRepresentativeObservation(
  observations: FareObservation[],
  nowIso: string
): { observation: FareObservation | null; state: FareSignalState; freshness: FareFreshnessState | null; noneReason: FareSignalNoneReason | null } {
  const currentEconomyPool = selectCurrentEconomyPool(observations, nowIso);
  if (currentEconomyPool.length > 0) {
    const suitable = firstSuitableByPriority(currentEconomyPool);
    if (suitable) {
      return {
        observation: suitable,
        state: 'current',
        freshness: getFareFreshnessState(daysBetweenIso(suitable.observedDate, nowIso)),
        noneReason: null,
      };
    }
    // Every member of the current-Economy pool is poor. Fail closed here —
    // do NOT fall through to selectLatestObservation()'s any-cabin/
    // historical pool merely to dodge suppression; that pool exists for a
    // genuinely different case (no current Economy evidence at all), and
    // surfacing it here would let a stale or wrong-cabin observation stand
    // in for a route that does have current Economy evidence, just none of
    // it suitable.
    return { observation: null, state: 'none', freshness: null, noneReason: 'poor-itinerary-suppressed' };
  }

  const { observation: latest, historicalOnly } = selectLatestObservation(observations);
  if (!latest || !isPubliclyPublishable(latest)) {
    return { observation: null, state: 'none', freshness: null, noneReason: null };
  }
  // Same reason, reached via the fallback (no current Economy) path rather
  // than the preferred-Economy path above — kept as its own check so the
  // OR-condition this replaced can no longer blur "genuinely no evidence"
  // and "evidence exists but is unsuitable" into the same untagged 'none'.
  // selectLatestObservation() has already walked its own pool for a
  // suitable candidate before returning `latest`, so this only fires when
  // every publishable member of THAT pool is also poor.
  if (isPoorItinerarySuitability(latest)) {
    return { observation: null, state: 'none', freshness: null, noneReason: 'poor-itinerary-suppressed' };
  }

  const freshness = getFareFreshnessState(daysBetweenIso(latest.observedDate, nowIso));
  return {
    observation: latest,
    state: freshness === 'fresh' && !historicalOnly ? 'current' : 'recent',
    freshness,
    noneReason: null,
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
  const { observation: selected, state, freshness, noneReason } = selectRepresentativeObservation(observations, nowIso);
  const signalObservation = selected ? toSignalObservation(selected) : null;
  if (!selected || !signalObservation) {
    return { state: 'none', observation: null, freshness: null, strongerSignal: null, noneReason };
  }
  return { state, observation: signalObservation, freshness, strongerSignal: null, noneReason: null };
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
