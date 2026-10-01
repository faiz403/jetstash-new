/**
 * Canonical full-journey data model (F1):
 *
 *   start -> departure airport -> flight -> arrival airport -> final destination
 *
 * A journey is a chain of legs, each with its own evidence. The solver
 * (solver.ts) sees only resolved legs, so the arithmetic is pure and
 * testable; providers (providers.ts) produce the legs, and the orchestrator
 * (plan.ts) meters every Google call. V1 scope, by founder decision:
 * UK departure airports only, manually entered flight times only, arrival
 * airports subject to the existing capability gate.
 */

import type { RoadOutcome, RoadPickupMode } from '../arrive-by-shared/road-types';

/** What backs a number. Nothing is ever presented without one of these. */
export type EvidenceKind =
  /** Typed by the traveller (flight times, buffers). */
  | 'ENTERED'
  /** A live Google Routes / Geocoding estimate, with the time it was checked. */
  | 'GOOGLE_ROUTES'
  /** A stated default the traveller can change. Never a fact. */
  | 'ASSUMPTION';

export interface LegEvidence {
  kind: EvidenceKind;
  /** Short human source label shown next to the leg. */
  source: string;
  /** ISO instant the volatile input was checked. Absent for entered values. */
  checkedAt?: string;
}

export type LegKind = 'ORIGIN_ACCESS' | 'DEPARTURE_BUFFER' | 'FLIGHT' | 'ARRIVAL_EXIT' | 'PICKUP_WAIT' | 'ONWARD' | 'DESTINATION_READINESS';

export interface TimelineLeg {
  kind: LegKind;
  label: string;
  startIso: string;
  endIso: string;
  minutes: number;
  /** IANA zone the leg's start/end should be displayed in. */
  startZone: string;
  endZone: string;
  evidence: LegEvidence;
}

/** A manually entered flight. Times are LOCAL at each airport; the solver reads them in the airports' own zones. */
export interface FlightInput {
  /** Local wall clock at the departure airport, "YYYY-MM-DDTHH:MM". */
  departsLocal: string;
  /** Local wall clock at the arrival airport, "YYYY-MM-DDTHH:MM". */
  arrivesLocal: string;
  /** Optional label the traveller gave it ("PK 786"). Display only, never looked up. */
  label?: string;
  /** Number of stops/connections inside this entry. Anything above 0 cannot be evidenced in V1 and fails closed. */
  declaredConnections?: number;
}

export interface JourneyPreferences {
  /** Minutes the traveller wants to be at the departure airport before the flight departs. Required: never assumed silently. */
  departureAirportBufferMinutes: number;
  /** Minutes after landing before they are outside the arrival airport (their own estimate). */
  arrivalExitMinutes: number;
  /** Minutes from leaving the terminal until the pickup/car is moving (their own estimate). 0 when blank. */
  pickupWaitMinutes?: number;
  pickupMode?: RoadPickupMode;
  /** Optional deadline at the FINAL destination, local wall clock in the arrival airport's zone. */
  finalDeadlineLocal?: string;
  /** Minutes needed at the destination before the deadline (readiness). 0 when blank. */
  destinationReadinessMinutes?: number;
}

export interface JourneyInput {
  /** Free text: town, postcode, place. UK only in V1. Resolved server-side; never stored, never in analytics. */
  start: string;
  /** IATA code of a UK departure airport. */
  departureAirport: string;
  flight: FlightInput;
  /** IATA code of the arrival airport. */
  arrivalAirport: string;
  /** Free text final destination. */
  destination: string;
  preferences: JourneyPreferences;
  /**
   * F1 only: the traveller's own estimate of the journey from the start to the departure airport, in minutes.
   * F2 replaces this with a live Google leg; until then it is the only origin-side source, and it is labelled
   * as entered wherever it appears.
   */
  originLegMinutes?: number;
  /** Set only on a second request, exactly as for the destination: the START location's confirm / select choice, re-verified server-side, never trusted. */
  startConfirmedPlaceId?: string;
  startSelectedPlaceId?: string;
  /** Set only on a second request, exactly as in the arrival-only product; re-verified server-side, never trusted. */
  confirmedPlaceId?: string;
  selectedPlaceId?: string;
}

/** A leg whose duration a provider resolved (or could not). */
export type ResolvedLeg =
  | {
      status: 'OK';
      expectedSeconds: number;
      staticSeconds?: number;
      /**
       * Set by the live origin search: the latest departure instant (epoch ms) that was VERIFIED, by a real traffic-aware
       * query at that time, to reach the airport by its deadline. When present the solver uses it directly (rounded down)
       * instead of subtracting an average duration from the deadline.
       */
      latestFeasibleDepartureMs?: number;
      evidence: LegEvidence;
    }
  | { status: 'NOT_EVIDENCED'; reason: NotEvidencedReason; detail?: string };

export type NotEvidencedReason =
  | 'ORIGIN_LEG_MISSING'
  | 'START_LOCATION_UNCONFIRMED'
  | 'START_LOCATION_UNSUITABLE'
  | 'ORIGIN_ROUTE_UNAVAILABLE'
  | 'ORIGIN_SEARCH_NO_FEASIBLE'
  | 'DEPARTURE_AIRPORT_NOT_EVIDENCED'
  | 'ARRIVAL_DESTINATION_UNCONFIRMED'
  | 'ARRIVAL_ROUTE_UNAVAILABLE'
  | 'CALL_CEILING_REACHED'
  | 'MONTHLY_BUDGET_UNAVAILABLE'
  | 'CONNECTION_NOT_MODELLED'
  | 'AIRPORT_NOT_SUPPORTED'
  | 'INVALID_INPUT';

/**
 * The spec's four result states plus two honest extras:
 * ESTIMATE_ONLY when there is no deadline to judge against.
 */
export type JourneyState =
  | 'POSSIBLE_WITH_MARGIN'
  | 'POSSIBLE_BUT_TIGHT'
  | 'NOT_FEASIBLE'
  | 'CANNOT_CONFIRM'
  | 'ESTIMATE_ONLY';

export const STATE_LABEL: Record<JourneyState, string> = {
  POSSIBLE_WITH_MARGIN: 'POSSIBLE WITH MARGIN',
  POSSIBLE_BUT_TIGHT: 'POSSIBLE BUT TIGHT',
  NOT_FEASIBLE: 'NOT FEASIBLE FROM THE CHECKED OPTIONS',
  CANNOT_CONFIRM: 'CANNOT CONFIRM',
  ESTIMATE_ONLY: 'ESTIMATE ONLY',
};

export interface JourneyPlan {
  state: JourneyState;
  stateLabel: string;
  /** Plain reasons the state is what it is (always at least one for non-estimate states). */
  reasons: string[];
  notEvidenced?: { reason: NotEvidencedReason; detail?: string };
  /** The headline answer: when to leave the start location. */
  leaveBy?: { iso: string; zone: string; clock: string; dateLabel: string; roundedDownToFive: true };
  /** The traveller's chosen buffer, echoed so the copy can state it. */
  airportArriveBy?: { iso: string; zone: string; clock: string; dateLabel: string; dayOffset: number; bufferMinutes: number };
  flight?: { departsIso: string; arrivesIso: string; elapsedMinutes: number; departZone: string; arriveZone: string };
  finalArrival?: { iso: string; zone: string; clock: string; dateLabel: string; dayOffset: number };
  deadline?: { iso: string; latestAcceptableIso: string; marginMinutes: number };
  timeline: TimelineLeg[];
  /** Copy the founder specified: leave-by first, then the buffer, then the expected final arrival. */
  headline?: { leave: string; airport: string; arrival: string };
  /** Present when the START location needs confirming / choosing / clarifying, exactly as arrivalDetail is for the destination. */
  startDetail?: { confidence: string; pendingConfirmation?: { placeId: string; formattedAddress: string; display?: string; unnamed?: boolean; name?: string }; pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string; display?: string; unnamed?: boolean; name?: string }> }; clarificationReason?: string; resolvedAddress?: string; display?: string };
  /** How the live origin leg was found: the measurable cost and convergence of the backward search. */
  originSearch?: { queries: number; converged: boolean; slackMinutes: number; departureAirport: string };
  arrivalDetail?: {
    outcome: RoadOutcome;
    pendingConfirmation?: { placeId: string; formattedAddress: string; display?: string; unnamed?: boolean; name?: string };
    pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string; display?: string; unnamed?: boolean; name?: string }> };
    clarificationReason?: string;
    /** Present only for an airport with a separately validated transit-first capability. */
    transit?: {
      firstService: string;
      expectedArrivalIso: string;
      missedServiceArrivalIso?: string;
      missedServiceMeetsReadyBy?: boolean;
      rescue?: { attempted: boolean; available: boolean; arrivalIso?: string; meetsReadyBy?: boolean };
    };
  };
  /** Google's resolved places, for the traveller to check. Never sent to analytics or logs. */
  places?: { start?: { typed: string; display?: string; address?: string }; destination?: { typed: string; display?: string; address?: string } };
  calls?: { used: number; ceiling: number; breakdown: Record<string, number> };
}
