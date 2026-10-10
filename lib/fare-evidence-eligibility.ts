import type { FareObservation } from '@/data/fare-observations';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';

/** Known itinerary directness and no explicit self-transfer/separate-ticket label. */
export function isCleanFareEvidence(observation: FareObservation): boolean {
  return !isSelfTransferItinerary(observation.priceNote)
    && (observation.fareDirectness === 'direct' || observation.fareDirectness === 'connecting');
}
