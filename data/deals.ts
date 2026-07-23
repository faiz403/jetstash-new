import { getRouteByAirportAndDestination, getDisplayDirectness, getDealAirlineDisplayStatus } from './routes';
import { getFareRangeSummary } from './fare-observations';
import { airlines } from './airlines';

export type DealCabin = 'Economy' | 'Premium Economy' | 'Business';
export type DealCategory = 'flight' | 'package' | 'business' | 'umrah';

/**
 * A Deal is curation, not a price: which airport→destination+cabin
 * combinations are worth featuring as a card on the homepage, /deals,
 * region hubs and destination pages, plus the descriptive metadata for
 * that card (city/country names, airline, category tag).
 *
 * It deliberately carries no price field. DealCard derives what price
 * information to show (an honest observed range, a single logged check, or
 * — if nothing has been logged yet — non-perishable route facts instead)
 * from data/fare-observations.ts at render time via
 * getFareRangeSummary(routeSlug, cabin). That keeps exactly one source of
 * truth for "what have we actually seen this fare cost" and means no card
 * can silently go stale the way a hardcoded price used to.
 *
 * `categoryTag` is curation-only marketing copy ("Umrah package", "City
 * break") — it must never assert route directness. A "Direct flight"/
 * "Connecting" claim is never stored as static data; it's always computed
 * live from the route-verification system via getDealDirectnessLabel()
 * below (Truth Reset, July 2026 — a static tag previously bypassed
 * getDisplayDirectness() entirely and could show "Direct flight" on a deal
 * with no matching Route record, or on a route that was actually unverified).
 *
 * `airline` is likewise curation, not a verified claim on its own — a
 * verified route never automatically verifies every airline associated with
 * it (a British Airways source proves BA, never Saudia on the same route).
 * The card's publicly displayed airline label is always computed live via
 * getDealAirlineLabel() below, never `deal.airline` rendered directly (Truth
 * Reset, July 2026 — the raw field previously bypassed airline verification
 * entirely, letting "Saudia" display as the operating airline on Jeddah
 * Umrah-package cards despite Saudia's own Heathrow–Jeddah status being
 * explicitly unverified).
 */
export interface Deal {
  id: string;
  category: DealCategory;
  cabin: DealCabin;
  fromAirportSlug: string;
  toDestinationSlug: string;
  fromCity: string;
  toCity: string;
  toCountry: string;
  airline: string;
  categoryTag?: string;
}

export type DealDirectnessLabel = 'Direct flight' | 'Connecting' | undefined;

/**
 * The single gate every deal/search card's directness badge must go
 * through — mirrors getDisplayDirectness() exactly. Returns 'Direct flight'
 * only when a matching Route record exists AND its verification is current
 * and unexpired; 'Connecting' only when a matching Route record exists and
 * is evidenced as non-direct; undefined (no badge) whenever there is no
 * matching Route record at all, or the route is unverified — an unknown
 * route is never described as "Connecting", and an unverified route never
 * shows "Direct flight".
 */
export function getDealDirectnessLabel(deal: Pick<Deal, 'fromAirportSlug' | 'toDestinationSlug'>, nowIso: string): DealDirectnessLabel {
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  if (!route) return undefined;
  const displayDirectness = getDisplayDirectness(route, nowIso);
  if (displayDirectness === 'direct') return 'Direct flight';
  if (displayDirectness === 'connecting') return 'Connecting';
  return undefined;
}

/**
 * The single gate every deal/search card's airline label must go through
 * (Truth Reset, final correction pass). Route directness and airline
 * attribution are separate claims — a route showing "Direct flight" does
 * not mean the named airline is confirmed to be the one flying it.
 *
 * Returns:
 * - `undefined` (no airline shown at all) when there is no matching Route
 *   record for this deal's airport/destination pair — "no matching Route
 *   record" means no operating airline can be attributed either, exactly
 *   the same rule getDealDirectnessLabel() already applies to directness.
 * - `deal.airline` unchanged when a matching Route exists AND that exact
 *   airline has its own current, unexpired verification (see
 *   getDealAirlineDisplayStatus() in data/routes.ts for the single-airline
 *   fallback it applies) — never because a different airline on the same
 *   route, or the route's own directness, was verified.
 * - `'Verification pending'` when a matching Route exists but this airline
 *   is not currently verified on it — including when `deal.airline` isn't
 *   even in the airlines.ts registry, since an unregistered airline can
 *   never be confirmed by this system.
 */
export function getDealAirlineLabel(deal: Pick<Deal, 'fromAirportSlug' | 'toDestinationSlug' | 'airline'>, nowIso: string): string | undefined {
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  if (!route) return undefined;
  const airlineRecord = airlines.find((a) => a.name === deal.airline);
  if (!airlineRecord) return 'Verification pending';
  const status = getDealAirlineDisplayStatus(route, airlineRecord.slug, nowIso);
  return status === 'verified' ? deal.airline : 'Verification pending';
}

export const deals: Deal[] = [
  {
    id: 'man-lhe-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'lahore',
    fromCity: 'Manchester',
    toCity: 'Lahore',
    toCountry: 'Pakistan',
    airline: 'PIA',
  },
  {
    // Truth Reset (July 2026): airline corrected from 'British Airways' to 'PIA'.
    // No source found for a current direct BA Heathrow–Islamabad service; PIA
    // relaunched this exact route direct from 29 March 2026 (3x weekly),
    // confirmed via independent aviation-news reporting, cross-checked against
    // multiple outlets. No Route entry exists yet for this pair — flagged for
    // a future data addition once flight-time/frequency specifics are sourced.
    id: 'lhr-isb-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'islamabad',
    fromCity: 'London Heathrow',
    toCity: 'Islamabad',
    toCountry: 'Pakistan',
    airline: 'PIA',
  },
  {
    id: 'lhr-del-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'delhi',
    fromCity: 'London Heathrow',
    toCity: 'Delhi',
    toCountry: 'India',
    airline: 'Virgin Atlantic',
  },
  {
    id: 'bhx-atq-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'birmingham',
    toDestinationSlug: 'amritsar',
    fromCity: 'Birmingham',
    toCity: 'Amritsar',
    toCountry: 'India',
    airline: 'Air India',
  },
  {
    id: 'man-dxb-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'dubai',
    fromCity: 'Manchester',
    toCity: 'Dubai',
    toCountry: 'United Arab Emirates',
    airline: 'Emirates',
  },
  {
    id: 'lhr-doh-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'doha',
    fromCity: 'London Heathrow',
    toCity: 'Doha',
    toCountry: 'Qatar',
    airline: 'Qatar Airways',
  },
  {
    id: 'dxb-business-man',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'dubai',
    fromCity: 'Manchester',
    toCity: 'Dubai',
    toCountry: 'United Arab Emirates',
    airline: 'Emirates',
  },
  {
    id: 'lhr-business-del',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'delhi',
    fromCity: 'London Heathrow',
    toCity: 'Delhi',
    toCountry: 'India',
    airline: 'Virgin Atlantic',
  },
  {
    // Truth Reset (July 2026): airline corrected from 'British Airways' to 'PIA'.
    // No source found for a current direct BA Heathrow–Lahore service; PIA
    // relaunched this exact route direct from 30 March 2026 (weekly), confirmed
    // via independent aviation-news reporting, cross-checked against multiple
    // outlets. No Route entry exists yet for this pair — flagged for a future
    // data addition once flight-time/frequency specifics are sourced.
    id: 'lhr-business-lhe',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'lahore',
    fromCity: 'London Heathrow',
    toCity: 'Lahore',
    toCountry: 'Pakistan',
    airline: 'PIA',
  },
  {
    id: 'man-lhe-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'lahore',
    fromCity: 'Manchester',
    toCity: 'Lahore',
    toCountry: 'Pakistan',
    airline: 'PIA',
  },
  {
    id: 'umrah-package-jed',
    category: 'umrah',
    cabin: 'Economy',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'jeddah',
    fromCity: 'London Heathrow',
    toCity: 'Jeddah',
    toCountry: 'Saudi Arabia',
    airline: 'Saudia',
    categoryTag: 'Umrah package',
  },
  {
    id: 'umrah-package-extended',
    category: 'umrah',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'madinah',
    fromCity: 'Manchester',
    toCity: 'Madinah',
    toCountry: 'Saudi Arabia',
    airline: 'Saudia',
    categoryTag: 'Umrah package',
  },
  {
    id: 'man-ist-package',
    category: 'package',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'istanbul',
    fromCity: 'Manchester',
    toCity: 'Istanbul',
    toCountry: 'Turkey',
    airline: 'Turkish Airlines',
    categoryTag: 'City break',
  },
  {
    id: 'bhx-ayt-package',
    category: 'package',
    cabin: 'Economy',
    fromAirportSlug: 'birmingham',
    toDestinationSlug: 'antalya',
    fromCity: 'Birmingham',
    toCity: 'Antalya',
    toCountry: 'Turkey',
    airline: 'Jet2',
    categoryTag: 'Family all-inclusive',
  },
  {
    id: 'lgw-rak-package',
    category: 'package',
    cabin: 'Economy',
    fromAirportSlug: 'london-gatwick',
    toDestinationSlug: 'marrakech',
    fromCity: 'London Gatwick',
    toCity: 'Marrakech',
    toCountry: 'Morocco',
    airline: 'easyJet',
    categoryTag: 'City break',
  },
  // Turkey & Morocco coverage additions (July 2026) — fill destination/cabin
  // coverage gaps, same curation-only rule as the header comment.
  {
    id: 'man-dlm-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'dalaman',
    fromCity: 'Manchester',
    toCity: 'Dalaman',
    toCountry: 'Turkey',
    airline: 'Jet2',
  },
  {
    id: 'man-bjv-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'bodrum',
    fromCity: 'Manchester',
    toCity: 'Bodrum',
    toCountry: 'Turkey',
    airline: 'Jet2',
  },
  {
    id: 'lgw-adb-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-gatwick',
    toDestinationSlug: 'izmir',
    fromCity: 'London Gatwick',
    toCity: 'Izmir',
    toCountry: 'Turkey',
    airline: 'SunExpress',
  },
  {
    id: 'lgw-aga-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-gatwick',
    toDestinationSlug: 'agadir',
    fromCity: 'London Gatwick',
    toCity: 'Agadir',
    toCountry: 'Morocco',
    airline: 'easyJet',
  },
  {
    id: 'lhr-cmn-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'casablanca',
    fromCity: 'London Heathrow',
    toCity: 'Casablanca',
    toCountry: 'Morocco',
    airline: 'Royal Air Maroc',
  },
  {
    id: 'lgw-tng-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-gatwick',
    toDestinationSlug: 'tangier',
    fromCity: 'London Gatwick',
    toCity: 'Tangier',
    toCountry: 'Morocco',
    airline: 'easyJet',
  },
  {
    id: 'man-bcn-flight',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'barcelona',
    fromCity: 'Manchester',
    toCity: 'Barcelona',
    toCountry: 'Spain',
    airline: 'Ryanair',
    categoryTag: 'Flight only',
  },
  {
    id: 'brs-fao-package',
    category: 'package',
    cabin: 'Economy',
    fromAirportSlug: 'bristol',
    toDestinationSlug: 'faro',
    fromCity: 'Bristol',
    toCity: 'Faro',
    toCountry: 'Portugal',
    airline: 'TUI',
    categoryTag: 'Family holiday',
  },
  // ─── Added to fill destination coverage gaps — see note below ───
  {
    id: 'lhr-bom-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'mumbai',
    fromCity: 'London Heathrow',
    toCity: 'Mumbai',
    toCountry: 'India',
    airline: 'British Airways',
  },
  // Truth Reset (July 2026): hidden from the public array, not deleted — no
  // source found for any airline currently operating a direct London
  // Heathrow–Karachi service (British Airways was the previously-claimed
  // operator; no evidence supports this). Preserved here for history; restore
  // only once a confirmed current operator/route is sourced.
  // {
  //   id: 'lhr-khi-economy',
  //   category: 'flight',
  //   cabin: 'Economy',
  //   fromAirportSlug: 'london-heathrow',
  //   toDestinationSlug: 'karachi',
  //   fromCity: 'London Heathrow',
  //   toCity: 'Karachi',
  //   toCountry: 'Pakistan',
  //   airline: 'British Airways',
  // },
  {
    id: 'man-khi-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'karachi',
    fromCity: 'Manchester',
    toCity: 'Karachi',
    toCountry: 'Pakistan',
    airline: 'PIA',
  },
  {
    id: 'man-ath-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'athens',
    fromCity: 'Manchester',
    toCity: 'Athens',
    toCountry: 'Greece',
    airline: 'easyJet',
  },
  {
    id: 'man-fco-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'rome',
    fromCity: 'Manchester',
    toCity: 'Rome',
    toCountry: 'Italy',
    airline: 'Ryanair',
  },
  {
    id: 'man-isb-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'manchester',
    toDestinationSlug: 'islamabad',
    fromCity: 'Manchester',
    toCity: 'Islamabad',
    toCountry: 'Pakistan',
    airline: 'PIA',
  },
  // Truth Reset (July 2026): hidden — see identical note above lhr-khi-economy.
  // {
  //   id: 'lhr-khi-business',
  //   category: 'business',
  //   cabin: 'Business',
  //   fromAirportSlug: 'london-heathrow',
  //   toDestinationSlug: 'karachi',
  //   fromCity: 'London Heathrow',
  //   toCity: 'Karachi',
  //   toCountry: 'Pakistan',
  //   airline: 'British Airways',
  // },
  {
    id: 'bhx-atq-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'birmingham',
    toDestinationSlug: 'amritsar',
    fromCity: 'Birmingham',
    toCity: 'Amritsar',
    toCountry: 'India',
    airline: 'Air India',
  },
  {
    id: 'lhr-doh-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'doha',
    fromCity: 'London Heathrow',
    toCity: 'Doha',
    toCountry: 'Qatar',
    airline: 'Qatar Airways',
  },
  {
    id: 'lhr-jed-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'jeddah',
    fromCity: 'London Heathrow',
    toCity: 'Jeddah',
    toCountry: 'Saudi Arabia',
    airline: 'Saudia',
  },
  {
    id: 'lhr-med-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'london-heathrow',
    toDestinationSlug: 'madinah',
    fromCity: 'London Heathrow',
    toCity: 'Madinah',
    toCountry: 'Saudi Arabia',
    airline: 'Saudia',
  },
  {
    id: 'lgw-amd-economy',
    category: 'flight',
    cabin: 'Economy',
    fromAirportSlug: 'london-gatwick',
    toDestinationSlug: 'ahmedabad',
    fromCity: 'London Gatwick',
    toCity: 'Ahmedabad',
    toCountry: 'India',
    airline: 'Air India',
  },
  {
    id: 'lgw-amd-business',
    category: 'business',
    cabin: 'Business',
    fromAirportSlug: 'london-gatwick',
    toDestinationSlug: 'ahmedabad',
    fromCity: 'London Gatwick',
    toCity: 'Ahmedabad',
    toCountry: 'India',
    airline: 'Air India',
  },
];

export function getDealsByDestination(destinationSlug: string) {
  return deals.filter((d) => d.toDestinationSlug === destinationSlug);
}

export function getDealsByAirport(airportSlug: string) {
  return deals.filter((d) => d.fromAirportSlug === airportSlug);
}

export function getDealsByRegionGroup(slugs: string[]) {
  return deals.filter((d) => slugs.includes(d.toDestinationSlug));
}

export function getDealsByCategory(category: DealCategory) {
  return deals.filter((d) => d.category === category);
}

/**
 * Truth Reset (July 2026): whether this deal currently has a genuinely
 * publishable checked fare behind it (see getFareRangeSummary /
 * isPubliclyPublishable in data/fare-observations.ts) — never assume it does
 * just because the deal object exists. A deal with no matching route, or a
 * route with only incomplete observations, has no tracked fare and must not
 * be counted as one anywhere (Deals page totals, category counts, homepage
 * counts, structured data). Also gated on the route's own directness (see
 * getFareRangeSummary) — a route that's currently 'unverified'/pending
 * never counts as having a tracked fare, even if a date-complete
 * observation exists for it.
 */
export function hasTrackedFare(deal: Deal, nowIso: string): boolean {
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  if (!route) return false;
  return getFareRangeSummary(route.slug, deal.cabin, nowIso) !== null;
}

/** Renders a human "15 June 2026" date string for observed-fare dates (e.g. "One check, 15 June 2026"). Never implies a live or verified price. */
export function formatChecked(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
