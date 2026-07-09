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
 * primary provider, tracked via their real Commission Junction (CJ) link:
 *
 *   https://www.kqzyfj.com/click-101818709-15363607
 *
 * CJ tracking-link structure — extracted from that real link, nothing
 * guessed — is `click-{PID}-{AID}` on a CJ redirect domain:
 *   - Redirect domain: kqzyfj.com (one of CJ's standard redirect domains)
 *   - PID (JetStash's CJ publisher ID): 101818709
 *   - AID (TravelUp's CJ advertiser ID): 15363607
 * A bare click-PID-AID link redirects to whatever default destination
 * TravelUp configured for it on their end (their homepage/search entry
 * point) — that's the safe fallback every booking link uses today, and
 * it's a genuinely tracked, commission-earning click, unlike the old bare
 * https://www.travelup.com/ fallback it replaces. Two optional query
 * params layer on top of that same link, always via appendParams() below,
 * never hand-typed at a call site:
 *   - `sid` — CJ's SubID field, free text JetStash controls, for our own
 *     click attribution (which route/page/cabin drove the click). Doesn't
 *     change what the user sees on TravelUp's side.
 *   - `url` — CJ's deep-link override: redirects to a *specific* TravelUp
 *     page instead of their configured default. Only ever set from
 *     VERIFIED_DEEP_LINKS below, and only once a provider's
 *     supportsDeepLink is true — see that constant's comment for why it's
 *     empty today.
 *
 * Every "Check live price[s]" / booking CTA in the app reads its outbound
 * URL from this file — nothing else should construct a provider URL by
 * hand.
 *
 * To re-enable Skyscanner once approved: flip its `enabled` to `true`, add
 * its real tracking link, and point PRIMARY_PROVIDER_ID at it. To add a
 * new provider: add an entry to BOOKING_PROVIDERS with the same shape.
 * Nothing else in the app needs to change either way.
 */

export type BookingProviderId = 'travelup' | 'skyscanner';

export interface BookingProvider {
  id: BookingProviderId;
  /** Shown in "Partner link, opens <name> in a new tab" captions. */
  name: string;
  /** The real tracking link every outbound URL is built from (a CJ click-PID-AID link for TravelUp). Never a guessed subpath. */
  baseUrl: string;
  /**
   * Whether VERIFIED_DEEP_LINKS is trusted to override baseUrl's default
   * destination for a given route, via CJ's `url=` param. False means
   * every link resolves to baseUrl's own configured default landing —
   * still real, still tracked, just not destination-specific. Only flip
   * once at least one VERIFIED_DEEP_LINKS entry has been confirmed by
   * manually visiting the real page.
   */
  supportsDeepLink: boolean;
  /** Static tracking query parameters appended to every outbound link, in addition to the dynamic per-click sid. Empty if the link needs none beyond its own PID/AID. */
  affiliateParams: Record<string, string>;
  /** Whether baseUrl is a real, commission-earning tracking link (true) or an untracked plain URL (false) — read this, not affiliateParams, to check "is this provider actually earning money". */
  hasTracking: boolean;
  enabled: boolean;
  /** rel attribute for the outbound <a> — matches Google's guidance for paid/affiliate links. */
  rel: string;
}

export const BOOKING_PROVIDERS: Record<BookingProviderId, BookingProvider> = {
  travelup: {
    id: 'travelup',
    name: 'TravelUp',
    // Real CJ tracking link — PID 101818709, AID 15363607, on kqzyfj.com.
    // See file header. Do not replace with a guessed travelup.com subpath.
    baseUrl: 'https://www.kqzyfj.com/click-101818709-15363607',
    supportsDeepLink: false,
    affiliateParams: {},
    hasTracking: true,
    enabled: true,
    rel: 'nofollow sponsored noopener noreferrer',
  },
  skyscanner: {
    id: 'skyscanner',
    name: 'Skyscanner',
    baseUrl: 'https://www.skyscanner.net/transport/flights',
    supportsDeepLink: false,
    affiliateParams: {},
    hasTracking: false,
    // Declined JetStash's affiliate application while pre-launch (see
    // README). Do not flip this to true without fresh approval.
    enabled: false,
    rel: 'nofollow sponsored noopener noreferrer',
  },
};

/** The one line to change to swap the primary booking provider site-wide. */
export const PRIMARY_PROVIDER_ID: BookingProviderId = 'travelup';

/**
 * Manually verified TravelUp destination URLs, keyed by destination slug —
 * the ONLY source getRouteBookingUrl will ever deep-link to via CJ's
 * `url=` override. Empty until someone actually visits travelup.com,
 * performs a real search or opens a real destination page, and confirms
 * the exact URL works — never add an entry from a guessed pattern (a
 * guessed `/flights/search?origin=...` shape broke in production the one
 * time that was tried; see git history). Populating this is independent
 * of supportsDeepLink staying off: even with entries here, nothing
 * changes until the provider's supportsDeepLink flag is also flipped to
 * true.
 */
const VERIFIED_DEEP_LINKS: Partial<Record<string, string>> = {
  // 'lahore': 'https://www.travelup.com/en-gb/flight-offers/lahore-lhe',
};

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
 * Builds a stable, readable CJ SubID from route/page context — JetStash's
 * own click attribution (which page/route/cabin drove this click), never
 * read by or sent to the destination page itself.
 */
function buildSid(parts: (string | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p))
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Outbound booking URL for a specific departure airport → destination pair
 * — used on route guide pages. Deep-links only to a VERIFIED_DEEP_LINKS
 * entry when the provider's supportsDeepLink is true; otherwise (today,
 * always) resolves to the tracked homepage/search fallback, tagged with a
 * sid identifying this route (and cabin, when known) for analytics.
 */
export function getRouteBookingUrl(airport: Airport, destination: Destination, cabin?: DealCabin): string {
  const provider = getPrimaryBookingProvider();
  const sid = buildSid(['route', airport.slug, destination.slug, cabin]);
  const params: Record<string, string> = { ...provider.affiliateParams, sid };
  const verifiedUrl = provider.supportsDeepLink ? VERIFIED_DEEP_LINKS[destination.slug] : undefined;
  if (verifiedUrl) params.url = verifiedUrl;
  return appendParams(provider.baseUrl, params);
}

/** Outbound booking URL for a Deal — resolves its airport/destination and defers to getRouteBookingUrl. */
export function getDealBookingUrl(deal: Pick<Deal, 'fromAirportSlug' | 'toDestinationSlug' | 'cabin'>): string {
  const airport = getAirportBySlug(deal.fromAirportSlug);
  const destination = getDestinationBySlug(deal.toDestinationSlug);
  if (!airport || !destination) {
    return getGeneralBookingUrl(buildSid(['deal', deal.fromAirportSlug, deal.toDestinationSlug, deal.cabin]));
  }
  return getRouteBookingUrl(airport, destination, deal.cabin);
}

/**
 * Generic outbound booking link with no specific route — used by
 * NoFareFallback. Pass whatever page-identifying text is available
 * (e.g. the city/section label already shown to the visitor); it's
 * slugified into the sid automatically.
 */
export function getGeneralBookingUrl(context = 'general'): string {
  const provider = getPrimaryBookingProvider();
  const sid = buildSid(['fallback', context]);
  return appendParams(provider.baseUrl, { ...provider.affiliateParams, sid });
}
