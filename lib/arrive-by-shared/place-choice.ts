import { resolveDestination, type DestinationClarificationReason, type DestinationConfidence, type DestinationResolutionConfig } from './destination-resolution';

/**
 * Resolves a free-text place AND applies the user's confirmation / selection
 * choice safely. Extracted from the road engine so the traveller's START
 * location and their DESTINATION go through exactly the same safety logic --
 * one implementation, not two that could drift.
 *
 * A prior NEEDS_CONFIRMATION result is only honoured if Google, asked again
 * right now, independently resolves to that exact placeId as a single,
 * non-ambiguous, non-partial match. The client's claim that a human said
 * "yes" is never trusted by itself: this re-check is what stops confirmation
 * from ever overriding an unresolved, ambiguous, or now-different result.
 * Likewise a candidate picked from a NEEDS_SELECTION list must still be one
 * of the candidates Google returns right now for the same text -- a forged,
 * stale, or no-longer-offered placeId is simply not found and falls through
 * to the real (safe) classification.
 */

export interface PlaceChoiceInput {
  confirmedPlaceId?: string;
  selectedPlaceId?: string;
}

export interface ResolvedPlace {
  confidence: DestinationConfidence;
  /** Google's own resolved address -- what a traveller sees to spot a wrong-place match. */
  resolvedAddress?: string;
  /** Google's point for the resolved place when it came from the top result (not available for a candidate picked from a list). Server-side only. */
  location?: { lat: number; lng: number };
  clarificationReason?: DestinationClarificationReason;
  pendingConfirmation?: { placeId: string; formattedAddress: string };
  pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string }> };
}

export async function resolvePlaceWithChoice(
  apiKey: string,
  text: string,
  rules: DestinationResolutionConfig,
  choice: PlaceChoiceInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedPlace> {
  const geocode = await resolveDestination(apiKey, text, rules, fetchImpl);
  const confirmed = Boolean(choice.confirmedPlaceId) && geocode.placeId === choice.confirmedPlaceId && geocode.confidence === 'NEEDS_CONFIRMATION';
  const selectedCandidate =
    geocode.confidence === 'NEEDS_SELECTION' && choice.selectedPlaceId
      ? geocode.candidates?.find((candidate) => candidate.placeId === choice.selectedPlaceId)
      : undefined;
  const confidence = confirmed || selectedCandidate ? 'CONFIRMED' : geocode.confidence;
  return {
    confidence,
    resolvedAddress: selectedCandidate?.formattedAddress ?? geocode.formattedAddress,
    location: selectedCandidate ? undefined : geocode.location,
    clarificationReason: confirmed || selectedCandidate ? undefined : geocode.clarificationReason,
    pendingConfirmation:
      confidence === 'NEEDS_CONFIRMATION' && geocode.placeId && geocode.formattedAddress
        ? { placeId: geocode.placeId, formattedAddress: geocode.formattedAddress }
        : undefined,
    pendingSelection: confidence === 'NEEDS_SELECTION' && geocode.candidates ? { candidates: geocode.candidates } : undefined,
  };
}
