import type { FareObservation } from '@/data/fare-observations';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';

/** Positive record-level evidence that the fare is sold as one itinerary. */
const NEGATED_SINGLE_ITINERARY_PATTERNS = [
  /\bno\s+(?:a\s+)?(?:single|one)\s+(?:[a-z-]+\s+)?(?:ticket|itinerary|booking)\b/i,
  /\bnot\s+(?:(?:covered|protected)\s+by\s+)?(?:a\s+)?(?:single|one)\s+(?:[a-z-]+\s+)?(?:ticket|itinerary|booking)\b/i,
  /\bnot\s+(?:booked|sold|issued)\s+(?:as|on)\s+(?:one|a single)\s+(?:ticket|itinerary|booking)\b/i,
  /\bwithout\s+(?:a\s+)?(?:single|one)\s+(?:[a-z-]+\s+)?(?:ticket|itinerary|booking)\b/i,
  /\bnever\s+(?:a\s+)?(?:single|one)\s+(?:[a-z-]+\s+)?(?:ticket|itinerary|booking)\b/i,
];

export function hasPositiveNonSelfTransferEvidence(observation: FareObservation): boolean {
  const note = observation.priceNote;
  if (isSelfTransferItinerary(note)) return false;
  if (NEGATED_SINGLE_ITINERARY_PATTERNS.some((pattern) => pattern.test(note))) return false;
  return /\b(?:single\s+(?:ticket|itinerary|booking)|booked\s+(?:as|on)\s+(?:one|a single)\s+(?:ticket|itinerary)|standard interline booking)\b/i.test(note);
}

/** Known itinerary directness and no explicit self-transfer/separate-ticket label. */
export function isCleanFareEvidence(observation: FareObservation): boolean {
  return !isSelfTransferItinerary(observation.priceNote)
    && (observation.fareDirectness === 'direct' || observation.fareDirectness === 'connecting');
}
