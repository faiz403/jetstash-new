import { getPakistanAirport } from './airports';
import { geocodeDestination, computeDriveRoute } from './google-routes';
import { localDateTimeToIso } from './timezone';
import { classifyOutcome } from './outcomes';
import type { PakistanJourneyInput, PakistanJourneyResult } from './types';

/**
 * The one calculation this whole module exists for:
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
 * All times are computed in the airport's own timeZone, never the
 * visitor's browser zone, and a deadline pass/fail verdict is never
 * issued unless the destination geocodes with CONFIRMED confidence.
 */
export async function computePakistanJourney(apiKey: string, input: PakistanJourneyInput): Promise<PakistanJourneyResult> {
  const airport = getPakistanAirport(input.airportCode);
  const landingMs = Date.parse(localDateTimeToIso(input.landingAt, airport.timeZone));
  const readyOutsideMs = landingMs + input.airportExitBufferMinutes * 60000;
  const pickupWaitMs = (input.pickupWaitMinutes ?? 0) * 60000;
  const roadDepartureMs = readyOutsideMs + pickupWaitMs;
  const roadDepartureIso = new Date(roadDepartureMs).toISOString();

  const geocode = await geocodeDestination(apiKey, input.destination);

  const base = {
    airport: { code: airport.code, displayName: airport.displayName, timeZone: airport.timeZone },
    destination: input.destination,
    destinationConfidence: geocode.confidence,
    deadlineReason: input.deadlineReason,
    readyOutsideAirport: new Date(readyOutsideMs).toISOString(),
    roadDeparture: roadDepartureIso,
  };

  // STRICT RULE: never issue a deadline pass/fail verdict, or even attempt
  // the drive request, unless the destination resolved with confidence.
  if (geocode.confidence !== 'CONFIRMED') {
    return {
      ...base,
      outcome: geocode.confidence === 'NEEDS_CLARIFICATION' ? 'DESTINATION_NEEDS_CLARIFICATION' : 'ROUTE_UNAVAILABLE',
    };
  }

  const drive = await computeDriveRoute(apiKey, airport.routingAddress, geocode.formattedAddress ?? input.destination, roadDepartureIso);
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
    distanceMeters: drive.distanceMeters,
    deadline: deadlineIso,
    latestAcceptableArrival,
    marginMinutes,
  };
}
