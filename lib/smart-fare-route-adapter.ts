import {
  getPublishableObservationsByRoute,
  type FareObservation,
} from '@/data/fare-observations';
import {
  deriveSmartFareComparison,
  type SmartFareBaggage,
  type SmartFareComparison,
  type SmartFareOption,
} from '@/lib/smart-fare-comparison';

function mapBaggage(observation: FareObservation): SmartFareBaggage {
  const detail = observation.baggage ?? 'Baggage allowance and charges were not stated.';
  const lower = detail.toLowerCase();
  if (lower.includes('included')) return { kind: 'included', detail };
  if (lower.includes('fee') && !lower.includes('may apply')) {
    return { kind: 'extra-charge-unknown', detail };
  }
  if (lower.includes('optional charges') || lower.includes('costs extra')) {
    return { kind: 'extra-charge-unknown', detail };
  }
  return { kind: 'not-stated', detail };
}

function toSmartFareOption(observation: FareObservation): SmartFareOption | null {
  if (!observation.departureDate || !observation.returnDate || !observation.currency) return null;
  if (!observation.fareDirectness || observation.fareDirectness === 'unknown') return null;

  const outboundStops = observation.outboundStops ?? null;
  const returnStops = observation.returnStops ?? null;
  const totalStops = outboundStops !== null && returnStops !== null
    ? outboundStops + returnStops
    : null;

  return {
    id: observation.id,
    airline: observation.source,
    price: observation.price,
    currency: observation.currency,
    departureDate: observation.departureDate,
    returnDate: observation.returnDate,
    checkedDate: observation.observedDate,
    directness: observation.fareDirectness,
    stops: totalStops,
    outboundStops,
    returnStops,
    connectionAirports: [...new Set([
      ...(observation.outboundConnectionAirports ?? []),
      ...(observation.returnConnectionAirports ?? []),
    ])],
    outboundJourneyMinutes: observation.outboundJourneyMinutes ?? null,
    returnJourneyMinutes: observation.returnJourneyMinutes ?? null,
    outboundLayoverMinutes: observation.outboundLayoverMinutes ?? [],
    returnLayoverMinutes: observation.returnLayoverMinutes ?? [],
    baggage: mapBaggage(observation),
    mandatoryFees: [],
    mandatoryFeeEvidence: 'incomplete',
  };
}

/**
 * Selects only explicitly current, structured observations. Historical fares
 * stay in the archive and are never silently mixed into a current comparison.
 */
export function getSmartFareComparisonForRoute(routeSlug: string, nowIso: string): SmartFareComparison | null {
  const options = getPublishableObservationsByRoute(routeSlug, nowIso)
    .filter((observation) => observation.comparisonEligibility === 'current')
    .map(toSmartFareOption)
    .filter((option): option is SmartFareOption => option !== null)
    .slice(0, 3);

  return options.length >= 2 ? deriveSmartFareComparison(options) : null;
}
