import {
  getPublishableObservationsByRoute,
  isPubliclyPublishable,
  type FareObservation,
} from '@/data/fare-observations';
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
 * Derives the single public Fare Signal from the same publishability and
 * freshness rules used by the existing fare surfaces. Historical entries can
 * remain in the archive, but never displace a current observation when one is
 * available. V1 deliberately has no stronger-price signal: the archive does
 * not yet provide a defensible same-profile baseline for every route.
 */
export function deriveFareSignal(observations: FareObservation[], nowIso: string): FareSignal {
  const { observation: latest, historicalOnly } = selectLatestObservation(observations);
  const observation = latest ? toSignalObservation(latest) : null;
  if (!latest || !observation) {
    return { state: 'none', observation: null, freshness: null, strongerSignal: null };
  }

  const freshness = getFareFreshnessState(daysBetweenIso(latest.observedDate, nowIso));
  return {
    state: freshness === 'fresh' && !historicalOnly ? 'current' : 'recent',
    observation,
    freshness,
    strongerSignal: null,
  };
}

export function getFareSignalForRoute(routeSlug: string, nowIso: string): FareSignal {
  return deriveFareSignal(getPublishableObservationsByRoute(routeSlug, nowIso), nowIso);
}

/** A route with any renderable Fare Signal must not show the no-fare fallback. */
export function shouldShowNoFareFallback(fareSignal: FareSignal): boolean {
  return fareSignal.state === 'none';
}
