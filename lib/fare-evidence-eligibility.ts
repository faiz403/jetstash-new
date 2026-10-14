import type { FareObservation } from '@/data/fare-observations';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';

/** Positive record-level evidence that the fare is sold as one itinerary. */
export function hasPositiveNonSelfTransferEvidence(observation: FareObservation): boolean {
  return /\b(?:single\s+(?:ticket|itinerary|booking)|booked\s+(?:as|on)\s+(?:one|a single)\s+(?:ticket|itinerary)|standard interline booking)\b/i.test(observation.priceNote);
}

/** Known itinerary directness and no explicit self-transfer/separate-ticket label. */
export function isCleanFareEvidence(observation: FareObservation): boolean {
  return !isSelfTransferItinerary(observation.priceNote)
    && (observation.fareDirectness === 'direct' || observation.fareDirectness === 'connecting');
}
