/**
 * Central outbound hotel booking-link configuration — the hotel equivalent
 * of lib/booking-providers.ts's flight map, and deliberately separate from
 * it. Evidence (data/hotel-evidence.ts, what JetStash has factually
 * researched about a property) and commercial handoff (this file, where a
 * "Check current price" click actually goes) are kept in different files on
 * purpose: a hotel's factual context must never depend on whether an
 * affiliate link happens to exist for it, and an affiliate link must never
 * be treated as if it were researched evidence.
 *
 * Every URL below is the exact, unedited output of Trip.com's own Affiliate
 * Platform "Custom link" generator (Trip.com Affiliate Platform →
 * Affiliate Link → Create links), submitted with that exact property's own
 * canonical Trip.com hotel page URL and nothing else. Trip.com's system
 * appended the tracking parameters — Allianceid, SID, trip_sub1, trip_sub3
 * — automatically; none of them were typed, guessed, or edited by hand.
 * This is the same account, and the same Allianceid=9804124 / SID=327450313
 * identifiers, already live for flights in lib/booking-providers.ts —
 * confirmed via the account's own Commission Plan page to have
 * Hotel/Accommodation monetisation enabled (5% at the account's current
 * 0–199-booking tier).
 *
 * A property is deliberately ABSENT from this map — never filled with a
 * guessed or hand-built URL — until its exact page has been searched on
 * Trip.com, confirmed as an unambiguous single-property match, and run
 * through the dashboard generator exactly like the three below. Callers
 * MUST fail closed on `null`: render no "Check current price" CTA at all,
 * never a generic Trip.com hotel-search link, never a constructed URL.
 *
 * Nothing outside this file should construct or edit a Trip.com hotel URL
 * by hand — every hotel booking CTA in the app reads its outbound URL from
 * here, keyed by the property's stable `evidenceId` from
 * data/hotel-evidence.ts, never by hotel name (which can collide or be
 * retyped inconsistently).
 */

/** rel attribute for every Trip.com hotel outbound <a> — matches the flight CTA's own rel value. */
export const HOTEL_PROVIDER_REL = 'nofollow sponsored noopener noreferrer';

/**
 * evidenceId-keyed, exact dashboard-generated Trip.com hotel affiliate
 * links — see file header for provenance. Antalya MVP scope only: the
 * three properties already documented in data/hotel-evidence.ts's Antalya
 * Holiday Intelligence pilot.
 */
const TRIPCOM_HOTEL_URLS: Readonly<Record<string, string>> = {
  'antalya-trendy-lara-2026-08-11':
    'https://www.trip.com/hotels/trendy-lara-hotel-detail-9618012/trendy-lara/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19239887',
  'antalya-regnum-carya-2026-08-11':
    'https://www.trip.com/hotels/belek-hotel-detail-3054789/regnum-carya/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19239957',
  'antalya-aydinbey-kings-palace-2026-08-11':
    "https://www.trip.com/hotels/ilica-mahallesi-hotel-detail-4228551/aydinbey-king's-palace-&-spa-ultra-all-inclusive/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19239985",
};

/**
 * The one lookup every hotel booking CTA in the app goes through. Returns
 * the exact dashboard-generated Trip.com hotel URL for a supported
 * property, or `null` for any evidenceId not in TRIPCOM_HOTEL_URLS.
 *
 * Callers MUST fail closed on `null`: render no "Check current price" CTA
 * at all, never a generic Trip.com hotel-search link, never a constructed
 * or guessed URL, and never fall back to any other provider.
 */
export function getTripComHotelUrl(evidenceId: string): string | null {
  return TRIPCOM_HOTEL_URLS[evidenceId] ?? null;
}

/** Whether a property has a real, dashboard-verified Trip.com hotel link — the fail-closed gate every hotel CTA checks before rendering. */
export function hasTripComHotelLink(evidenceId: string): boolean {
  return evidenceId in TRIPCOM_HOTEL_URLS;
}
