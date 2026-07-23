import { getRouteByAirportAndDestination, getDealAirlineDisplayStatus } from './routes';
import { routeStatusEvents } from './route-status-events';
import { getFareRangeSummary } from './fare-observations';
import { airlines } from './airlines';
// lib/route-status-copy.ts imports FROM data/routes.ts — importing it here
// (data/deals.ts also imports from data/routes.ts, never the reverse) does
// not create a cycle.
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

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
 * through — goes through getEffectiveRoutePresentation(), the Route Status
 * V1-aware adapter, rather than the legacy getDisplayDirectness() directly
 * (final audit fix), so a ledger-managed corridor that has ended or is
 * pending reverification never keeps showing "Direct flight" on the
 * strength of the legacy, inclusive check alone. Returns 'Direct flight'
 * only when the effective presentation is 'direct'; 'Connecting' only when
 * it's 'connecting' — a shape independently supported by the existing
 * non-ledger route model, unaffected by the ledger; undefined (no badge)
 * whenever there is no matching Route record at all, or the effective
 * status is 'unverified' or 'service-ended' — an unknown route is never
 * described as "Connecting", and neither a pending nor an ended route ever
 * shows "Direct flight".
 */
export function getDealDirectnessLabel(deal: Pick<Deal, 'fromAirportSlug' | 'toDestinationSlug'>, nowIso: string): DealDirectnessLabel {
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  if (!route) return undefined;
  const status = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso).status;
  if (status === 'direct') return 'Direct flight';
  if (status === 'connecting') return 'Connecting';
  return undefined;
}

/**
 * The single gate every deal/search card's airline label must go through
 * (Truth Reset, final correction pass; final audit fix). Route directness
 * and airline attribution are separate claims — a route showing "Direct
 * flight" does not mean the named airline is confirmed to be the one
 * flying it.
 *
 * Still gated on getDealAirlineDisplayStatus() — the exact per-airline
 * check, unchanged — as the primary rule (deliberately NOT unified with
 * getEffectiveRoutePresentation()'s own `airlineSlugs` for a 'connecting'
 * route, which is correct to show every airline unfiltered there as
 * researched informational content; a deal card's individual
 * airline-confirmation claim is a stricter, separate question that must
 * stay strict regardless of route shape). Layered on top (final audit
 * fix, two checks):
 * 1. When the route's EFFECTIVE status has been suppressed to 'unverified'
 *    or 'service-ended', the airline is never shown as confirmed even if
 *    the underlying, ledger-blind AirlineVerification record is
 *    technically still fresh — the whole route's evidence has been pulled
 *    by the ledger.
 * 2. For a 'direct' effective status specifically, the named airline must
 *    ALSO still appear in the effective presentation's own `airlineSlugs`
 *    — getEffectiveRoutePresentation() removes an airline carrying a
 *    'service-ended' or 'status-reverification-pending' notice from that
 *    list even while the route as a whole stays verified-direct on another
 *    airline's evidence, and a deal card must never disagree with that.
 *    Deliberately NOT applied to 'connecting' routes, where `airlineSlugs`
 *    is unfiltered by design (see above) and would otherwise reintroduce
 *    exactly the drift this function's strict gate exists to avoid.
 *
 * Returns:
 * - `undefined` (no airline shown at all) when there is no matching Route
 *   record for this deal's airport/destination pair.
 * - `deal.airline` unchanged when a matching Route exists, the route's
 *   effective presentation is not suppressed, that exact airline has its
 *   own current, unexpired verification (see getDealAirlineDisplayStatus()
 *   in data/routes.ts for the single-airline fallback it applies), and —
 *   for a 'direct' route — the airline is still present in the effective
 *   presentation's `airlineSlugs`.
 * - `'Verification pending'` otherwise — including when `deal.airline`
 *   isn't even in the airlines.ts registry, since an unregistered airline
 *   can never be confirmed by this system.
 */
export function getDealAirlineLabel(deal: Pick<Deal, 'fromAirportSlug' | 'toDestinationSlug' | 'airline'>, nowIso: string): string | undefined {
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  if (!route) return undefined;
  const airlineRecord = airlines.find((a) => a.name === deal.airline);
  if (!airlineRecord) return 'Verification pending';
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  if (presentation.status === 'unverified' || presentation.status === 'service-ended') return 'Verification pending';
  const status = getDealAirlineDisplayStatus(route, airlineRecord.slug, nowIso);
  if (status !== 'verified') return 'Verification pending';
  if (presentation.status === 'direct' && !presentation.airlineSlugs.includes(airlineRecord.slug)) return 'Verification pending';
  return deal.airline;
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
