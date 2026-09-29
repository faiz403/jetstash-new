/**
 * Type vocabulary for the profile-driven road-first (ROAD_PICKUP_FIRST)
 * journey. Originally Pakistan's; generalised so one engine serves any
 * airport whose profile says ROAD_PICKUP_FIRST. lib/arrive-by-pakistan/types.ts
 * narrows these to its three airport codes and re-exports them unchanged.
 */

import type { DestinationConfidence, DestinationClarificationReason } from './destination-resolution';
export type { DestinationConfidence, DestinationClarificationReason };

export type RoadPickupMode = 'family' | 'pre-booked' | 'arrange-after-landing' | 'other';

export interface RoadJourneyInput {
  /** IATA code. The server resolves everything else about the airport from it -- coordinates, timezone and country policy are never accepted from the client. */
  airportCode: string;
  /** Local datetime-local string (no timezone suffix), interpreted in the airport's own timeZone. */
  landingAt: string;
  airportExitBufferMinutes: number;
  destination: string;
  pickupMode: RoadPickupMode;
  /** Minutes; undefined/blank means 0 — never invented. */
  pickupWaitMinutes?: number;
  /** Optional. Local datetime-local string, same airport timeZone. Absent means ETA-only. */
  deadline?: string;
  deadlineReason?: string;
  /** Minutes; undefined/blank means 0 — never invented. */
  destinationReadinessBufferMinutes?: number;
  /**
   * Set only on a second request, after the user explicitly confirmed a
   * NEEDS_CONFIRMATION place. Never trusted blindly: the engine re-geocodes
   * and only proceeds if Google, right now, still resolves to this exact
   * placeId as a single, non-ambiguous, non-partial match.
   */
  confirmedPlaceId?: string;
  /**
   * Set only on a second request, after the user picked one of several
   * named-venue candidates. Never trusted blindly: it must still be one of
   * the candidates Google independently returns right now.
   */
  selectedPlaceId?: string;
}

/**
 * Every outcome the engine can actually produce. GOOGLE_UNAVAILABLE does
 * not exist: every Google failure path resolves to ROUTE_UNAVAILABLE.
 */
export type RoadOutcome =
  | 'ETA_ONLY'
  | 'BEFORE_DEADLINE'
  | 'TIGHT_MARGIN'
  | 'AFTER_DEADLINE'
  | 'DESTINATION_NEEDS_CONFIRMATION'
  | 'DESTINATION_NEEDS_SELECTION'
  | 'DESTINATION_NEEDS_CLARIFICATION'
  | 'ROUTE_UNAVAILABLE';

export interface RoadJourneyResult {
  outcome: RoadOutcome;
  airport: { code: string; displayName: string; timeZone: string };
  destination: string;
  destinationConfidence: DestinationConfidence;
  /** Google's own resolved place name, shown so a traveller can spot a wrong-place match themselves — never stored, never analytics-tracked. */
  resolvedDestination?: string;
  /** Present only when destinationConfidence isn't CONFIRMED. */
  clarificationReason?: DestinationClarificationReason;
  /** Present only when destinationConfidence is NEEDS_CONFIRMATION. */
  pendingConfirmation?: { placeId: string; formattedAddress: string };
  /** Present only when destinationConfidence is NEEDS_SELECTION. Only safe display fields, never a raw Google payload. */
  pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string }> };
  /** Echoed back verbatim from the input for display only — never stored, never analytics-tracked. */
  deadlineReason?: string;
  /** ISO instants — all internally consistent in the airport's own timeZone regardless of the visitor's browser zone. */
  readyOutsideAirport: string;
  roadDeparture: string;
  expectedArrival?: string;
  driveDurationSeconds?: number;
  /** Traffic-free duration for the same route — used only for a factual traffic-impact sentence, never to change the calculation. */
  staticDurationSeconds?: number;
  distanceMeters?: number;
  deadline?: string;
  latestAcceptableArrival?: string;
  /** Positive = spare minutes, negative = minutes late. Only present when a deadline was supplied. */
  marginMinutes?: number;
}
