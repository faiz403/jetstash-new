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
}

/**
 * CONFIRMED: safe to issue a deadline pass/fail verdict.
 * NEEDS_CONFIRMATION: Google resolved a specific named venue/POI (a
 * hotel, wedding hall, mosque, hospital...) plausibly and unambiguously,
 * but the primary-place guard doesn't apply to venues the way it does to
 * localities — a human must explicitly confirm it's the right place
 * before any route or deadline verdict is produced.
 * NEEDS_CLARIFICATION: Google resolved *something*, but not confidently
 * enough to trust for a single-point road journey (a partial match, an
 * overly broad place type such as a whole country/province, more than
 * one plausible candidate, or a locality-style result whose primary
 * identity doesn't survive resolution).
 * UNRESOLVED: Google could not geocode the destination at all.
 */
export type DestinationConfidence = 'CONFIRMED' | 'NEEDS_CONFIRMATION' | 'NEEDS_CLARIFICATION' | 'UNRESOLVED';

/** Why a destination didn't reach CONFIRMED — lets the UI explain the specific problem rather than a single generic message. */
export type DestinationClarificationReason =
  | 'MULTIPLE_CANDIDATES'
  | 'PARTIAL_MATCH'
  | 'TOO_BROAD_TYPE'
  | 'NO_LOCATION_TYPE'
  | 'PRIMARY_PLACE_MISMATCH'
  | 'WRONG_COUNTRY'
  | 'GEOCODE_FAILED';

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
