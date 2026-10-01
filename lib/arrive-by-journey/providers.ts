import { resolveRoutingOrigin, POLICY_PENDING } from '../arrive-by-shared/airport-registry';
import { computeRoadJourney } from '../arrive-by-shared/road-journey';
import type { RoadJourneyResult } from '../arrive-by-shared/road-types';
import type { JourneyAirports } from './airports';
import type { GoogleCallLedger } from './call-budget';
import type { JourneyInput, NotEvidencedReason, ResolvedLeg } from './types';

/**
 * Leg providers. Each turns "something we can know" into a ResolvedLeg the
 * solver can use, and never invents a number: a leg that cannot be evidenced
 * is `NOT_EVIDENCED` with a reason.
 *
 * F1 ships exactly two:
 *  - enteredOriginLeg: the traveller's own start -> departure-airport estimate
 *    (F2 replaces it with a live Google leg);
 *  - roadArrivalLeg: the EXISTING shared road engine (destination resolver,
 *    confirm/select/country gates, traffic-aware DRIVE), unchanged, with every
 *    Google request metered through the journey's call ledger.
 */

export function enteredOriginLeg(minutes: number | undefined): ResolvedLeg {
  if (minutes === undefined || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 24 * 60) {
    return { status: 'NOT_EVIDENCED', reason: 'ORIGIN_LEG_MISSING', detail: 'Enter how long it takes you to get to the departure airport. Arrive By cannot look that up yet.' };
  }
  return { status: 'OK', expectedSeconds: minutes * 60, evidence: { kind: 'ENTERED', source: 'Your own start-to-airport estimate' } };
}

export interface ArrivalLegOutcome {
  leg: ResolvedLeg;
  /** The engine's own result, kept so a UI can offer confirmation / selection / clarification exactly as the arrival-only product does. */
  road?: RoadJourneyResult;
}

export async function roadArrivalLeg(
  apiKey: string,
  airports: JourneyAirports,
  input: JourneyInput,
  ledger: GoogleCallLedger,
  checkedAtIso: string,
): Promise<ArrivalLegOutcome> {
  const { profile } = airports.arrival;
  if (profile.destinationRules.expectedCountryCodes === POLICY_PENDING) {
    return { leg: { status: 'NOT_EVIDENCED', reason: 'AIRPORT_NOT_SUPPORTED', detail: "Arrive By can't calculate the journey from that arrival airport yet." } };
  }
  const road = await computeRoadJourney(
    apiKey,
    { code: profile.code, displayName: profile.displayName, timeZone: profile.timeZone, origin: resolveRoutingOrigin(profile) },
    {
      airportCode: profile.code,
      // The engine only needs the landing wall clock (in the arrival airport's zone) to ask Google for traffic at the right departure time.
      landingAt: input.flight.arrivesLocal,
      airportExitBufferMinutes: input.preferences.arrivalExitMinutes,
      pickupWaitMinutes: input.preferences.pickupWaitMinutes,
      destination: input.destination,
      pickupMode: input.preferences.pickupMode ?? 'other',
      confirmedPlaceId: input.confirmedPlaceId,
      selectedPlaceId: input.selectedPlaceId,
    },
    { expectedCountryCodes: profile.destinationRules.expectedCountryCodes, regionBias: profile.destinationRules.regionBias },
    ledger.fetch,
  );

  if (road.outcome === 'ETA_ONLY' && road.driveDurationSeconds !== undefined) {
    return {
      road,
      leg: { status: 'OK', expectedSeconds: road.driveDurationSeconds, staticSeconds: road.staticDurationSeconds, evidence: { kind: 'GOOGLE_ROUTES', source: 'Google traffic-aware driving estimate', checkedAt: checkedAtIso } },
    };
  }
  const reason: NotEvidencedReason =
    road.outcome === 'DESTINATION_NEEDS_CONFIRMATION' || road.outcome === 'DESTINATION_NEEDS_SELECTION' || road.outcome === 'DESTINATION_NEEDS_CLARIFICATION'
      ? 'ARRIVAL_DESTINATION_UNCONFIRMED'
      : 'ARRIVAL_ROUTE_UNAVAILABLE';
  const detail = reason === 'ARRIVAL_DESTINATION_UNCONFIRMED'
    ? 'Your destination needs confirming before the journey from the arrival airport can be calculated.'
    : "We couldn't get a reliable driving route from the arrival airport to that destination.";
  return { road, leg: { status: 'NOT_EVIDENCED', reason, detail } };
}
