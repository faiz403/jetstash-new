import type { FlightInput, JourneyPlan } from './types';

export type FlightConnectionPolicy = 'FINAL_ARRIVAL_ANCHOR';

/** Explicit public policy: calculate the ground legs around entered schedule anchors, not the connection. */
export function scheduledFlightForSolver(flight: FlightInput, policy?: FlightConnectionPolicy): FlightInput {
  return policy === 'FINAL_ARRIVAL_ANCHOR' && (flight.declaredConnections ?? 0) > 0
    ? { ...flight, declaredConnections: 0 }
    : flight;
}

/** Keep the unverified connection conspicuous; never describe the opaque itinerary as a checked direct flight. */
export function withScheduledFlightAssumption(plan: JourneyPlan, flight: FlightInput, airportName: string, policy?: FlightConnectionPolicy): JourneyPlan {
  if (policy !== 'FINAL_ARRIVAL_ANCHOR' || (flight.declaredConnections ?? 0) === 0 || !plan.flight) return plan;
  return {
    ...plan,
    scheduledFlightAssumption: { arrivalAirportName: airportName, arrivesIso: plan.flight.arrivesIso, timeZone: plan.flight.arriveZone },
    timeline: plan.timeline.map((leg) => leg.kind === 'FLIGHT'
      ? { ...leg, label: 'Scheduled flight itinerary (connection not checked)', evidence: { ...leg.evidence, source: 'Itinerary times entered by you; flight connection not checked' } }
      : leg),
  };
}
