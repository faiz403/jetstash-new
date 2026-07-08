import type { Airport } from '@/data/airports';
import { getAirportBySlug } from '@/data/airports';
import type { Destination } from '@/data/destinations';
import { getDestinationBySlug } from '@/data/destinations';
import type { Deal, DealCabin } from '@/data/deals';

/**
 * Central outbound booking-provider configuration.
 *
 * Skyscanner declined JetStash's affiliate application while the site is
 * pre-launch, so it stays disabled below. TravelUp (approved) is the
 * primary provider. Every "Check live price[s]" / booking CTA in the app
 * reads its outbound URL from this file — nothing else should construct a
 * provider URL by hand.
 *
 * To re-enable Skyscanner once approved: flip its `enabled` to `true`, add
 * its real affiliateParams, and point PRIMARY_PROVIDER_ID at it. To add a
 * new provider: add an entry to BOOKING_PROVIDERS with the same shape.
 * Nothing else in the app needs to change either way.
 *
 * affiliateParams below are still empty placeholders — see README
 * "Required before launch" for the real TravelUp tracking parameters once
 * issued, and verify the deep-link query names (origin/destination/
 * cabinClass) against TravelUp's actual integration docs before go-live.
 */

export type BookingProviderId = 'travelup' | 'skyscanner';

export interface BookingProvider {
  id: BookingProviderId;
  /** Shown in "Partner link, opens <name> in a new tab" captions. */
  name: string;
  /** Flight-search base URL that route/deal params are appended to. */
  baseUrl: string;
  /** Affiliate/tracking query parameters appended to every outbound link. Empty until issued. */
  affiliateParams: Record<string, string>;
  enabled: boolean;
  /** rel attribute for the outbound <a> — matches Google's guidance for paid/affiliate links. */
  rel: string;
}

export const BOOKING_PROVIDERS: Record<BookingProviderId, BookingProvider> = {
  travelup: {
    id: 'travelup',
    name: 'TravelUp',
    baseUrl: 'https://www.travelup.com/flights/search',
    affiliateParams: {
      // TODO: add TravelUp's real affiliate/tracking parameters once issued.
    },
    enabled: true,
    rel: 'nofollow sponsored noopener noreferrer',
  },
  skyscanner: {
    id: 'skyscanner',
    name: 'Skyscanner',
    baseUrl: 'https://www.skyscanner.net/transport/flights',
    affiliateParams: {},
    // Declined JetStash's affiliate application while pre-launch (see
    // README). Do not flip this to true without fresh approval.
    enabled: false,
    rel: 'nofollow sponsored noopener noreferrer',
  },
};

/** The one line to change to swap the primary booking provider site-wide. */
export const PRIMARY_PROVIDER_ID: BookingProviderId = 'travelup';

export function getPrimaryBookingProvider(): BookingProvider {
  const provider = BOOKING_PROVIDERS[PRIMARY_PROVIDER_ID];
  if (!provider.enabled) {
    throw new Error(
      `PRIMARY_PROVIDER_ID ("${PRIMARY_PROVIDER_ID}") points at a disabled provider in lib/booking-providers.ts.`
    );
  }
  return provider;
}

function appendParams(url: string, params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, value]) => value);
  if (entries.length === 0) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(entries).toString()}`;
}

/**
 * Outbound booking URL for a specific departure airport → destination pair
 * — used on route guide pages. The origin/destination/cabinClass query
 * names are a best-effort convention, not a confirmed TravelUp deep-link
 * schema; verify before launch (see file header).
 */
export function getRouteBookingUrl(airport: Airport, destination: Destination, cabin?: DealCabin): string {
  const provider = getPrimaryBookingProvider();
  const params: Record<string, string> = {
    origin: airport.code,
    destination: destination.iataCode,
    ...provider.affiliateParams,
  };
  if (cabin === 'Business' || cabin === 'Premium Economy') {
    params.cabinClass = cabin === 'Business' ? 'business' : 'premiumeconomy';
  }
  return appendParams(provider.baseUrl, params);
}

/** Outbound booking URL for a Deal — resolves its airport/destination and defers to getRouteBookingUrl. */
export function getDealBookingUrl(deal: Pick<Deal, 'fromAirportSlug' | 'toDestinationSlug' | 'cabin'>): string {
  const airport = getAirportBySlug(deal.fromAirportSlug);
  const destination = getDestinationBySlug(deal.toDestinationSlug);
  if (!airport || !destination) return getGeneralBookingUrl();
  return getRouteBookingUrl(airport, destination, deal.cabin);
}

/** Generic outbound booking link with no specific route — used by NoFareFallback. */
export function getGeneralBookingUrl(): string {
  const provider = getPrimaryBookingProvider();
  return appendParams(provider.baseUrl, provider.affiliateParams);
}
