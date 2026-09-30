import type { Origin } from './airport-registry';
import type { DestinationResolutionConfig } from './destination-resolution';
import { resolvePlaceWithChoice } from './place-choice';
import { computeDriveRouteFrom } from './road-routes';
import { localDateTimeToIso } from './timezone';
import { classifyOutcome } from './road-outcomes';
import type { RoadJourneyInput, RoadJourneyResult } from './road-types';

/**
 * The one road-first calculation, for every ROAD_PICKUP_FIRST airport:
 *
 *   readyOutsideAirport = landingTime + airportExitBuffer
 *   roadDeparture       = readyOutsideAirport + pickupWait
 *   expectedArrival     = roadDeparture + trafficAwareDriveDuration
 *
 * and, only if a deadline was supplied:
 *
 *   latestAcceptableArrival = deadline - destinationReadinessBuffer
 *   margin                  = latestAcceptableArrival - expectedArrival
 *
 * Everything airport-specific arrives as `RoadJourneyAirport` and
 * `rules`, resolved server-side from an AirportProfile (the override
 * registry, or the catalogue-derived generic profile). Nothing here knows
 * about any country or airport, and nothing is invented: immigration,
 * baggage, taxi wait and fares are the user's inputs or absent.
 *
 * All times are computed in the airport's own timeZone, never the visitor's
 * browser zone, and a deadline verdict is never issued unless the
 * destination geocodes with CONFIRMED confidence. lib/arrive-by-pakistan/
 * journey.ts is now a thin caller of this function.
 */

export interface RoadJourneyAirport {
  code: string;
  displayName: string;
  timeZone: string;
  /** Trusted, server-resolved routing origin: a validated address (Pakistan) or catalogue coordinates (generic). */
  origin: Origin;
}

export async function computeRoadJourney(
  apiKey: string,
  airport: RoadJourneyAirport,
  input: RoadJourneyInput,
  rules: DestinationResolutionConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<RoadJourneyResult> {
  const landingMs = Date.parse(localDateTimeToIso(input.landingAt, airport.timeZone));
  const readyOutsideMs = landingMs + input.airportExitBufferMinutes * 60000;
  const pickupWaitMs = (input.pickupWaitMinutes ?? 0) * 60000;
  const roadDepartureMs = readyOutsideMs + pickupWaitMs;
  const roadDepartureIso = new Date(roadDepartureMs).toISOString();

  // Resolution AND the confirm/select re-verification live in place-choice.ts, shared with the
  // full-journey start location so both go through one implementation of the safety rules.
  const place = await resolvePlaceWithChoice(apiKey, input.destination, rules, { confirmedPlaceId: input.confirmedPlaceId, selectedPlaceId: input.selectedPlaceId }, fetchImpl);
  const destinationConfidence = place.confidence;
  const resolvedDestination = place.resolvedAddress;

  const base = {
    airport: { code: airport.code, displayName: airport.displayName, timeZone: airport.timeZone },
    destination: input.destination,
    destinationConfidence,
    resolvedDestination,
    resolvedDisplay: place.display,
    clarificationReason: place.clarificationReason,
    pendingConfirmation: place.pendingConfirmation,
    pendingSelection: place.pendingSelection,
    deadlineReason: input.deadlineReason,
    readyOutsideAirport: new Date(readyOutsideMs).toISOString(),
    roadDeparture: roadDepartureIso,
  };

  // STRICT RULE: never issue a deadline pass/fail verdict, or even attempt
  // the drive request, unless the destination resolved with confidence.
  if (destinationConfidence !== 'CONFIRMED') {
    const outcome =
      destinationConfidence === 'NEEDS_CONFIRMATION'
        ? 'DESTINATION_NEEDS_CONFIRMATION'
        : destinationConfidence === 'NEEDS_SELECTION'
          ? 'DESTINATION_NEEDS_SELECTION'
          : destinationConfidence === 'NEEDS_CLARIFICATION'
            ? 'DESTINATION_NEEDS_CLARIFICATION'
            : 'ROUTE_UNAVAILABLE';
    return { ...base, outcome };
  }

  const drive = await computeDriveRouteFrom(apiKey, airport.origin, resolvedDestination ?? input.destination, roadDepartureIso, fetchImpl);
  if (drive.status !== 'AVAILABLE' || drive.durationSeconds === undefined) {
    return { ...base, outcome: 'ROUTE_UNAVAILABLE' };
  }

  const expectedArrivalMs = roadDepartureMs + drive.durationSeconds * 1000;
  const expectedArrival = new Date(expectedArrivalMs).toISOString();

  let deadlineIso: string | undefined;
  let latestAcceptableArrival: string | undefined;
  let marginMinutes: number | undefined;

  if (input.deadline) {
    deadlineIso = localDateTimeToIso(input.deadline, airport.timeZone);
    const readinessBufferMs = (input.destinationReadinessBufferMinutes ?? 0) * 60000;
    const latestMs = Date.parse(deadlineIso) - readinessBufferMs;
    latestAcceptableArrival = new Date(latestMs).toISOString();
    marginMinutes = Math.round((latestMs - expectedArrivalMs) / 60000);
  }

  const outcome = classifyOutcome({
    destinationConfidence: 'CONFIRMED',
    routeAvailable: true,
    hasDeadline: Boolean(input.deadline),
    marginMinutes,
  });

  return {
    ...base,
    outcome,
    expectedArrival,
    driveDurationSeconds: drive.durationSeconds,
    staticDurationSeconds: drive.staticDurationSeconds,
    distanceMeters: drive.distanceMeters,
    deadline: deadlineIso,
    latestAcceptableArrival,
    marginMinutes,
  };
}
