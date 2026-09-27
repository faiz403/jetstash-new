/**
 * Type vocabulary for Arrive By Pakistan — deliberately separate from
 * lib/arrive-by (Manchester's validated Google-powered engine), which
 * lives only on its own still-unmerged branch and is never imported here.
 * Pakistan's road-first model is a different shape entirely: one drive
 * estimate instead of a transit/car branch, and no missed-service concept.
 */

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
}

/**
 * CONFIRMED: safe to issue a deadline pass/fail verdict.
 * NEEDS_CLARIFICATION: Google resolved *something*, but not confidently
 * enough to trust for a single-point road journey (a partial match, an
 * overly broad place type such as a whole country/province, or more than
 * one plausible candidate).
 * UNRESOLVED: Google could not geocode the destination at all.
 */
export type DestinationConfidence = 'CONFIRMED' | 'NEEDS_CLARIFICATION' | 'UNRESOLVED';

/** Why a destination didn't reach CONFIRMED — lets the UI explain the specific problem rather than a single generic message. */
export type DestinationClarificationReason =
  | 'MULTIPLE_CANDIDATES'
  | 'PARTIAL_MATCH'
  | 'TOO_BROAD_TYPE'
  | 'NO_LOCATION_TYPE'
  | 'PRIMARY_PLACE_MISMATCH'
  | 'GEOCODE_FAILED';

export type PakistanOutcome =
  | 'ETA_ONLY'
  | 'BEFORE_DEADLINE'
  | 'TIGHT_MARGIN'
  | 'AFTER_DEADLINE'
  | 'DESTINATION_NEEDS_CLARIFICATION'
  | 'ROUTE_UNAVAILABLE'
  | 'GOOGLE_UNAVAILABLE';

export interface PakistanJourneyResult {
  outcome: PakistanOutcome;
  airport: { code: PakistanAirportCode; displayName: string; timeZone: string };
  destination: string;
  destinationConfidence: DestinationConfidence;
  /** Google's own resolved place name for the destination, shown so a traveller/founder can spot a wrong-place match themselves — never stored, never analytics-tracked. */
  resolvedDestination?: string;
  /** Present only when destinationConfidence isn't CONFIRMED, so the UI can explain the specific reason rather than one generic message. */
  clarificationReason?: DestinationClarificationReason;
  /** Echoed back verbatim from the input for display only — never stored, never analytics-tracked. */
  deadlineReason?: string;
  /** ISO instants — all internally consistent in the airport's own timeZone regardless of the visitor's own browser zone. */
  readyOutsideAirport: string;
  roadDeparture: string;
  expectedArrival?: string;
  driveDurationSeconds?: number;
  distanceMeters?: number;
  deadline?: string;
  latestAcceptableArrival?: string;
  /** Positive = spare minutes, negative = minutes late. Only present when a deadline was supplied. */
  marginMinutes?: number;
}
