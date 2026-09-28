import {
  buildGoogleNoTransitPrototypeResult,
  buildGooglePrototypeResult,
  GOOGLE_ARRIVE_BY_ORIGINS,
  GOOGLE_ROUTE_FIELD_MASK,
  googleRoutesRequest,
  googleDriveRequest,
  localDateTimeToIso,
  normaliseGoogleItinerary,
  type GooglePrototypeInput,
  type GooglePrototypeResult,
  type GoogleDestinationPendingResult,
  type GoogleRoutesResponse,
} from '@/lib/arrive-by/google-routes';
import { resolveDestination, type DestinationResolutionConfig } from './destination-resolution';

/**
 * Network-calling orchestration for Manchester journeys, shared by the
 * founder route (app/api/founder/arrive-by/google/route.ts) and the public
 * route (app/api/arrive-by-manchester/google/route.ts) so the transit/car
 * engine and destination-safety gate are never duplicated.
 *
 * Deliberately NOT inside lib/arrive-by: that directory is the Stage 1
 * engine, which tests/arrive-by-integrity.test.ts asserts makes no network
 * call and is importable only by the sanctioned founder-only files. This
 * file is the layer above it that actually calls Google — it imports the
 * engine's pure request-builders/response-parsers/judgement functions but
 * owns every fetch() call itself, and public app/component files import
 * THIS file, never lib/arrive-by directly.
 */

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

async function callGoogle(apiKey: string, body: unknown): Promise<GoogleRoutesResponse> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_ROUTE_FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Google did not return a usable route.');
    return response.json() as Promise<GoogleRoutesResponse>;
  } catch {
    throw new Error('Google could not return this journey. Check the locations and try again.');
  }
}

export async function computeManchesterJourney(
  apiKey: string,
  input: GooglePrototypeInput,
  destinationRules: DestinationResolutionConfig,
): Promise<GooglePrototypeResult | GoogleDestinationPendingResult> {
  const timeZone = GOOGLE_ARRIVE_BY_ORIGINS[input.originId].timeZone;

  // Destination-safety gate, shared with Pakistan's engine (see
  // destination-resolution.ts in this same directory). The transit/car
  // engine below is never reached until this resolves to CONFIRMED.
  const destinationResolution = await resolveDestination(apiKey, input.destination, destinationRules);
  const confirmed = Boolean(input.confirmedPlaceId) && destinationResolution.placeId === input.confirmedPlaceId && destinationResolution.confidence === 'NEEDS_CONFIRMATION';
  const selectedCandidate = destinationResolution.confidence === 'NEEDS_SELECTION' && input.selectedPlaceId
    ? destinationResolution.candidates?.find((candidate) => candidate.placeId === input.selectedPlaceId)
    : undefined;
  const destinationConfidence = confirmed || selectedCandidate ? 'CONFIRMED' : destinationResolution.confidence;
  if (destinationConfidence !== 'CONFIRMED') {
    return {
      transitStatus: 'DESTINATION_PENDING',
      destinationConfidence,
      clarificationReason: confirmed || selectedCandidate ? undefined : destinationResolution.clarificationReason,
      pendingConfirmation: destinationConfidence === 'NEEDS_CONFIRMATION' && destinationResolution.placeId && destinationResolution.formattedAddress
        ? { placeId: destinationResolution.placeId, formattedAddress: destinationResolution.formattedAddress }
        : undefined,
      pendingSelection: destinationConfidence === 'NEEDS_SELECTION' && destinationResolution.candidates
        ? { candidates: destinationResolution.candidates }
        : undefined,
    };
  }
  const resolvedDestinationText = selectedCandidate?.formattedAddress ?? destinationResolution.formattedAddress ?? input.destination;
  // Only the text handed to Google's own APIs changes; buildGoogle* below
  // still receives the traveller's original `input` so the displayed
  // `destination` field stays their own typed text, matching Pakistan's
  // existing pattern (destination shown, resolvedDestination separate).
  const resolvedInput: typeof input = { ...input, destination: resolvedDestinationText };

  // Ask Google for the best journey that reaches the required time, then
  // let the unchanged Arrive By engine test whether the traveller's stated
  // ready time can actually catch it. The second request below advances
  // past that itinerary's first important service.
  const deadlineIso = localDateTimeToIso(input.deadline, timeZone);
  const primaryResponse = await callGoogle(apiKey, googleRoutesRequest(resolvedInput, { arrivalTime: deadlineIso }));
  let primary: ReturnType<typeof normaliseGoogleItinerary> | null = null;
  try {
    primary = normaliseGoogleItinerary(primaryResponse);
  } catch {
    // A response with no usable transit itinerary does not answer whether
    // choosing a direct car from the entered ready time can still work.
  }
  if (!primary) {
    const immediateDeparture = localDateTimeToIso(input.availableAt, timeZone);
    let immediateDriveResponse: GoogleRoutesResponse | null;
    try {
      immediateDriveResponse = await callGoogle(apiKey, googleDriveRequest(resolvedInput, immediateDeparture));
    } catch {
      immediateDriveResponse = null;
    }
    return buildGoogleNoTransitPrototypeResult(input, immediateDriveResponse);
  }
  const missedServiceDeparture = new Date(Date.parse(primary.firstImportantService.departureTime) + 60000).toISOString();
  const fallbackResponse = await callGoogle(apiKey, googleRoutesRequest(resolvedInput, { departureTime: missedServiceDeparture }));
  const preliminary = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, new Date().toISOString());
  const driveResponses: {
    immediateCar?: GoogleRoutesResponse | null;
    missedServiceCarRescue?: GoogleRoutesResponse | null;
  } = {};
  if (!preliminary.judgement.meetsDeadline) {
    const immediateDeparture = localDateTimeToIso(input.availableAt, timeZone);
    try {
      driveResponses.immediateCar = await callGoogle(apiKey, googleDriveRequest(resolvedInput, immediateDeparture));
    } catch {
      driveResponses.immediateCar = null;
    }
  } else if (!preliminary.fallbackJudgement.meetsDeadline) {
    try {
      driveResponses.missedServiceCarRescue = await callGoogle(apiKey, googleDriveRequest(resolvedInput, primary.firstImportantService.departureTime));
    } catch {
      driveResponses.missedServiceCarRescue = null;
    }
  }
  return buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, new Date().toISOString(), driveResponses);
}

export type {
  GooglePrototypeResult, GoogleDestinationPendingResult, GoogleTransitPrototypeResult,
  GoogleNoTransitPrototypeResult, GoogleCarRescue, GoogleItinerary, GoogleJourneyLeg,
} from '@/lib/arrive-by/google-routes';

export type TopLevelOutcome = 'TRANSIT_WORKS' | 'IMMEDIATE_CAR_MAY_WORK' | 'NO_TRANSIT_CAR_MAY_WORK' | 'NO_CHECKED_OPTION_WORKS' | 'TRANSIT_LATE_CAR_UNAVAILABLE' | 'JOURNEY_NOT_CONFIRMED';

type ResolvedGooglePrototypeResult = Extract<GooglePrototypeResult, { transitStatus: 'AVAILABLE' | 'UNAVAILABLE' }>;

/** Pure classifier over a resolved (non-pending) journey result — shared by the founder and public Manchester components so the "what does this outcome mean" logic lives in exactly one place. */
export function topLevelOutcome(result: ResolvedGooglePrototypeResult): TopLevelOutcome {
  if (result.transitStatus === 'UNAVAILABLE') {
    if (result.immediateCar.status !== 'AVAILABLE') return 'JOURNEY_NOT_CONFIRMED';
    return result.immediateCar.meetsReadyBy ? 'NO_TRANSIT_CAR_MAY_WORK' : 'NO_CHECKED_OPTION_WORKS';
  }
  if (result.judgement.meetsDeadline) return 'TRANSIT_WORKS';
  if (result.immediateCar?.status !== 'AVAILABLE') return 'TRANSIT_LATE_CAR_UNAVAILABLE';
  return result.immediateCar.meetsReadyBy ? 'IMMEDIATE_CAR_MAY_WORK' : 'NO_CHECKED_OPTION_WORKS';
}

export function topLevelVerdict(result: ResolvedGooglePrototypeResult, deadlineClock: string): string {
  const outcome = topLevelOutcome(result);
  if (outcome === 'IMMEDIATE_CAR_MAY_WORK') return 'Public transport is too late, but a car may still get you there in time.';
  if (outcome === 'NO_TRANSIT_CAR_MAY_WORK') return 'No public-transport journey was found, but a car may still get you there in time.';
  if (outcome === 'NO_CHECKED_OPTION_WORKS') return 'No — none of the checked options get you there in time.';
  if (outcome === 'TRANSIT_LATE_CAR_UNAVAILABLE') return 'Public transport is too late, and a car estimate could not be confirmed.';
  if (outcome === 'JOURNEY_NOT_CONFIRMED') return 'Journey not confirmed.';
  return result.readinessMinutes > 0
    ? `Yes — you can be ready by ${deadlineClock}`
    : `Yes — you can reach ${result.destination} by ${deadlineClock}`;
}
