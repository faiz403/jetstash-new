import type { FareObservation } from '@/data/fare-observations';
import { evaluateFareWatcherCandidates, isFareWatcherCleanEvidence, type FareWatcherQualificationResult } from '@/lib/fare-watcher';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';
import { isPoorItinerarySuitability } from '@/lib/itinerary-suitability';
import {
  checkManifestCompleteness,
  generateFareObservationCode,
  summarizeWeeklyFareBatch,
  validateWeeklyFareEvidenceBatch,
  type WeeklyFareEvidenceEntry,
  type WeeklyFareProfile,
  type WeeklyFareValidationResult,
} from '@/lib/weekly-fare-ingest';

/**
 * Pure, dry-run composition for a manually collected fare batch. It accepts
 * only evidence already seen by a researcher; it neither searches providers
 * nor writes to the archive. The fare qualification and suitability rules
 * remain the existing canonical implementations.
 */
export type FareWatcherOperatorDisposition =
  | 'invalid'
  | 'no-result'
  | 'ordinary'
  | 'suppressed-poor-itinerary'
  | 'suppressed-self-transfer'
  | 'suppressed-unknown-directness'
  | 'founder-review-required';

export interface FareWatcherOperatorEntry {
  validation: WeeklyFareValidationResult;
  preparedCode: string | null;
  qualification: FareWatcherQualificationResult | null;
  selfTransfer: boolean | null;
  itineraryEvidenceComplete: boolean | null;
  poorItinerary: boolean | null;
  disposition: FareWatcherOperatorDisposition;
}

export interface FareWatcherOperatorReport {
  dryRun: true;
  entries: FareWatcherOperatorEntry[];
  summary: ReturnType<typeof summarizeWeeklyFareBatch>;
  completeness: { missing: string[]; unexpected: string[] } | null;
}

export function prepareFareWatcherOperatorReport(
  entries: readonly WeeklyFareEvidenceEntry[],
  profile: WeeklyFareProfile,
  existingObservations: readonly FareObservation[],
  expectedRouteSlugs?: readonly string[]
): FareWatcherOperatorReport {
  const validations = validateWeeklyFareEvidenceBatch(entries, profile, existingObservations);
  const operatorEntries = validations.map((validation): FareWatcherOperatorEntry => {
    const observation = validation.preparedObservation;
    if (!observation) {
      return {
        validation,
        preparedCode: null,
        qualification: null,
        selfTransfer: null,
        itineraryEvidenceComplete: null,
        poorItinerary: null,
        disposition: validation.status === 'NO RESULT' ? 'no-result' : 'invalid',
      };
    }

    const evaluation = evaluateFareWatcherCandidates(
      [...existingObservations, observation], profile.observedDate
    ).find((item) => item.detection.id === observation.id || item.qualification?.candidate.id === observation.id);
    const qualification = evaluation?.qualification ?? null;
    const itineraryEvidenceComplete = Number.isInteger(observation.outboundStops)
      && Number.isInteger(observation.returnStops);
    const poorItinerary = itineraryEvidenceComplete
      ? isPoorItinerarySuitability(observation)
      : null;
    const selfTransfer = isSelfTransferItinerary(observation.priceNote);
    const disposition: FareWatcherOperatorDisposition = poorItinerary === true
      ? 'suppressed-poor-itinerary'
      : !isFareWatcherCleanEvidence(observation)
        ? selfTransfer ? 'suppressed-self-transfer' : 'suppressed-unknown-directness'
      : !evaluation?.candidate
        ? 'ordinary'
        : 'founder-review-required';

    return {
      validation,
      preparedCode: generateFareObservationCode(validation),
      qualification,
      selfTransfer,
      itineraryEvidenceComplete,
      poorItinerary,
      disposition,
    };
  });

  return {
    dryRun: true,
    entries: operatorEntries,
    summary: summarizeWeeklyFareBatch(validations),
    completeness: expectedRouteSlugs ? checkManifestCompleteness(entries, expectedRouteSlugs) : null,
  };
}
