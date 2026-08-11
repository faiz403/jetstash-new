import type { FareObservation } from '@/data/fare-observations';

/** A controlled search profile passed to a permitted future provider/feed. */
export interface FareSourceSearchProfile {
  routeSlug: string;
  departureDate: string;
  returnDate: string;
  cabin: FareObservation['cabin'];
  currency: 'GBP';
  passengers: { adults: number; children: number };
  baggageAssumption: 'one-checked-bag' | 'not-stated';
  profileId: string;
}

/** Provider output is deliberately opaque until normalised by an adapter. */
export interface FareSourceOffer {
  readonly raw: unknown;
}

export interface FareSourceMetadata {
  sourceId: string;
  providerName: string;
  termsUrl: string;
  usagePermitsMonitoring: boolean;
  checkedAt: string;
}

/**
 * Future boundary for a legitimate API/partner feed. No implementation is
 * provided here: consumer-page scraping and guessed endpoints are prohibited.
 */
export interface FareSourceAdapter {
  readonly metadata: FareSourceMetadata;
  searchRoute(profile: FareSourceSearchProfile): Promise<readonly FareSourceOffer[]>;
  normaliseOffer(offer: FareSourceOffer, profile: FareSourceSearchProfile): FareObservation | null;
  recheckOffer(offer: FareSourceOffer, profile: FareSourceSearchProfile): Promise<FareSourceOffer | null>;
}
