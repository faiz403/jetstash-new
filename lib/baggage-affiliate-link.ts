/**
 * Central outbound baggage/luggage affiliate-link configuration — the CJ
 * (Commission Junction) equivalent of lib/hotel-booking-links.ts's Trip.com
 * hotel map, and deliberately separate from Travel Ready Check's own
 * evidence and logic. Travel Ready Check answers "can I actually travel on
 * these dates, with the documents I have?" from data/travel-ready-rules.ts
 * alone; this file only supplies where a "Shop luggage" click goes. Neither
 * file should ever import from the other for anything but the URL itself.
 *
 * The URL below is the exact, unedited output of CJ's own Links & Products
 * "Get Code" tool (My Advertisers → Travel Luggage & Cabin Bags (7218698)
 * → Get Code), generated against JetStash's registered CJ publisher
 * property ("JetStash website – 101818709") for the existing approved
 * "Shop for Suitcases at TLCB" text link (CJ link ID 17045640), whose
 * destination is the advertiser's suitcase collection page
 * (travelluggagecabinbags.com/collections/suitcases) — a category page,
 * not a single product. Nothing was typed, guessed, or hand-assembled:
 * the tracking domain (dpbolvw.net), publisher ID and link ID are exactly
 * as CJ generated them.
 *
 * Confirmed live on the account at generation time: advertiser relationship
 * Active, Standard commission terms 3.00% (not 5% — the advertiser's own
 * programme description advertises "up to 6%," but the signed term on file
 * is the 3% standard tier), 30-day referral period. Do not restate the
 * commission as 5% or as "up to 6%" anywhere the rate is quoted — the
 * accurate, current figure is 3%.
 *
 * If this URL is ever unset (e.g. the relationship lapses or CJ replaces
 * the link), callers MUST fail closed: render no baggage CTA at all, never
 * a generic travelluggagecabinbags.com link, never a constructed or
 * guessed URL, and never substitute a different provider.
 */

/** rel attribute for the baggage affiliate outbound <a> — matches the existing Trip.com flight/hotel CTAs' own rel value. */
export const BAGGAGE_PROVIDER_REL = 'nofollow sponsored noopener noreferrer';

/**
 * The exact CJ-generated Click URL — see file header for provenance.
 * `null` here (rather than deleting the export) is the deliberate
 * fail-closed switch: set to `null` to pull the CTA everywhere it renders,
 * without touching the component.
 */
const BAGGAGE_AFFILIATE_URL: string | null = 'https://www.dpbolvw.net/click-101818709-17045640';

/**
 * The one lookup every baggage affiliate CTA in the app goes through.
 * Returns the exact CJ-generated URL, or `null` if it has been unset.
 *
 * Callers MUST fail closed on `null`: render no CTA at all, never a
 * generic or constructed link.
 */
export function getBaggageAffiliateUrl(): string | null {
  return BAGGAGE_AFFILIATE_URL;
}

/** Whether a real, CJ-verified baggage affiliate link is currently configured — the fail-closed gate the CTA checks before rendering. */
export function hasBaggageAffiliateLink(): boolean {
  return BAGGAGE_AFFILIATE_URL !== null;
}
