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
 * links — see file header for provenance.
 *
 * Antalya MVP (August 2026): the original 3 properties from
 * data/hotel-evidence.ts's Antalya Holiday Intelligence pilot.
 *
 * Hotel Intelligence + Monetisation Expansion pilot (August 2026): the 9
 * Dubai/Madinah/Dalaman-region properties approved for the public pilot
 * (data/hotel-evidence-expansion.ts). Generated in one session via the
 * Trip.com Affiliate Platform's Create-links tool, each verified present as
 * a distinct entry (unique trip_sub3, unique timestamp) in that tool's own
 * "Previous links" history before being copied here — none hand-built,
 * none reused from another property.
 *
 * Final expansion activation batch (August 2026): the remaining 17
 * properties across Istanbul, Marrakech, Bodrum, Agadir, Barcelona and Faro
 * — the founder-approved final six destinations, generated and verified the
 * same way as the pilot above. This completes the full, frozen 10-
 * destination public Hotel Intelligence set (Antalya + all 9 expansion
 * destinations); see lib/holiday-intelligence.ts's public allowlist.
 */
const TRIPCOM_HOTEL_URLS: Readonly<Record<string, string>> = {
  'antalya-trendy-lara-2026-08-11':
    'https://www.trip.com/hotels/trendy-lara-hotel-detail-9618012/trendy-lara/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19239887',
  'antalya-regnum-carya-2026-08-11':
    'https://www.trip.com/hotels/belek-hotel-detail-3054789/regnum-carya/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19239957',
  'antalya-aydinbey-kings-palace-2026-08-11':
    "https://www.trip.com/hotels/ilica-mahallesi-hotel-detail-4228551/aydinbey-king's-palace-&-spa-ultra-all-inclusive/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19239985",
  'dubai-hilton-dubai-jumeirah-2026-08-15':
    'https://www.trip.com/hotels/dubai-hotel-detail-1774695/hilton-dubai-jumeirah/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258815',
  'dubai-address-downtown-2026-08-15':
    'https://www.trip.com/hotels/dubai-hotel-detail-756239/address-downtown/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258878',
  'dubai-atlantis-the-palm-2026-08-15':
    'https://www.trip.com/hotels/dubai-hotel-detail-984964/atlantis-the-palm-dubai/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258885',
  'dubai-sheraton-dubai-creek-2026-08-15':
    'https://www.trip.com/hotels/dubai-hotel-detail-755656/sheraton-dubai-creek-hotel-and-towers/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258892',
  'madinah-anwar-al-madinah-movenpick-2026-08-15':
    'https://www.trip.com/hotels/medina-hotel-detail-3738129/anwar-al-madinah-mvenpick-hotel/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258899',
  'madinah-pullman-zamzam-madinah-2026-08-15':
    'https://www.trip.com/hotels/medina-hotel-detail-4055814/pullman-zamzam-madinah/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258927',
  'dalaman-harbour-suites-fethiye-2026-08-15':
    'https://www.trip.com/hotels/fethiye-hotel-detail-45589881/harbour-suites/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258969',
  'dalaman-liberty-lykia-oludeniz-2026-08-15':
    'https://www.trip.com/hotels/uzunyurt-mahallesi-hotel-detail-2553031/liberty-hotels-lykia/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258983',
  'dalaman-marti-resort-marmaris-2026-08-15':
    'https://www.trip.com/hotels/marmaris-hotel-detail-3448088/marti-resort-deluxe-hotel/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19258990',
  'istanbul-four-seasons-sultanahmet-2026-08-15':
    'https://www.trip.com/hotels/istanbul-hotel-detail-2198755/four-seasons-hotel-istanbul-at-sultanahmet/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259137',
  'istanbul-lokalist-taksim-2026-08-15':
    'https://www.trip.com/hotels/istanbul-hotel-detail-114715112/lokalist-istanbul-a-tribute-portfolio-hotel/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259144',
  'istanbul-anemon-galata-2026-08-15':
    'https://www.trip.com/hotels/istanbul-hotel-detail-2506424/anemon-koleksiyon-galata-otel/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259200',
  'marrakech-la-mamounia-2026-08-15':
    'https://www.trip.com/hotels/marrakech-hotel-detail-17507165/la-mamounia/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259242',
  'marrakech-sofitel-hivernage-2026-08-15':
    'https://us.trip.com/hotels/marrakech-hotel-detail-2111138/sofitel-marrakech-palais-imperial-spa/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259270',
  'marrakech-barcelo-palmeraie-2026-08-15':
    "https://in.trip.com/hotels/marrakech-hotel-detail-3042923/barcel-palmeraie-oasis-resort/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259277",
  'bodrum-doubletree-marina-vista-2026-08-15':
    'https://www.trip.com/hotels/bodrum-hotel-detail-3030691/marina-vista-hotel/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259284',
  'bodrum-the-bodrum-edition-yalikavak-2026-08-15':
    'https://in.trip.com/hotels/yalikavak-hotel-detail-21867636/the-bodrum-edition/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259291',
  'bodrum-bodrum-beach-resort-gumbet-2026-08-15':
    'https://www.trip.com/hotels/gumbet-hotel-detail-4057730/bodrum-beach-resort/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259298',
  'agadir-sofitel-royal-bay-2026-08-15':
    'https://www.trip.com/hotels/agadir-hotel-detail-2172348/sofitel-agadir-royal-bay/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259305',
  'agadir-hilton-taghazout-bay-2026-08-15':
    'https://us.trip.com/hotels/agadir-ida-ou-tanane-province-hotel-detail-97947946/hilton-taghazout-bay-beach-resort-spa/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259312',
  'barcelona-ohla-eixample-2026-08-15':
    'https://us.trip.com/hotels/barcelona-hotel-detail-5704839/ohla-eixample/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259326',
  'barcelona-hotel-gotico-2026-08-15':
    'https://www.trip.com/hotels/barcelona-hotel-detail-2157689/hotel-gtico/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259333',
  'barcelona-sofitel-skipper-barceloneta-2026-08-15':
    'https://us.trip.com/hotels/barcelona-hotel-detail-2187785/pullman-barcelona-skipper/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259354',
  'faro-occidental-faro-2026-08-15':
    'https://www.trip.com/hotels/faro-hotel-detail-743187/occidental-faro/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259368',
  'faro-grande-real-santa-eulalia-albufeira-2026-08-15':
    'https://in.trip.com/hotels/olhos-de-agua-hotel-detail-2564799/grande-real-santa-eulalia-resort/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259382',
  'faro-tivoli-marina-vilamoura-2026-08-15':
    'https://www.trip.com/hotels/quarteira-hotel-detail-743803/tivoli-marina-vilamoura/?Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19259389',
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
