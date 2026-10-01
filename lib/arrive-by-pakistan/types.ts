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

import type { DestinationConfidence, DestinationClarificationReason, RoadJourneyInput, RoadJourneyResult, RoadOutcome, RoadPickupMode } from '@/lib/arrive-by-shared/road-types';
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

export type PakistanPickupMode = RoadPickupMode;

/** The shared road-first journey input, narrowed to Pakistan's three airports. Field documentation lives on RoadJourneyInput. */
export type PakistanJourneyInput = Omit<RoadJourneyInput, 'airportCode'> & { airportCode: PakistanAirportCode };

/** Every outcome the engine can produce (no GOOGLE_UNAVAILABLE -- every Google failure resolves to ROUTE_UNAVAILABLE). */
export type PakistanOutcome = RoadOutcome;

/** The shared road-first journey result, narrowed to Pakistan's airport codes. Field documentation lives on RoadJourneyResult. */
export type PakistanJourneyResult = Omit<RoadJourneyResult, 'airport'> & {
  airport: { code: PakistanAirportCode; displayName: string; timeZone: string };
};
