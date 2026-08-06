import type { DealCabin } from './deals';
import { getRouteBySlug, type Route } from './routes';
import { routeStatusEvents } from './route-status-events';
// lib/route-status-copy.ts imports FROM data/routes.ts — importing it here
// (data/fare-observations.ts also imports from data/routes.ts, never the
// reverse) does not create a cycle.
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

export interface FareObservation {
  id: string;
  routeSlug: string;
  cabin: DealCabin;
  /** ISO date this fare was actually checked — never a live price claim. */
  observedDate: string;
  price: number;
  priceNote: string;
  /** Provider or airline named by the result; never imply a live price. */
  source: string;
  /** Where the manual observation was made; required for new observations. Optional only so historic entries that predate this field stay valid. */
  observedVia?: 'airline' | 'trip.com' | 'google-flights';
  /** URL used for the manual check, when stable and safe to retain; required for new observations where one exists. */
  sourceUrl?: string;
  /** Currency shown by the source — GBP only, see FARE_OBSERVATION_ARCHIVE.md's "Standard search configuration"; required for new observations. Optional only because existing entries predate this field. */
  currency?: 'GBP';
  /** Baggage allowance shown by the source, or 'not stated'; required for new observations. Optional only because existing entries predate this field. */
  baggage?: string;
  /** Versioned route profile used for this check; required for new observations. */
  profileId?: string;
  /** Why this check was made; required for new observations. */
  observationReason?: 'routine-weekly' | 'routine-fortnightly' | 'school-holiday' | 'religious-peak' | 'airline-sale' | 'emergency-recheck' | 'route-status-recheck' | 'other';
  /**
   * ISO date of the outbound departure the fare was quoted FOR — record it
   * on every new observation. Without it, "how many days before departure
   * was this fare seen" can never be computed, and that days-out dimension
   * is what the Book-By Countdown's future price curves are built from
   * (JETSTASH_PRINCIPLES.md §14). Optional only because historic entries
   * predate the field — never backfill a guessed date onto an old entry.
   */
  departureDate?: string;
  /**
   * ISO date of the return the fare was quoted FOR (Truth Reset, July 2026).
   * Required alongside `departureDate` for an observation to be publicly
   * displayable — see `isPubliclyPublishable()`. A price with no travel
   * dates doesn't say what it actually applies to; §2 of the Truth Reset
 * treats that as a fare-integrity issue, not a cosmetic one. The historic
 * entries remain incomplete by design; new, fully dated observations are
 * appended below when they meet the standard.
   */
  returnDate?: string;
  /**
   * Whether the SPECIFIC itinerary this fare was quoted for is direct or
   * connecting, as actually shown by the source at the time of the check —
   * never inferred from the route's own verified service state. A route
   * being direct (e.g. Emirates' own verified Manchester-Dubai service)
   * does NOT mean every fare ever logged against that route is also direct
   * — a cheaper search result can genuinely be a different, connecting
   * itinerary on a different airline (see the DealCard "DIRECT FLIGHT"
   * badge defect this field exists to prevent, fixed August 2026:
   * obs-man-dxb-economy-20260806-8w-v1 is Gulf Air via Bahrain, connecting,
   * despite Manchester-Dubai's own route-level service being verified
   * direct on Emirates).
   *
   * `'unknown'` is a deliberate, explicit third state — the collector
   * looked and could not determine the itinerary's routing, as distinct
   * from an omitted field on a historic entry that predates this field
   * entirely (the same reasoning as `baggage: 'not stated'` vs. `baggage`
   * simply being absent). Every observation created under the fare
   * collection checklist (`FARE_COLLECTION_CHECKLIST.md`) must record one
   * of the three values — never leave it silently unset. `'unknown'` is
   * treated identically to an omitted field by `aggregateFareDirectness()`
   * below (never drives a badge either way) — the distinction exists for
   * the archive record, not for display logic.
   *
   * Optional (undefined) only so historic entries predating this field
   * remain valid TypeScript and must never be guessed retroactively — see
   * getDealFareDirectnessLabel() in data/deals.ts for how an absent or
   * `'unknown'` value is handled safely (falls back to a route-airline
   * match check, or shows no badge at all rather than risk repeating the
   * defect).
   */
  fareDirectness?: 'direct' | 'connecting' | 'unknown';
}

/**
 * Truth Reset (July 2026): an observation is only safe to show publicly —
 * as a "Verified Check", counted in any "N fares tracked" total, or included
 * in a price range — once it records BOTH the departure and return dates it
 * was quoted for. This is deliberately strict: **none of the original 18**
 * observations satisfy it (only some have `departureDate`, and
 * `returnDate` didn't exist as a field before this pass), so every public
 * fare display on the site will honestly degrade to "no fare checks logged
 * yet" until fares are re-logged with both dates. That's an intentional,
 * disclosed consequence of the accuracy standard, not a bug — see
 * docs/LAUNCH_BLOCKERS.md (TR-002) for the founder-facing impact statement.
 * Never delete an incomplete observation to "fix" this — append complete
 * ones going forward instead.
 */
export function isPubliclyPublishable(o: FareObservation): boolean {
  return Boolean(o.departureDate && o.returnDate);
}

/**
 * Append-only fare history per route — the single source of truth for
 * every price shown on the site. Never overwrite an entry when a fare
 * changes; add a new one with a later observedDate so the trend stays
 * visible. DealCard reads this via getFareRangeSummary(), never a
 * hardcoded price — see data/deals.ts's header comment.
 *
 * Fast-logging template — copy, fill in, paste as a new entry below (never
 * edit an existing one). `departureDate` AND `returnDate` are both required
 * for a new observation to ever appear publicly — see `isPubliclyPublishable`
 * above:
 *
 *   { id: 'obs-<route>-<cabin>-<n>', routeSlug: '<route-slug>', cabin: 'Economy', observedDate: '2026-01-01', price: 0, priceNote: 'return, per person', observedVia: 'google-flights', source: '<airline or provider shown>', sourceUrl: '<manual-check-url>', currency: 'GBP', baggage: '<allowance as shown, or not stated>', profileId: '<route-profile-id>', observationReason: 'routine-weekly', departureDate: '2026-01-01', returnDate: '2026-01-15' },
 */
export const fareObservations: FareObservation[] = [
  { id: 'obs-man-lhe-economy-1', routeSlug: 'manchester-lahore', cabin: 'Economy', observedDate: '2026-06-15', price: 489, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-man-lhe-business-1', routeSlug: 'manchester-lahore', cabin: 'Business', observedDate: '2026-06-09', price: 1845, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-lhr-del-economy-1', routeSlug: 'london-heathrow-delhi', cabin: 'Economy', observedDate: '2026-06-14', price: 467, priceNote: 'return, per person', source: 'Virgin Atlantic' },
  { id: 'obs-lhr-del-business-1', routeSlug: 'london-heathrow-delhi', cabin: 'Business', observedDate: '2026-06-11', price: 2150, priceNote: 'return, per person', source: 'Virgin Atlantic' },
  { id: 'obs-bhx-atq-economy-1', routeSlug: 'birmingham-amritsar', cabin: 'Economy', observedDate: '2026-06-13', price: 521, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-bhx-atq-business-1', routeSlug: 'birmingham-amritsar', cabin: 'Business', observedDate: '2026-06-08', price: 2080, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-man-dxb-economy-1', routeSlug: 'manchester-dubai', cabin: 'Economy', observedDate: '2026-06-16', price: 349, priceNote: 'return, per person', source: 'Emirates' },
  { id: 'obs-man-dxb-business-1', routeSlug: 'manchester-dubai', cabin: 'Business', observedDate: '2026-06-12', price: 1840, priceNote: 'return, per person', source: 'Emirates' },
  { id: 'obs-lhr-doh-economy-1', routeSlug: 'london-heathrow-doha', cabin: 'Economy', observedDate: '2026-06-16', price: 398, priceNote: 'return, per person', source: 'Qatar Airways' },
  { id: 'obs-lhr-doh-business-1', routeSlug: 'london-heathrow-doha', cabin: 'Business', observedDate: '2026-06-11', price: 1640, priceNote: 'return, per person', source: 'Qatar Airways' },
  { id: 'obs-lhr-jed-economy-1', routeSlug: 'london-heathrow-jeddah', cabin: 'Economy', observedDate: '2026-06-09', price: 899, priceNote: '7 nights, flights + hotel, per person sharing', source: 'Saudia' },
  { id: 'obs-lhr-jed-business-1', routeSlug: 'london-heathrow-jeddah', cabin: 'Business', observedDate: '2026-06-10', price: 1730, priceNote: 'return, per person', source: 'Saudia' },
  { id: 'obs-man-med-economy-1', routeSlug: 'manchester-madinah', cabin: 'Economy', observedDate: '2026-06-09', price: 1149, priceNote: '14 nights Makkah & Madinah, flights + hotel, per person sharing', source: 'Saudia' },
  { id: 'obs-man-isb-business-1', routeSlug: 'manchester-islamabad', cabin: 'Business', observedDate: '2026-06-09', price: 1780, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-man-khi-economy-1', routeSlug: 'manchester-karachi', cabin: 'Economy', observedDate: '2026-06-16', price: 495, priceNote: 'return, per person', source: 'PIA' },
  { id: 'obs-lgw-amd-economy-1', routeSlug: 'london-gatwick-ahmedabad', cabin: 'Economy', observedDate: '2026-06-17', price: 412, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-lgw-amd-business-1', routeSlug: 'london-gatwick-ahmedabad', cabin: 'Business', observedDate: '2026-06-17', price: 1620, priceNote: 'return, per person', source: 'Air India' },
  { id: 'obs-lhr-bom-economy-1', routeSlug: 'london-heathrow-mumbai', cabin: 'Economy', observedDate: '2026-06-16', price: 498, priceNote: 'return, per person', source: 'British Airways' },
  { id: 'obs-lhr-bom-economy-2', routeSlug: 'london-heathrow-mumbai', cabin: 'Economy', observedDate: '2026-07-24', price: 491, priceNote: 'return, per person, Economy; starting fare', source: 'Virgin Atlantic', departureDate: '2026-09-08', returnDate: '2026-10-01' },
  { id: 'obs-man-lhe-economy-20260728-8w-v1', routeSlug: 'manchester-lahore', cabin: 'Economy', observedDate: '2026-07-28', price: 578, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Etihad', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights/search?tfs=CBwQAhooEgoyMDI2LTA5LTIyagwIAhIIL20vMDUyYndyDAgDEggvbS8weG50NRooEgoyMDI2LTEwLTA2agwIAhIIL20vMHhudDVyDAgCEggvbS8wNTJid0ABSAFwAYIBCwj___________8BmAEB', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'manchester-lahore-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-22', returnDate: '2026-10-06' },
  { id: 'obs-man-isb-economy-20260728-8w-v1', routeSlug: 'manchester-islamabad', cabin: 'Economy', observedDate: '2026-07-28', price: 562, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Etihad', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=flights%20from%20Manchester%20to%20Islamabad%20September%2022%202026%20return%20October%206%202026', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'manchester-islamabad-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-22', returnDate: '2026-10-06' },
  { id: 'obs-lhr-del-economy-20260728-8w-v1', routeSlug: 'london-heathrow-delhi', cabin: 'Economy', observedDate: '2026-07-28', price: 432, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'IndiGo (operated under lease from Norse)', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=flights%20from%20London%20Heathrow%20to%20Delhi%20September%2022%202026%20return%20October%206%202026', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'london-heathrow-delhi-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-22', returnDate: '2026-10-06' },
  { id: 'obs-bhx-atq-economy-20260728-8w-v1', routeSlug: 'birmingham-amritsar', cabin: 'Economy', observedDate: '2026-07-28', price: 733, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'KLM and IndiGo', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=flights%20from%20Birmingham%20to%20Amritsar%20September%2022%202026%20return%20October%206%202026', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'birmingham-amritsar-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-22', returnDate: '2026-10-06' },
  { id: 'obs-lhr-jed-economy-20260728-8w-v1', routeSlug: 'london-heathrow-jeddah', cabin: 'Economy', observedDate: '2026-07-28', price: 575, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Royal Jordanian', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=flights%20from%20London%20Heathrow%20to%20Jeddah%20September%2022%202026%20return%20October%206%202026', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'london-heathrow-jeddah-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-22', returnDate: '2026-10-06' },
  { id: 'obs-man-lhe-economy-20260804-8w-v1', routeSlug: 'manchester-lahore', cabin: 'Economy', observedDate: '2026-08-04', price: 620, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Etihad', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Lahore%20September%2029%202026%20return%20October%2013%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'manchester-lahore-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-29', returnDate: '2026-10-13' },
  { id: 'obs-man-isb-economy-20260804-8w-v1', routeSlug: 'manchester-islamabad', cabin: 'Economy', observedDate: '2026-08-04', price: 621, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Turkish Airlines', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Islamabad%20September%2029%202026%20return%20October%2013%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'manchester-islamabad-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-29', returnDate: '2026-10-13' },
  { id: 'obs-lhr-del-economy-20260804-8w-v1', routeSlug: 'london-heathrow-delhi', cabin: 'Economy', observedDate: '2026-08-04', price: 456, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'IndiGo (operated under lease from Norse)', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20London%20Heathrow%20to%20Delhi%20September%2029%202026%20return%20October%2013%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'london-heathrow-delhi-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-29', returnDate: '2026-10-13' },
  { id: 'obs-bhx-atq-economy-20260804-8w-v1', routeSlug: 'birmingham-amritsar', cabin: 'Economy', observedDate: '2026-08-04', price: 829, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Air France and Air India', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Birmingham%20to%20Amritsar%20September%2029%202026%20return%20October%2013%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'birmingham-amritsar-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-29', returnDate: '2026-10-13' },
  { id: 'obs-lhr-jed-economy-20260804-8w-v1', routeSlug: 'london-heathrow-jeddah', cabin: 'Economy', observedDate: '2026-08-04', price: 487, priceNote: 'return, per person, one adult; taxes and required fees included; baggage not stated and optional bag charges may apply', source: 'Etihad', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20London%20Heathrow%20to%20Jeddah%20September%2029%202026%20return%20October%2013%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated; optional charges may apply', profileId: 'london-heathrow-jeddah-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-29', returnDate: '2026-10-13' },
  { id: 'obs-man-med-economy-20260805-8w-v1', routeSlug: 'manchester-madinah', cabin: 'Economy', observedDate: '2026-08-05', price: 473, priceNote: 'return, per person, one adult; taxes and fees included as shown; baggage not stated and optional bag charges may apply', source: 'Pegasus Airlines and AJet', observedVia: 'trip.com', sourceUrl: 'https://www.trip.com/flights/showfarefirst?dcity=man&acity=med&ddate=2026-09-30&rdate=2026-10-14&dairport=man&aairport=med&triptype=rt&class=y&lowpricesource=searchform&quantity=1&searchboxarg=t&nonstoponly=off&locale=en-XX&curr=GBP', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-madinah-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-30', returnDate: '2026-10-14' },
  { id: 'obs-man-doh-economy-20260805-8w-v1', routeSlug: 'manchester-doha', cabin: 'Economy', observedDate: '2026-08-05', price: 411, priceNote: 'return, per person, one adult; taxes and fees included as shown; baggage not stated and optional bag charges may apply', source: 'Pegasus Airlines', observedVia: 'trip.com', sourceUrl: 'https://www.trip.com/flights/showfarefirst?dcity=man&acity=doh&ddate=2026-09-30&rdate=2026-10-14&dairport=man&aairport=doh&triptype=rt&class=y&lowpricesource=searchform&quantity=1&searchboxarg=t&nonstoponly=off&locale=en-XX&curr=GBP', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-doha-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-09-30', returnDate: '2026-10-14' },
  // Manchester-Dubai's first publishable observation (Route Completion Batch 1
  // founder action, closed out 6 August 2026) - see docs/project-control/
  // fare-evidence/manchester-dubai-2026-08-06.md for the full evidence
  // record this entry is transcribed from (two screenshots, reviewed and
  // approved before this was recorded; DOM-checked to confirm no explicit
  // baggage figure exists anywhere in the flow before recording 'not
  // stated' - never inferred from the ambiguous "Included" badge shown).
  { id: 'obs-man-dxb-economy-20260806-8w-v1', routeSlug: 'manchester-dubai', cabin: 'Economy', observedDate: '2026-08-06', price: 480, priceNote: 'return, per person, one adult; Gulf Air, connecting via Bahrain both ways (outbound MAN T2 09:55-DXB T1 22:35, 9h 40m total, 1h 5m in Bahrain; return DXB T1 21:00-MAN T2 07:15+1, 13h 15m total, 4h 55m in Bahrain); baggage allowance not disclosed anywhere in the selection flow', source: 'Gulf Air', observedVia: 'trip.com', sourceUrl: 'https://www.trip.com/flights/showfarefirst?dcity=man&acity=dxb&ddate=2026-10-01&rdate=2026-10-15&dairport=man&aairport=dxb&triptype=rt&class=y&curr=GBP', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-dubai-economy-1adult-baseline-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  // Fare Coverage Expansion - Batch A, route 1 of 10 (Manchester-Lahore).
  // Full round-trip itinerary via Google Flights - see
  // docs/project-control/fare-evidence/manchester-lahore-2026-08-06.md for
  // the complete evidence record (both legs' flight numbers, aircraft,
  // Istanbul connections, the "Long layover" flag, and the baggage-fees
  // dialog check that found no kg/piece figure for this fare). The two
  // historic Etihad observations on this route (2026-07-28, 2026-08-04)
  // predate the fareDirectness field and are left untouched per the
  // archive's never-edit-old-observations rule; this is a fresh entry.
  { id: 'obs-man-lhe-economy-20260806-8w-v1', routeSlug: 'manchester-lahore', cabin: 'Economy', observedDate: '2026-08-06', price: 638, priceNote: 'return, per person, one adult; Turkish Airlines, connecting via Istanbul both ways (outbound MAN 22:55-IST 04:55+1 TK1916, 15h 45m layover [flagged "Long layover" by the source], IST 20:40+1-LHE 04:05+2 TK714, 25h 10m total; return LHE 05:35-IST 10:05 TK715, 4h 10m layover, IST 14:15-MAN 16:30 TK1995, 14h 55m total); no baggage figure disclosed, only a link to the airline\'s general baggage-policy page', source: 'Turkish Airlines', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Lahore%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-lahore-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  // Fare Coverage Expansion - Batch A, route 3 of 10 (Manchester-Islamabad).
  // Deliberately lighter evidence than Dubai/Lahore, per the founder's
  // direction to keep the remaining Batch A routes lean - captured from
  // the results list only (no forced click-through into the booking flow,
  // no baggage-rule digging). See
  // docs/project-control/fare-evidence/manchester-islamabad-2026-08-06.md.
  // The two historic observations on this route (2026-07-28, 2026-08-04)
  // predate the fareDirectness field and are left untouched.
  { id: 'obs-man-isb-economy-20260806-8w-v1', routeSlug: 'manchester-islamabad', cabin: 'Economy', observedDate: '2026-08-06', price: 524, priceNote: 'return, per person, one adult; Gulf Air, connecting, 1 stop (24h 35m total, MAN 09:55-ISB 14:30+1); connecting city and baggage not disclosed in the results list', source: 'Gulf Air', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Islamabad%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-islamabad-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  // Fare Coverage Expansion - Batch A, routes 4-10, all done under the lean
  // process (results-list evidence only, no click-through, no baggage
  // digging). Manchester-Delhi and Manchester-Mumbai had zero prior
  // observations - these are each route's first. See the matching
  // docs/project-control/fare-evidence/*-2026-08-06.md files for each.
  { id: 'obs-man-del-economy-20260806-8w-v1', routeSlug: 'manchester-delhi', cabin: 'Economy', observedDate: '2026-08-06', price: 481, priceNote: 'return, per person, one adult; Gulf Air, connecting, 1 stop (13h 40m total, MAN 09:55-DEL 04:05+1); connecting city and baggage not disclosed in the results list', source: 'Gulf Air', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Delhi%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-delhi-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  { id: 'obs-man-bom-economy-20260806-8w-v1', routeSlug: 'manchester-mumbai', cabin: 'Economy', observedDate: '2026-08-06', price: 461, priceNote: 'return, per person, one adult; Gulf Air, connecting, 1 stop (14h 45m total, MAN 09:55-BOM 05:10+1); connecting city and baggage not disclosed in the results list', source: 'Gulf Air', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Mumbai%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-mumbai-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  { id: 'obs-man-amd-economy-20260806-8w-v1', routeSlug: 'manchester-ahmedabad', cabin: 'Economy', observedDate: '2026-08-06', price: 666, priceNote: 'return, per person, one adult; Emirates, connecting, 1 stop (12h 45m total, MAN 09:50-AMD 03:05+1); connecting city and baggage not disclosed in the results list', source: 'Emirates', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Ahmedabad%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-ahmedabad-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  { id: 'obs-man-atq-economy-20260806-8w-v1', routeSlug: 'manchester-amritsar', cabin: 'Economy', observedDate: '2026-08-06', price: 707, priceNote: 'return, per person, one adult; Etihad and Air India, connecting, 2 stops (18h total, MAN 09:20-ATQ 07:50+1); connecting cities and baggage not disclosed in the results list', source: 'Etihad and Air India', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Amritsar%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-amritsar-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  // Manchester-Doha: the top "Best" result is a genuine nonstop Qatar
  // Airways service (also sold under a British Airways code) - the first
  // observation in the archive with an explicit fareDirectness: 'direct'.
  // The existing obs-man-doh-economy-20260805-8w-v1 (Pegasus, connecting,
  // predates fareDirectness) is left untouched, per the never-edit rule.
  { id: 'obs-man-doh-economy-20260806-8w-v1', routeSlug: 'manchester-doha', cabin: 'Economy', observedDate: '2026-08-06', price: 666, priceNote: 'return, per person, one adult; Qatar Airways (also sold under a British Airways code), nonstop (6h 50m total, MAN 08:05-DOH 16:55); baggage not disclosed in the results list', source: 'Qatar Airways', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Doha%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-doha-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'direct' },
  { id: 'obs-man-med-economy-20260806-8w-v1', routeSlug: 'manchester-madinah', cabin: 'Economy', observedDate: '2026-08-06', price: 493, priceNote: 'return, per person, one adult; Pegasus and Flynas, connecting, 1 stop (10h 45m total, MAN 13:55-MED 02:40+1); connecting city and baggage not disclosed in the results list', source: 'Pegasus and Flynas', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Manchester%20to%20Madinah%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'manchester-madinah-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
  // Birmingham-Amritsar: the route's own verified operator (Air India) is
  // the top "Best" result here, unlike its two historic observations (KLM,
  // Air France) - this is the entry that should finally let bhx-atq-economy's
  // DealCard badge resolve to "Connecting" instead of no badge at all.
  { id: 'obs-bhx-atq-economy-20260806-8w-v1', routeSlug: 'birmingham-amritsar', cabin: 'Economy', observedDate: '2026-08-06', price: 714, priceNote: 'return, per person, one adult; Air India, connecting, 1 stop (19h 50m total, BHX 21:30-ATQ 21:50+1); connecting city and baggage not disclosed in the results list', source: 'Air India', observedVia: 'google-flights', sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20Birmingham%20to%20Amritsar%20October%201%202026%20return%20October%2015%202026&curr=GBP&hl=en&gl=GB', currency: 'GBP', baggage: 'not stated', profileId: 'birmingham-amritsar-economy-1adult-23kg-v1', observationReason: 'routine-weekly', departureDate: '2026-10-01', returnDate: '2026-10-15', fareDirectness: 'connecting' },
];

export function getObservationsByRoute(routeSlug: string) {
  return fareObservations
    .filter((o) => o.routeSlug === routeSlug)
    .sort((a, b) => a.observedDate.localeCompare(b.observedDate));
}

/** Latest observation regardless of publish-completeness — for internal/founder cadence tracking only, never public display. */
export function getLatestObservation(routeSlug: string) {
  const observations = getObservationsByRoute(routeSlug);
  return observations[observations.length - 1];
}

export function getObservationsByRouteAndCabin(routeSlug: string, cabin: DealCabin) {
  return fareObservations
    .filter((o) => o.routeSlug === routeSlug && o.cabin === cabin)
    .sort((a, b) => a.observedDate.localeCompare(b.observedDate));
}

/**
 * Pure predicate: is this exact observation safe to show publicly right
 * now? Requires ALL of:
 *  1. Date-completeness (isPubliclyPublishable).
 *  2. A defined route.
 *  3. `route.slug === observation.routeSlug` — the route passed in must
 *     actually be the one this observation was logged against, not merely
 *     any route object the caller happened to have on hand. Every current
 *     call site already looks the route up by the observation's own
 *     routeSlug, so this can't be hit in practice today — it's a defensive
 *     check against a future caller passing a mismatched pair (e.g. the
 *     wrong route object reused from an earlier loop iteration), which
 *     would otherwise silently judge an observation's publishability
 *     against a route it has nothing to do with.
 *  4. That route's EFFECTIVE status (getEffectiveRoutePresentation(), which
 *     reconciles the legacy verification model with the Route Status V1
 *     ledger for the two managed corridors) is 'direct' or 'connecting' —
 *     never 'unverified' or 'service-ended' (final audit fix: previously
 *     checked only the legacy getDisplayDirectness(), which could still
 *     read 'direct' for a ledger-managed route whose direct service has
 *     since ended or is pending reverification).
 * A missing route is treated the same as an unevidenced one: nothing can be
 * safely attributed to a pair with no Route record at all.
 *
 * Deliberately takes an explicit `route` rather than looking one up
 * internally from a slug, so this is fully unit-testable against a
 * synthetic Route + FareObservation fixture — including the specific case
 * of a date-complete observation attached to a pending route — without
 * needing (or risking) a real, fabricated entry in the production dataset.
 * See tests/verification-pending-leakage.test.ts.
 */
export function isObservationPublishable(observation: FareObservation, route: Route | undefined, nowIso: string): boolean {
  if (!isPubliclyPublishable(observation)) return false;
  if (!route) return false;
  if (route.slug !== observation.routeSlug) return false;
  const status = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso).status;
  return status === 'direct' || status === 'connecting';
}

/** Same as getObservationsByRouteAndCabin, filtered to what's safe to show publicly — see isObservationPublishable. */
export function getPublishableObservationsByRouteAndCabin(routeSlug: string, cabin: DealCabin, nowIso: string) {
  const route = getRouteBySlug(routeSlug);
  return getObservationsByRouteAndCabin(routeSlug, cabin).filter((o) => isObservationPublishable(o, route, nowIso));
}

/** Same as getPublishableObservationsByRouteAndCabin, across every cabin for the route — for surfaces like FareHistoryPanel that group by cabin themselves. */
export function getPublishableObservationsByRoute(routeSlug: string, nowIso: string) {
  const route = getRouteBySlug(routeSlug);
  return getObservationsByRoute(routeSlug).filter((o) => isObservationPublishable(o, route, nowIso));
}

/** Public-safe "last checked fare" for Book-By's Verified Check callout — never the internal getLatestObservation. Gated on both date-completeness and route evidence — see isObservationPublishable. */
export function getLatestPublishableObservation(routeSlug: string, nowIso: string) {
  const publishable = getPublishableObservationsByRoute(routeSlug, nowIso);
  return publishable[publishable.length - 1];
}

export interface FareRangeSummary {
  count: number;
  min: number;
  max: number;
  earliestDate: string;
  latestDate: string;
  /** Distinct airlines or providers the displayed observation(s) came from. Never substitute a deal's curation airline here. */
  sources: string[];
  /** Taken from the most recent observation — the most representative note for the range shown. */
  priceNote: string;
  /**
   * The observations' own recorded `fareDirectness`, when every observation
   * in this range that states one agrees — `undefined` when none of them
   * record it, or when they disagree (never average or guess). See
   * getDealFareDirectnessLabel() in data/deals.ts for how this is used: a
   * defined value here always wins over the route's own directness for
   * badge purposes, since it describes the SPECIFIC fare being shown, not
   * the route in general.
   */
  observedDirectness: 'direct' | 'connecting' | undefined;
}

/**
 * Pure aggregation of a set of observations' own `fareDirectness` values —
 * extracted out of getFareRangeSummary() so it can be unit-tested directly
 * with synthetic data (see tests/deal-card-fare-directness.test.ts), without
 * needing a real archive entry for every combination (in particular, no
 * observation has recorded `fareDirectness: 'direct'` yet — the only case
 * evidenced so far is Manchester-Dubai's 'connecting' Gulf Air fare — so the
 * 'direct' branch would otherwise be exercised by no real data at all).
 * Agrees only when every observation that states a value states the SAME
 * one; `undefined` when none state one, when they disagree, or when the
 * only values stated are `'unknown'` — never a majority guess. `'unknown'`
 * is a real, explicit archive value (a collector looked and couldn't tell)
 * but must never drive a badge, so it's treated the same as an omitted
 * field here — the distinction matters for the record, not for display.
 */
export function aggregateFareDirectness(
  observations: Pick<FareObservation, 'fareDirectness'>[]
): 'direct' | 'connecting' | undefined {
  const stated = observations
    .map((o) => o.fareDirectness)
    .filter((d): d is 'direct' | 'connecting' => d === 'direct' || d === 'connecting');
  return stated.length > 0 && stated.every((d) => d === stated[0]) ? stated[0] : undefined;
}

/**
 * Derives an honest price range from real logged observations — never a
 * "current price" claim. A single observation still returns a summary
 * (min === max), framed by the caller as "one check", not a range. Returns
 * null when nothing publishable has been logged yet for this route/cabin
 * (see isPubliclyPublishable), so callers fall back to non-perishable route
 * facts instead of showing a price.
 */
export function getFareRangeSummary(routeSlug: string, cabin: DealCabin, nowIso: string): FareRangeSummary | null {
  const observations = getPublishableObservationsByRouteAndCabin(routeSlug, cabin, nowIso);
  if (observations.length === 0) return null;
  const prices = observations.map((o) => o.price);
  const observedDirectness = aggregateFareDirectness(observations);
  return {
    count: observations.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    earliestDate: observations[0].observedDate,
    latestDate: observations[observations.length - 1].observedDate,
    sources: [...new Set(observations.map((o) => o.source))],
    priceNote: observations[observations.length - 1].priceNote,
    observedDirectness,
  };
}
