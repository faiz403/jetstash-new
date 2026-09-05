import { getRouteBySlug, getRouteStatus } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation, getRouteStatusCopy, formatRouteStatusDate, type RouteStatusViewModel } from '@/lib/route-status-copy';
import { getFareSignalForRoute, type FareSignal as FareSignalData } from '@/lib/fare-signal';
import { getObservationsByRoute, isPubliclyPublishable, isObservationCausallyAvailable, type FareObservation } from '@/data/fare-observations';
import { getJourneyConsequences, formatJourneyConsequenceSummary } from '@/lib/journey-consequence';
import { getDestinationBySlug } from '@/data/destinations';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import type { TravelReadySignal } from '@/lib/travel-intelligence-engine';

/**
 * Journey Brief Phase 1 — Manchester → Mumbai founder-only pilot (5 Sept
 * 2026, product implementation following the Astra "30-second Journey
 * Brief" recommendation).
 *
 * Deliberately a NEW, separate file from lib/journey-brief-manchester-
 * mumbai.ts — that file's own exports (WITHDRAWAL_BOUNDARY_DATE,
 * EVIDENCE_BUNDLE, BOUNDARY_STATE_COPY, etc.) are still imported by
 * components/homepage-v2/journey-brief-hero.tsx, a separate, protected
 * homepage-v2 preview this task's own DO-NOT-TOUCH list covers ("do not
 * touch the homepage" / "do not broadly redesign"). That old file is left
 * completely unmodified here; this one only replaces what
 * components/journey-brief/journey-brief-manchester-mumbai.tsx (the
 * founder-only Journey Brief page itself, not the homepage) consumes.
 *
 * Read-only audit finding this rewrite exists to fix: the old bundle was
 * accurate when written (13-23 July 2026, before IndiGo's own announced
 * withdrawal took effect) but the ledger has since moved twice — the
 * withdrawal took effect (31 Aug 2026) and was independently confirmed
 * ended (2 Sept 2026, INDIA-002/PR #212) — and the old prototype's frozen
 * copy never picked either change up. As of this rewrite it was still
 * asserting "IndiGo... operates this route direct, with an announced end
 * date" days after the service had verifiably ended. This file reuses the
 * SAME canonical sources every public route page already reads from, so
 * this can never happen again silently:
 *
 *   - data/route-status-events.ts's ledger + lib/route-status-copy.ts's
 *     getEffectiveRoutePresentation()/getRouteStatusCopy() for the route's
 *     own current service status — the same functions app/routes/[slug]/
 *     page.tsx itself calls.
 *   - lib/fare-signal.ts's getFareSignalForRoute() for a current/recent
 *     representative fare, if one exists.
 *   - data/fare-observations.ts's isPubliclyPublishable — the same
 *     predicate components/route/fare-history-panel.tsx already uses — for
 *     the route's raw fare-check history when no current representative
 *     fare is available (true today: the route's service-ended status
 *     makes isObservationPublishable() false for every observation, so
 *     getFareSignalForRoute/getFareRangeSummary both correctly return
 *     nothing — see this file's own assembleManchesterMumbaiBrief()).
 *   - lib/journey-consequence.ts's getJourneyConsequences()/
 *     formatJourneyConsequenceSummary() (PR #232) for the one decisive-fact
 *     line, reused completely unmodified.
 *
 * Nothing here re-derives route truth, re-implements journey-consequence
 * extraction, or invents a second withdrawal-date calculator. Scoped to
 * this one founder-only pilot route.
 */

export const MANCHESTER_MUMBAI_ROUTE_SLUG = 'manchester-mumbai';

export interface RouteRealityAnswer {
  /** presentation.summary, verbatim — the same one-sentence status every public route page can show. */
  headline: string;
  /** presentation.statusLabel, verbatim (e.g. "Direct service ended"). */
  badgeLabel: string;
  /** Full sourced explanation + citations, for progressive disclosure only — null when the route has no ledger-managed status copy to show (never fabricated as a fallback). */
  detail: RouteStatusViewModel | null;
}

/**
 * A single logged fare check, framed explicitly as historical evidence —
 * never as "the current price" — plus whatever decisive consequence
 * lib/journey-consequence.ts finds in it. `isCurrentRepresentativeFare`
 * distinguishes the two cases the UI must word differently: a genuine
 * current Fare Signal (safe to call "a recent tracked fare") versus a raw
 * historical check surfaced only because no current one exists (must say so
 * explicitly).
 */
export interface EvidencedFareOption {
  price: number;
  currency: string;
  cabin: string;
  airline: string;
  observedDate: string;
  directness: 'direct' | 'connecting' | null;
  outboundStops: number | null;
  returnStops: number | null;
  journeyConsequences: string[];
  isCurrentRepresentativeFare: boolean;
}

export interface ManchesterMumbaiBrief {
  routeReality: RouteRealityAnswer;
  /** null only when there is genuinely no publishable evidence at all — current, recent, or historical. Never fabricated to fill the slot. */
  evidencedOption: EvidencedFareOption | null;
  /** True once a live Fare Signal exists again (future-proofing) — the "search current options" framing is only shown when this is false. */
  hasCurrentFareSignal: boolean;
  tripComUrl: string | null;
}

function toEvidencedOption(observation: FareObservation, destinationIataCode: string | null, isCurrentRepresentativeFare: boolean): EvidencedFareOption {
  const consequences = formatJourneyConsequenceSummary(getJourneyConsequences(observation, destinationIataCode));
  return {
    price: observation.price,
    currency: observation.currency ?? 'GBP',
    cabin: observation.cabin,
    airline: observation.source,
    observedDate: observation.observedDate,
    directness: observation.fareDirectness === 'direct' || observation.fareDirectness === 'connecting' ? observation.fareDirectness : null,
    outboundStops: observation.outboundStops ?? null,
    returnStops: observation.returnStops ?? null,
    journeyConsequences: consequences,
    isCurrentRepresentativeFare,
  };
}

/**
 * The one function that assembles everything the brief's first four answers
 * need, purely from canonical sources, for a given evaluation date — see
 * this file's own header comment for why each source is the one to trust.
 * Returns `null` only if the route itself can't be resolved at all (should
 * never happen in production for this hardcoded slug; exists so the
 * component can fail closed instead of throwing).
 */
export function assembleManchesterMumbaiBrief(nowIso: string): ManchesterMumbaiBrief | null {
  const route = getRouteBySlug(MANCHESTER_MUMBAI_ROUTE_SLUG);
  if (!route) return null;

  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  const rawStatus = getRouteStatus(route, routeStatusEvents, nowIso);
  const routeStatusCopy = rawStatus ? getRouteStatusCopy(route, rawStatus, routeStatusEvents, nowIso) : null;

  const destinationIataCode = getDestinationBySlug(route.destinationSlug)?.iataCode ?? null;

  const fareSignal: FareSignalData = getFareSignalForRoute(MANCHESTER_MUMBAI_ROUTE_SLUG, nowIso);
  let evidencedOption: EvidencedFareOption | null = null;
  const hasCurrentFareSignal = fareSignal.state === 'current';

  if (fareSignal.observation && (fareSignal.state === 'current' || fareSignal.state === 'recent')) {
    // A genuine current/recent Fare Signal observation carries the same
    // sanitised fields toSignalObservation() already produced — journey
    // consequences are already computed there, reused verbatim rather than
    // recomputed against the raw record a second time.
    evidencedOption = {
      price: fareSignal.observation.price,
      currency: fareSignal.observation.currency ?? 'GBP',
      cabin: fareSignal.observation.cabin,
      airline: fareSignal.observation.airline,
      observedDate: fareSignal.observation.observedDate,
      directness: fareSignal.observation.directness,
      outboundStops: fareSignal.observation.outboundStops,
      returnStops: fareSignal.observation.returnStops,
      journeyConsequences: fareSignal.observation.journeyConsequences,
      isCurrentRepresentativeFare: fareSignal.state === 'current',
    };
  } else {
    // No current/recent representative fare (true today: the route's
    // service-ended status makes every observation publishable=false for
    // Fare Signal's own purposes — see isObservationPublishable). Fall back
    // to the single most recent PUBLICLY PUBLISHABLE historical check —
    // exactly the same predicate FareHistoryPanel uses, so this can never
    // show a check FareHistoryPanel itself would consider incomplete.
    // Framed explicitly as a past check, never as a current price.
    const historical = getObservationsByRoute(MANCHESTER_MUMBAI_ROUTE_SLUG)
      .filter(isPubliclyPublishable)
      .filter((o) => isObservationCausallyAvailable(o, nowIso))
      .sort((a, b) => b.observedDate.localeCompare(a.observedDate));
    if (historical.length > 0) {
      evidencedOption = toEvidencedOption(historical[0], destinationIataCode, false);
    }
  }

  return {
    routeReality: {
      headline: presentation.summary,
      badgeLabel: presentation.statusLabel,
      detail: routeStatusCopy,
    },
    evidencedOption,
    hasCurrentFareSignal,
    tripComUrl: getTripComFlightHandoffUrl(MANCHESTER_MUMBAI_ROUTE_SLUG),
  };
}

export { formatRouteStatusDate };

export type PrimaryNextAction =
  | { kind: 'check-travel-ready'; label: string; reason: string }
  | { kind: 'search-current-options'; label: string; reason: string }
  | { kind: 'enter-travel-details'; label: string; reason: string };

/**
 * The one dominant next step — worst-true-signal-wins, the same philosophy
 * lib/travel-intelligence-engine.ts's computeReadiness() and the old
 * prototype's own getDominantAction() both already used. Simplified from
 * the old version: the withdrawal-boundary date-comparison branch is gone
 * entirely (obsolete now the withdrawal has already taken effect and been
 * confirmed — every date a traveller could now enter is permanently "after"
 * it, so that branch could never again return anything but the same
 * "search current options" outcome; keeping dead comparison logic around
 * would only invite it to silently disagree with the ledger again).
 */
export function getManchesterMumbaiNextAction(input: {
  hasEnteredTravelDetails: boolean;
  travelReadySignal: TravelReadySignal | null;
  hasCurrentFareSignal: boolean;
}): PrimaryNextAction {
  const { hasEnteredTravelDetails, travelReadySignal, hasCurrentFareSignal } = input;
  if (travelReadySignal?.severity === 'critical') {
    return {
      kind: 'check-travel-ready',
      label: 'Check your travel readiness first',
      reason: travelReadySignal.detail,
    };
  }
  if (!hasEnteredTravelDetails) {
    return {
      kind: 'enter-travel-details',
      label: 'Add your travel dates and passport details above',
      reason: 'JetStash needs your dates and passport status to give a dated entry-readiness check, rather than a generic one.',
    };
  }
  return {
    kind: 'search-current-options',
    label: hasCurrentFareSignal ? 'Check today’s price' : 'Search current options on Trip.com',
    reason: hasCurrentFareSignal
      ? 'JetStash has a recent tracked fare for this route.'
      : "JetStash doesn't currently track a live representative fare for this route since the direct service ended — search current options directly.",
  };
}
