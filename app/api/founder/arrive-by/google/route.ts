import { NextRequest, NextResponse } from 'next/server';
import {
  buildGoogleNoTransitPrototypeResult,
  buildGooglePrototypeResult,
  GOOGLE_ARRIVE_BY_ORIGINS,
  GOOGLE_ROUTE_FIELD_MASK,
  googleRoutesRequest,
  googleDriveRequest,
  localDateTimeToIso,
  normaliseGoogleItinerary,
  type GoogleOriginId,
  type GooglePrototypeInput,
  type GoogleRoutesResponse,
} from '@/lib/arrive-by/google-routes';
import { resolveDestination } from '@/lib/arrive-by-shared/destination-resolution';

export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const MAX_PLACE_ID_LENGTH = 200;

function founderEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

function cleanInput(value: unknown): GooglePrototypeInput {
  if (!value || typeof value !== 'object') throw new Error('Enter the journey details.');
  const body = value as Record<string, unknown>;
  const originId = typeof body.originId === 'string' ? body.originId as GoogleOriginId : '' as GoogleOriginId;
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  const availableAt = typeof body.availableAt === 'string' ? body.availableAt : '';
  const deadline = typeof body.deadline === 'string' ? body.deadline : '';
  const deadlineReason = typeof body.deadlineReason === 'string' ? body.deadlineReason.trim() : '';
  const readinessRaw = body.readinessMinutes;
  const readinessMinutes = readinessRaw === undefined || readinessRaw === '' ? undefined : readinessRaw;
  if (!Object.prototype.hasOwnProperty.call(GOOGLE_ARRIVE_BY_ORIGINS, originId)) throw new Error('Choose a supported terminal.');
  if (destination.length < 3 || destination.length > 180) throw new Error('Enter a final destination.');
  if (deadlineReason.length > 140) throw new Error('Keep the deadline reason under 140 characters.');
  if (readinessMinutes !== undefined && (typeof readinessMinutes !== 'number' || !Number.isSafeInteger(readinessMinutes) || readinessMinutes < 0 || readinessMinutes > 720)) {
    throw new Error('Enter a readiness time from 0 to 720 minutes.');
  }
  const timeZone = GOOGLE_ARRIVE_BY_ORIGINS[originId].timeZone;
  const availableIso = localDateTimeToIso(availableAt, timeZone);
  const deadlineIso = localDateTimeToIso(deadline, timeZone);
  if (Date.parse(deadlineIso) <= Date.parse(availableIso)) throw new Error('The deadline must be after the time you are ready to leave the terminal.');
  const confirmedPlaceIdRaw = body.confirmedPlaceId;
  if (typeof confirmedPlaceIdRaw === 'string' && confirmedPlaceIdRaw.length > MAX_PLACE_ID_LENGTH) throw new Error('That confirmation reference is not valid.');
  const confirmedPlaceId = typeof confirmedPlaceIdRaw === 'string' && confirmedPlaceIdRaw ? confirmedPlaceIdRaw : undefined;
  const selectedPlaceIdRaw = body.selectedPlaceId;
  if (typeof selectedPlaceIdRaw === 'string' && selectedPlaceIdRaw.length > MAX_PLACE_ID_LENGTH) throw new Error('That selection reference is not valid.');
  const selectedPlaceId = typeof selectedPlaceIdRaw === 'string' && selectedPlaceIdRaw ? selectedPlaceIdRaw : undefined;
  return { originId, destination, availableAt, deadline, deadlineReason, readinessMinutes: readinessMinutes as number | undefined, confirmedPlaceId, selectedPlaceId };
}

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

export async function POST(request: NextRequest) {
  if (!founderEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Live journey lookup is not configured.' }, { status: 503 });
  try {
    const input = cleanInput(await request.json());
    const timeZone = GOOGLE_ARRIVE_BY_ORIGINS[input.originId].timeZone;

    // Destination-safety gate, shared with Pakistan's engine (see
    // lib/arrive-by-shared/destination-resolution.ts). Manchester runs no
    // country gate yet -- its destination-country policy is deliberately
    // POLICY_PENDING in the airport registry until explicitly validated --
    // but still gets venue confirmation, multi-POI selection and the other
    // generic safety checks that previously didn't exist here at all. The
    // transit/car engine below is never reached until this resolves to
    // CONFIRMED.
    const destinationResolution = await resolveDestination(apiKey, input.destination, {});
    const confirmed = Boolean(input.confirmedPlaceId) && destinationResolution.placeId === input.confirmedPlaceId && destinationResolution.confidence === 'NEEDS_CONFIRMATION';
    const selectedCandidate = destinationResolution.confidence === 'NEEDS_SELECTION' && input.selectedPlaceId
      ? destinationResolution.candidates?.find((candidate) => candidate.placeId === input.selectedPlaceId)
      : undefined;
    const destinationConfidence = confirmed || selectedCandidate ? 'CONFIRMED' : destinationResolution.confidence;
    if (destinationConfidence !== 'CONFIRMED') {
      return NextResponse.json({
        transitStatus: 'DESTINATION_PENDING',
        destinationConfidence,
        clarificationReason: confirmed || selectedCandidate ? undefined : destinationResolution.clarificationReason,
        pendingConfirmation: destinationConfidence === 'NEEDS_CONFIRMATION' && destinationResolution.placeId && destinationResolution.formattedAddress
          ? { placeId: destinationResolution.placeId, formattedAddress: destinationResolution.formattedAddress }
          : undefined,
        pendingSelection: destinationConfidence === 'NEEDS_SELECTION' && destinationResolution.candidates
          ? { candidates: destinationResolution.candidates }
          : undefined,
      });
    }
    const resolvedDestinationText = selectedCandidate?.formattedAddress ?? destinationResolution.formattedAddress ?? input.destination;
    // Only the text handed to Google's own APIs changes; buildGoogle*
    // below still receives the traveller's original `input` so the
    // displayed `destination` field stays their own typed text, matching
    // Pakistan's existing pattern (destination shown, resolvedDestination
    // separate).
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
      return NextResponse.json(buildGoogleNoTransitPrototypeResult(input, immediateDriveResponse));
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
    return NextResponse.json(buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, new Date().toISOString(), driveResponses));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Arrive By could not check this journey.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
