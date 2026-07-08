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
 * IMPORTANT — TravelUp deep-linking is currently OFF (supportsDeepLink:
 * false). A first attempt guessed a `/flights/search?origin=...` URL
 * shape; in production that landed users on a TravelUp error page and
 * lost their search. Guessing again would repeat that. Until TravelUp's
 * real deep-link schema is confirmed, every booking link intentionally
 * falls back to their real, working homepage — a generic link that
 * requires re-entering details beats a specific one that errors outright.
 * TravelUp's affiliate programme runs through Commission Junction
 * (https://signup.cj.com/member/signup/publisher/?cid=6248437) or their
 * own affiliate page (https://www.travelup.com/en-us/company/affiliate-
 * programme, locale prefix may need adjusting for a UK link) — sign up
 * there to get the real deep-link URL structure and tracking parameters,
 * add them below, then flip supportsDeepLink to true. See README
 * "Required before launch".
 */

export type BookingProviderId = 'travelup' | 'skyscanner';

export interface BookingProvider {
  id: BookingProviderId;
  /** Shown in "Partner link, opens <name> in a new tab" captions. */
  name: string;
  /** Base URL every outbound link starts from — must be a real, working page. */
  baseUrl: string;
  /**
   * Whether baseUrl is confirmed to accept origin/destination/cabinClass
   * query params for a route-specific deep link. False means every link
   * goes to baseUrl as-is (plus affiliateParams) — safe, but not
   * route-specific. Only flip once the provider's real schema is verified.
   */
  supportsDeepLink: boolean;
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
    // Real, working page. Do not change this to a guessed subpath — see
    // file header for what happened last time.
    baseUrl: 'https://www.travelup.com/',
    supportsDeepLink: false,
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
    // Skyscanner's real (historical) deep-link shape was path-based
    // (/transport/flights/{from}/{to}/), not query-based — if this is ever
    // re-enabled, getRouteBookingUrl's query-param approach won't fit it
    // as-is; build its URL the way lib/partners.ts used to (see git history).
    supportsDeepLink: false,
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
 * — used on route guide pages. Only appends origin/destination/cabinClass
 * when the provider's supportsDeepLink is true and its schema is
 * confirmed; otherwise returns its plain baseUrl (see file header for why).
 */
export function getRouteBookingUrl(airport: Airport, destination: Destination, cabin?: DealCabin): string {
  const provider = getPrimaryBookingProvider();
  if (!provider.supportsDeepLink) {
    return appendParams(provider.baseUrl, provider.affiliateParams);
  }
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
