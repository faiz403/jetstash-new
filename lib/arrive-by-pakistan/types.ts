/**
 * Type vocabulary for Arrive By Pakistan — deliberately separate from
 * lib/arrive-by (Manchester's transit-first engine). Pakistan's road-first
 * model is a different shape entirely: one drive estimate instead of a
 * transit/car branch, and no missed-service concept. DestinationConfidence
 * and DestinationClarificationReason are the one part of this vocabulary
 * that isn't Pakistan-specific — they're re-exported from the shared
 * lib/arrive-by-shared/destination-resolution.ts module rather than defined
 * here, since Manchester now uses the same destination-safety states.
 */

import type { DestinationConfidence, DestinationClarificationReason } from '@/lib/arrive-by-shared/destination-resolution';
export type { DestinationConfidence, DestinationClarificationReason };

export type PakistanAirportCode = 'ISB' | 'LHE' | 'KHI';

export interface PakistanAirport {
  code: PakistanAirportCode;
  displayName: string;
  timeZone: string;
  /**
   * Free-text address handed to Google as the DRIVE request's origin so
   * Google resolves the airport itself — never a manually-typed
   * coordinate. See lib/arrive-by-pakistan/airports.ts's own comment for
   * why this is the safer choice for a country not previously modelled.
   */
  routingAddress: string;
}

export type PakistanPickupMode = 'family' | 'pre-booked' | 'arrange-after-landing' | 'other';

export interface PakistanJourneyInput {
  airportCode: PakistanAirportCode;
  /** Local datetime-local string (no timezone suffix), interpreted in the airport's own timeZone. */
  landingAt: string;
  airportExitBufferMinutes: number;
  destination: string;
  pickupMode: PakistanPickupMode;
  /** Minutes; undefined/blank means 0 — never invented. */
  pickupWaitMinutes?: number;
  /** Optional. Local datetime-local string, same airport timeZone. Absent means ETA-only. */
  deadline?: string;
  deadlineReason?: string;
  /** Minutes; undefined/blank means 0 — never invented. */
  destinationReadinessBufferMinutes?: number;
  /**
   * Set only on a second request, after the founder/user was shown a
   * NEEDS_CONFIRMATION result and explicitly said "yes, that's the place".
   * Never trusted blindly — journey.ts re-geocodes the same destination
   * text and only proceeds if Google, right now, still independently
   * resolves to this exact placeId as a single, non-ambiguous, non-partial
   * match. This can never make an unresolved, wrong-country, or genuinely
   * ambiguous result routable.
   */
  confirmedPlaceId?: string;
  /**
   * Set only on a second request, after the founder/user was shown several
   * genuinely different named-venue candidates and picked one. Never
   * trusted blindly — journey.ts re-geocodes the same destination text and
   * only proceeds if this placeId is still one of the candidates Google
   * independently returns right now.
   */
  selectedPlaceId?: string;
}

/**
 * Every outcome the current implementation can actually produce.
 * GOOGLE_UNAVAILABLE was removed: every Google failure path (geocoding
 * request failure, routes request failure, no usable route) already
 * resolves to ROUTE_UNAVAILABLE — a second, unreachable "service down"
 * state added nothing but a state that could never fire.
 */
export type PakistanOutcome =
  | 'ETA_ONLY'
  | 'BEFORE_DEADLINE'
  | 'TIGHT_MARGIN'
  | 'AFTER_DEADLINE'
  | 'DESTINATION_NEEDS_CONFIRMATION'
  | 'DESTINATION_NEEDS_SELECTION'
  | 'DESTINATION_NEEDS_CLARIFICATION'
  | 'ROUTE_UNAVAILABLE';

export interface PakistanJourneyResult {
  outcome: PakistanOutcome;
  airport: { code: PakistanAirportCode; displayName: string; timeZone: string };
  destination: string;
  destinationConfidence: DestinationConfidence;
  /** Google's own resolved place name for the destination, shown so a traveller/founder can spot a wrong-place match themselves — never stored, never analytics-tracked. */
  resolvedDestination?: string;
  /** Present only when destinationConfidence isn't CONFIRMED, so the UI can explain the specific reason rather than one generic message. */
  clarificationReason?: DestinationClarificationReason;
  /** Present only when destinationConfidence is NEEDS_CONFIRMATION — what the founder/user must explicitly say "yes" to before any route or deadline verdict is produced. */
  pendingConfirmation?: { placeId: string; formattedAddress: string };
  /** Present only when destinationConfidence is NEEDS_SELECTION — multiple genuinely different named venues, not a duplicate representation of the same place. Only safe display fields, never a raw Google payload. */
  pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string }> };
  /** Echoed back verbatim from the input for display only — never stored, never analytics-tracked. */
  deadlineReason?: string;
  /** ISO instants — all internally consistent in the airport's own timeZone regardless of the visitor's own browser zone. */
  readyOutsideAirport: string;
  roadDeparture: string;
  expectedArrival?: string;
  driveDurationSeconds?: number;
  /** Traffic-free duration for the same route — present only when Google itself returned it. Used only to build a factual traffic-impact sentence, never to change the calculation. */
  staticDurationSeconds?: number;
  distanceMeters?: number;
  deadline?: string;
  latestAcceptableArrival?: string;
  /** Positive = spare minutes, negative = minutes late. Only present when a deadline was supplied. */
  marginMinutes?: number;
}
