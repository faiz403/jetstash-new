import { airports } from './airports';
import { destinations } from './destinations';
import { getPeakPeriodsByIds } from './peak-periods';
import {
  type RouteStatusEvent,
  type RouteStatusScope,
  type NonEmptyArray,
  getEventsForRoute,
  getActiveEvents,
  groupByServiceId,
  isCurrentClaimValid,
  scopesMatch,
} from './route-status-events';

/**
 * Truth Reset (July 2026): a route must never display a "Direct" badge
 * purely because `isDirect: true` was set once — that boolean now only
 * describes the route's general shape (does a direct option exist at all).
 * What's actually safe to *show publicly as current* is governed by
 * `verification` below, via `getDisplayDirectness()`. A route with no
 * `verification` record, an expired `reviewDueDate`, or a non-'verified'
 * status renders as "Verification pending" regardless of `isDirect`.
 */
export type RouteVerificationStatus = 'verified' | 'unverified' | 'paused' | 'seasonal';

export interface RouteVerification {
  status: RouteVerificationStatus;
  /** Organisation the claim was checked against — e.g. an airline's own booking system, an aviation-industry news source for a network change, or a UK airport's own timetable. */
  sourceName: string;
  sourceUrl?: string;
  /** ISO date this was actually checked. */
  verifiedDate: string;
  /** Past this date, the verification is treated as expired — see getDisplayDirectness(). */
  reviewDueDate: string;
  /** Plain-language context — required for 'unverified'/'paused'/'seasonal', explaining what's uncertain. */
  note?: string;
}

/**
 * Truth Reset (July 2026, founder correction): route-level `verification`
 * above answers "is this route direct at all" — it does NOT mean every
 * airline in `airlineSlugs` is individually confirmed. A source proving one
 * airline flies a route must never be read as verifying every other airline
 * listed on it (e.g. a British Airways press release proves BA, never
 * Saudia). Where a route lists more than one airline and the evidence for
 * each airline differs, record each airline's own claim here — see
 * `getAirlineDisplayStatus()`. A route with no `airlineVerifications` entry
 * for a given airline falls back to the route-level `verification` for
 * badge purposes, but never implies that specific airline's frequency or
 * schedule is confirmed.
 */
export interface AirlineVerification {
  airlineSlug: string; // references data/airlines.ts
  status: RouteVerificationStatus;
  /** Organisation the claim was checked against, for THIS airline specifically. */
  sourceName: string;
  sourceUrl?: string;
  /** ISO date this was actually checked. */
  verifiedDate: string;
  /** Past this date, the verification is treated as expired. */
  reviewDueDate: string;
  /** Effective period the source's evidence actually covers, e.g. "current at access" or "ends 31 Aug 2026". */
  effectivePeriod: string;
  /** What exactly this source supports — e.g. "Confirms direct service exists." Never inflate this to imply frequency unless the source states one. */
  supportedClaim: string;
  /** What remains unconfirmed for this airline specifically (frequency, exact schedule, etc). */
  remainingUncertainty?: string;
}

export interface Route {
  slug: string; // e.g. "manchester-lahore"
  airportSlug: string;
  destinationSlug: string;
  flightTime: string;
  frequency: string; // e.g. "Daily direct" or "4x weekly via Dubai"
  airlineSlugs: string[]; // references data/airlines.ts
  isDirect: boolean;
  /** Optional until every route has one — see getDisplayDirectness()'s fallback behaviour for routes without it. */
  verification?: RouteVerification;
  /** Per-airline evidence, only where it differs from a single route-level claim — see AirlineVerification's doc comment. Optional; most routes have one uncontested operator and don't need this. */
  airlineVerifications?: AirlineVerification[];
  intro: string;
  bookingWindowNote: string;
  peakPeriodIds: string[]; // references data/peak-periods.ts
  /**
   * Always populated for routes that have or had a meaningful direct
   * option, describing the realistic connecting alternative — this is
   * what the route page falls back to describing once isDirect is false
   * or the direct service ends. Optional only for routes that have never
   * had a direct option and so don't need a "compare to direct" framing.
   */
  connectingAlternative?: {
    typicalStops: 1 | 2;
    hubAirports: string[];
    typicalAirlines: string[];
    typicalJourneyTime: string;
  };
}

export const routes: Route[] = [
  {
    slug: 'manchester-lahore',
    airportSlug: 'manchester',
    destinationSlug: 'lahore',
    flightTime: '8h direct',
    frequency: 'Direct — current frequency not confirmed by an official schedule, see note',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Manchester Airport's own media centre: \"A dozen new routes are launching from Manchester Airport this summer\" (mediacentre.manchesterairport.co.uk, 19 May 2026)",
      sourceUrl: 'https://mediacentre.manchesterairport.co.uk/a-dozen-new-routes-are-launching-from-manchester-airport-this-summer--from-med-beach-hotspots-to-major-global-hubs/',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-13',
      note: 'Re-verified against a genuine primary source (founder-supplied): Manchester Airport\'s own media centre confirms "Pakistan International Airlines will build upon the successful launch of its Islamabad service by adding Lahore as its second destination from Manchester from 3 July" 2026 — confirms direct status, PIA as operator, and the 3 July 2026 start date. This article does not state a frequency, and no current official schedule was found confirming one, so no frequency is published (a prior "weekly" claim, and before that "several times weekly," both rested on secondary aviation-news reporting only — not republished as fact). PIA\'s own site (piac.com.pk) remains Cloudflare-blocked to this session\'s tooling.',
    },
    intro:
      'The flagship Pakistan corridor from the North of England. PIA runs direct Manchester to Lahore services (confirmed via Manchester Airport\'s own announcement, launched 3 July 2026), and for the North West\'s Punjabi community it\'s usually the most convenient option going: no Gulf connection, no extra layover, no risk of luggage going missing at a transfer.',
    bookingWindowNote:
      'Outside Eid and the summer school holidays, fares hold reasonably steady 8 to 10 weeks out. Within 3 weeks of Eid, expect a sharp jump, so book that window at least 3 months ahead if your dates are fixed.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays', 'wedding-season'],
  },
  {
    slug: 'manchester-islamabad',
    airportSlug: 'manchester',
    destinationSlug: 'islamabad',
    flightTime: '7h 45m direct',
    frequency: 'Launched twice weekly (Tue/Sat) from 25 Oct 2025 — current frequency not confirmed by an official schedule, see note',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Manchester Airport's own media centre: \"Hundreds of thousands of people to benefit as Pakistan International Airlines launches new route from Manchester Airport\" (mediacentre.manchesterairport.co.uk, 6 Oct 2025), corroborated by Manchester Airport's 19 May 2026 article describing the route as an ongoing \"successful\" service",
      sourceUrl: 'https://mediacentre.manchesterairport.co.uk/hundreds-of-thousands-of-people-to-benefit-as-pakistan-international-airlines-launches-new-route-from-manchester-airport/',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-13',
      note: 'Re-verified against genuine primary sources (founder-supplied): Manchester Airport\'s own media centre confirms PIA launched this route "on Tuesdays and Saturdays from 25 October [2025] with a view to increasing the frequency" — confirming direct status, PIA as operator, and the launch frequency of twice weekly. The later 19 May 2026 article, while primarily about the Lahore launch, independently corroborates the Islamabad service\'s continued existence by calling it a "successful launch" that Lahore builds on — but neither article confirms whether the frequency actually increased from the stated launch figure. A previously recorded "4x weekly" figure rested on secondary aviation-news reporting only and is not republished as a current fact; "twice weekly" is recorded here strictly as the documented October 2025 launch frequency, not as today\'s frequency. PIA\'s own site (piac.com.pk) remains Cloudflare-blocked to this session\'s tooling — no current schedule could be directly checked.',
    },
    intro:
      'Manchester to Islamabad direct services (confirmed via Manchester Airport\'s own announcement, launched 25 October 2025) are the practical choice for families based across Yorkshire, Lancashire and the wider North West heading to Punjab or onward to Khyber Pakhtunkhwa.',
    bookingWindowNote:
      'The pattern is similar to the Lahore route: stable pricing most of the year, then sharp rises close to Eid and major family events. This route also tends to sell out faster than Lahore in peak weeks, simply because it runs fewer weekly frequencies.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
  },
  {
    slug: 'london-heathrow-delhi',
    airportSlug: 'london-heathrow',
    destinationSlug: 'delhi',
    flightTime: '8h 45m direct',
    frequency: 'Daily, multiple direct options',
    airlineSlugs: ['virgin-atlantic', 'british-airways', 'air-india'],
    isDirect: true,
    intro:
      'Heathrow to Delhi is the busiest UK to India corridor, and genuine airline competition keeps fares more responsive here than on routes served by a single carrier. It\'s worth comparing all three direct operators rather than booking the first result you see.',
    bookingWindowNote:
      'Diwali and the December to January window are the two demand spikes that matter most. Outside those, February to April and September to October are reliably the best value months.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-amritsar',
    airportSlug: 'birmingham',
    destinationSlug: 'amritsar',
    flightTime: '9h direct',
    frequency: '3x weekly direct',
    airlineSlugs: ['air-india'],
    isDirect: true,
    intro:
      'For the Midlands\' large Punjabi community, Birmingham\'s direct Air India service to Amritsar avoids the Delhi connection that would otherwise be necessary. It\'s the most direct route to the Golden Temple and rural Punjab, though it runs 3 times a week rather than daily.',
    bookingWindowNote:
      'This is a reduced-frequency scheduled service, not a daily one, so confirm your travel dates fall on an active flight day before booking. It\'s also worth pricing a Delhi or Gatwick-connecting fallback in case your preferred dates don\'t line up.',
    peakPeriodIds: ['baisakhi', 'diwali', 'uk-summer-holidays'],
  },
  {
    slug: 'manchester-dubai',
    airportSlug: 'manchester',
    destinationSlug: 'dubai',
    flightTime: '7h direct',
    frequency: 'Daily direct',
    airlineSlugs: ['emirates'],
    isDirect: true,
    intro:
      'Emirates\' daily Manchester to Dubai service is one of the more reliably priced long-haul routes from the North, helped by strong competition from connecting Gulf carriers flying out of other UK airports.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. Winter, when UK schools are off, carries the clearest premium; outside that, fares are comparatively stable.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'london-heathrow-doha',
    airportSlug: 'london-heathrow',
    destinationSlug: 'doha',
    flightTime: '6h 30m direct',
    frequency: 'Multiple daily direct',
    airlineSlugs: ['qatar-airways'],
    isDirect: true,
    intro:
      'Qatar Airways runs this as a high-frequency hub route. Most UK travellers heading further afield through Doha will pass through here, though it also stands on its own as a city break or family stopover.',
    bookingWindowNote:
      'High frequency means more fare classes open at once, so comparing departure times on the same day can turn up meaningfully different prices. Ramadan shifts the pace of travel through this hub, but it doesn\'t move the price the way it does on the Jeddah and Madinah routes.',
    peakPeriodIds: ['uk-summer-holidays', 'christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'london-heathrow-jeddah',
    airportSlug: 'london-heathrow',
    destinationSlug: 'jeddah',
    flightTime: '6h 15m direct (per BA\'s own destination page)',
    frequency: 'British Airways confirmed direct, frequency unconfirmed. Saudia\'s current status is separately unverified — see note.',
    airlineSlugs: ['saudia', 'british-airways'],
    isDirect: true,
    airlineVerifications: [
      {
        airlineSlug: 'british-airways',
        status: 'verified',
        sourceName: "British Airways' own current destination/booking page, \"Direct Flights to Jeddah Deals (JED) 2026 | Book now with BA\" (britishairways.com/content/flights/saudi-arabia/jeddah) — live and current at time of access, presenting Jeddah as an active BA destination with a working flight-search widget, cabin options and a stated 6h15m flight time.",
        sourceUrl: 'https://www.britishairways.com/content/flights/saudi-arabia/jeddah',
        verifiedDate: '2026-07-13',
        reviewDueDate: '2026-08-13',
        effectivePeriod: 'Current at access',
        supportedClaim: 'Confirms BA publicly markets and sells direct Heathrow–Jeddah flights. Does not state a current frequency, and BA\'s own schedule-search tool could not be made to render this session (a recurring cookie-consent technical-issue block), so none is published.',
        remainingUncertainty: 'A specific secondary source (Head for Points, 10 Apr 2026) claims BA terminated this route on 24 April 2026 — unreconciled with BA\'s own live marketing page. BA\'s own Aug 2025 press release described Jeddah increasing to 5x weekly, and BA\'s own Mar 2026 Middle East cuts release does not list Jeddah among affected routes. Treated as a genuine, disclosed conflict, not resolved either way — see docs/LAUNCH_BLOCKERS.md TR-010.',
      },
      {
        airlineSlug: 'saudia',
        status: 'unverified',
        sourceName: 'No qualifying primary source obtained this session — the BA source above proves BA\'s own operation only, per the founder\'s explicit instruction that one airline\'s evidence must never verify another.',
        verifiedDate: '2026-07-13',
        reviewDueDate: '2026-08-13',
        effectivePeriod: 'n/a — not verified',
        supportedClaim: 'None. Saudia was previously treated as "long-standing, not in dispute" without an independent current-source check this session — that assumption is corrected here rather than carried forward unverified.',
        remainingUncertainty: 'Saudia\'s own site, Jeddah Airport\'s own site, or an equivalent official schedule source has not been checked. Do not treat Saudia as confirmed until one is obtained.',
      },
    ],
    intro:
      'The primary direct Umrah arrival route from the UK. British Airways operates this route directly — confirmed via BA\'s own current "Direct Flights to Jeddah" destination page, though its current frequency isn\'t confirmed by a live schedule this session. Saudia has historically been the main Umrah-arrival operator here, but this session could not independently confirm Saudia\'s current status against an official source — check directly with both airlines before booking. Most flight-inclusive Umrah packages are built around the Jeddah corridor, with onward ground transport to Makkah.',
    bookingWindowNote:
      'Ramadan and the weeks immediately before Hajj season are by far the steepest pricing windows on this route. Outside them, pricing is comparatively settled.',
    peakPeriodIds: ['ramadan', 'pre-hajj', 'school-half-terms-umrah'],
  },
  {
    slug: 'manchester-karachi',
    airportSlug: 'manchester',
    destinationSlug: 'karachi',
    flightTime: '8h 30m direct (unverified — see note)',
    frequency: 'Unverified — confirm directly with PIA before booking',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: 'Secondary investigation lead only (not a primary source): PIA UK network reporting across multiple independent Pakistani aviation news outlets, July 2026.',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-13',
      note: 'Current 2026 secondary reporting describes PIA\'s direct Manchester services as Lahore and Islamabad only — no source found confirming an active direct Manchester–Karachi service, and no primary source (PIA\'s own site is Cloudflare-blocked) could be reached to confirm this either way. This may connect via Islamabad or Lahore instead. Kept unverified pending a confirmed primary source; re-check PIA\'s own booking system directly.',
    },
    intro:
      'PIA has flown Manchester to Karachi in the past, but current 2026 route reporting describes PIA\'s direct Manchester services as Lahore and Islamabad only — we can\'t currently confirm an active direct Manchester–Karachi service. Check PIA\'s own booking system directly for the current routing; a connection via Islamabad or Lahore is realistic.',
    bookingWindowNote:
      'PIA\'s UK network has expanded significantly through 2025 and 2026 after a long suspension. Confirm the current routing and schedule directly with PIA before assuming this is a direct service, and book 2 to 3 months ahead of Eid or wedding season regardless of routing.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'wedding-season', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-lahore',
    airportSlug: 'birmingham',
    destinationSlug: 'lahore',
    flightTime: 'Unverified — see note',
    frequency: 'Unverified — confirm directly with PIA before booking',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: 'Secondary investigation lead only (not a primary source): PIA UK network reporting across multiple independent Pakistani aviation news outlets, July 2026.',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-13',
      note: 'Current 2026 secondary reporting describes PIA\'s direct Lahore services as ex-Manchester and ex-Heathrow only, with no mention of a Birmingham–Lahore direct service — but no primary source (PIA\'s own site is Cloudflare-blocked; Birmingham Airport\'s own destinations page could not be located) could be reached to confirm this either way. Kept unverified pending a confirmed primary source; check PIA\'s own booking system before assuming Lahore is served direct from Birmingham.',
    },
    intro:
      'Current 2026 route reporting describes PIA\'s direct Lahore services as ex-Manchester and ex-Heathrow only — we can\'t currently confirm a direct Birmingham–Lahore PIA service. Birmingham\'s confirmed PIA direct route is to Islamabad; a connection via there, Manchester, or a Gulf hub is realistic. Check PIA\'s own booking system directly before booking.',
    bookingWindowNote:
      'Confirm the current routing and airline directly before booking — do not assume a direct Birmingham–Lahore option exists. Book 2 to 3 months ahead of Eid or wedding season regardless of routing.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'wedding-season', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-islamabad',
    airportSlug: 'birmingham',
    destinationSlug: 'islamabad',
    flightTime: '7h 50m direct',
    frequency: 'Frequency unconfirmed this check — direct service itself has reasonable support',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: 'Secondary investigation leads only (not primary sources), conflicting: PIA UK network reporting vs. a flight-listing aggregator, July 2026.',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-13',
      note: 'Genuinely conflicting secondary evidence: some current reporting describes Birmingham as a direct PIA point to Islamabad alongside Manchester and Heathrow; one flight-listing aggregator instead showed no current direct service. No primary source (PIA\'s own site is Cloudflare-blocked; Birmingham Airport\'s own destinations page could not be located) could be reached to resolve the conflict. Per the conservative-classification standard, marked unverified pending a direct check of PIA\'s own booking system rather than resolved either way from secondary sources.',
    },
    intro:
      'Birmingham to Islamabad has historically been one of PIA\'s established Midlands routes. Current 2026 reporting is mixed on whether it\'s still operating direct — check PIA\'s own booking system directly for the current routing before assuming a non-stop service.',
    bookingWindowNote:
      'Confirm the current routing directly with PIA before booking. If travelling for Eid, book 2 to 3 months ahead regardless of whether the route is direct or connecting.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
  },
  {
    slug: 'leeds-bradford-amritsar',
    airportSlug: 'leeds-bradford',
    destinationSlug: 'amritsar',
    flightTime: '9h 30m, one stop',
    frequency: 'Daily, connecting via Delhi or the Gulf',
    airlineSlugs: ['air-india', 'etihad-airways'],
    isDirect: false,
    intro:
      'There is no current direct service from Leeds Bradford to Amritsar. The most practical options connect via Delhi with Air India or via Abu Dhabi with Etihad, and Birmingham\'s seasonal direct service is worth weighing against the cost and time of a Leeds Bradford connection.',
    bookingWindowNote:
      'Because this route always involves a connection, total journey time and layover length matter as much as the headline price. A cheaper fare with a long overnight layover isn\'t always the better choice for family travel with children or elderly relatives.',
    peakPeriodIds: ['baisakhi', 'diwali', 'uk-summer-holidays'],
  },
  {
    slug: 'leeds-bradford-islamabad',
    airportSlug: 'leeds-bradford',
    destinationSlug: 'islamabad',
    flightTime: '9h 45m, one stop',
    frequency: 'Daily, connecting via the Gulf',
    airlineSlugs: ['emirates', 'qatar-airways'],
    isDirect: false,
    intro:
      'Leeds Bradford has no current confirmed direct service to Islamabad. Claims of a direct route have circulated periodically, but none have turned into a stable, ongoing schedule. The realistic options are a Gulf-connecting itinerary via Dubai or Doha, or driving to Manchester for PIA\'s direct service.',
    bookingWindowNote:
      'Always compare the total cost and time of a Leeds Bradford Gulf connection against driving to Manchester. For many Bradford-based travellers, Manchester\'s direct PIA service ends up both cheaper and faster once the whole journey is accounted for.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
  },
  {
    slug: 'london-heathrow-mumbai',
    airportSlug: 'london-heathrow',
    destinationSlug: 'mumbai',
    flightTime: '9h direct',
    frequency: 'Air India and Virgin Atlantic each confirmed 2x daily; British Airways confirmed direct, exact daily count not separately confirmed — see note',
    airlineSlugs: ['british-airways', 'air-india', 'virgin-atlantic'],
    isDirect: true,
    airlineVerifications: [
      {
        airlineSlug: 'british-airways',
        status: 'verified',
        sourceName: "British Airways' own \"Direct flights to India\" page (britishairways.com/content/flights/india), stated as \"Last updated: 1 July 2026\"",
        sourceUrl: 'https://www.britishairways.com/content/flights/india',
        verifiedDate: '2026-07-13',
        reviewDueDate: '2026-08-13',
        effectivePeriod: 'Current as of the page\'s own "Last updated: 1 July 2026" stamp',
        supportedClaim: 'Confirms BA flies direct London Heathrow/Gatwick to Mumbai among 5 India destinations. Does NOT confirm a Mumbai-specific frequency — the page states only an aggregate "up to 70 flights from the UK a week" across all 5 cities combined.',
        remainingUncertainty: 'The previously published "3 daily BA" figure came from a 1 Jun 2025 press release and is not reconfirmed by any current source — removed from public copy. Mumbai-specific BA frequency is unconfirmed.',
      },
      {
        airlineSlug: 'air-india',
        status: 'verified',
        sourceName: 'Air India\'s own newsroom press release, "Air India elevates Mumbai-London Heathrow services with brand-new B787-9..." (airindia.com), dated 1 Jul 2026',
        sourceUrl: 'https://www.airindia.com/in/en/newsroom/press-release/Air-India-elevates-Mumbai-London-Heathrow-services-with-brand-new-B787-9-featuring-new-premium-cabins.html',
        verifiedDate: '2026-07-13',
        reviewDueDate: '2026-08-13',
        effectivePeriod: 'Effective 1 Jul 2026 (press release\'s own effective date)',
        supportedClaim: 'Confirms flights AI131/AI130 on the new Boeing 787-9, and explicitly states "Air India\'s second daily service between Mumbai and London Heathrow will continue to be served by its... Boeing 777-300ER" — i.e. two daily Air India flights, both named.',
        remainingUncertainty: 'None significant — this is a dated, current, airline-issued primary source naming both daily flight numbers.',
      },
      {
        airlineSlug: 'virgin-atlantic',
        status: 'verified',
        sourceName: "Virgin Atlantic's own Mumbai destination page (virginatlantic.com/where-we-fly/asia/india/mumbai)",
        sourceUrl: 'https://www.virginatlantic.com/where-we-fly/asia/india/mumbai',
        verifiedDate: '2026-07-13',
        reviewDueDate: '2026-08-13',
        effectivePeriod: 'Current at access',
        supportedClaim: 'States directly: "We fly direct to Mumbai twice a day" — confirms 2x daily Heathrow–Mumbai.',
        remainingUncertainty: 'None significant for the frequency claim itself.',
      },
    ],
    intro:
      'Heathrow to Mumbai has genuine multi-carrier competition. Air India and Virgin Atlantic each confirmed via their own current sources to run twice daily; British Airways also operates the route direct, though its exact daily count isn\'t separately confirmed. Comparing all three rather than booking the first result is consistently worthwhile.',
    bookingWindowNote:
      'Less sensitive to booking window than the Punjab and Pakistan routes. Diwali and the December to January window remain the two periods when fares rise sharply, and February to April and September to October offer the most reliable value.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
  },
  {
    slug: 'manchester-doha',
    airportSlug: 'manchester',
    destinationSlug: 'doha',
    flightTime: '7h 35m direct',
    frequency: 'Daily direct, up to 15x weekly',
    airlineSlugs: ['qatar-airways'],
    isDirect: true,
    intro:
      'Qatar Airways runs one of its busiest European direct services on this route, giving the North of England genuine daily access to Doha without having to travel to London first. It works both as a destination and as a Gulf-connecting gateway onward.',
    bookingWindowNote:
      'High frequency keeps this route comparatively well priced year-round. UK school holidays carry the clearest premium; outside those windows, fares are more stable than on the South Asia routes.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'manchester-jeddah',
    airportSlug: 'manchester',
    destinationSlug: 'jeddah',
    flightTime: '10h, one stop',
    frequency: 'Daily, connecting via Doha',
    airlineSlugs: ['qatar-airways'],
    isDirect: false,
    intro:
      'There is no current direct Manchester to Jeddah service. Qatar Airways\' connecting itinerary via Doha is the most consistent option, using the same daily Manchester to Doha service that operates as a standalone route in its own right.',
    bookingWindowNote:
      'Because the connection runs through Doha on an already high-frequency service, availability is generally good outside Ramadan and the weeks immediately before Hajj season, when both legs see sharp demand spikes.',
    peakPeriodIds: ['ramadan', 'pre-hajj', 'school-half-terms-umrah'],
  },
  {
    slug: 'birmingham-madinah',
    airportSlug: 'birmingham',
    destinationSlug: 'madinah',
    flightTime: '8h 50m, one stop',
    frequency: 'Daily, connecting via Istanbul, Doha or Jeddah',
    airlineSlugs: ['turkish-airlines', 'qatar-airways', 'saudia'],
    isDirect: false,
    intro:
      'Birmingham has no direct Madinah service. Turkish Airlines\' connection via Istanbul is the most frequently used option, though Qatar Airways via Doha and Saudia via Jeddah are both worth comparing, particularly for Umrah itineraries that already include a Jeddah leg.',
    bookingWindowNote:
      'For Umrah travel specifically, compare flying into Jeddah and travelling overland to Madinah against a direct-to-Madinah connection. The total journey time difference is often smaller than expected, and Jeddah routings sometimes price lower.',
    peakPeriodIds: ['ramadan', 'pre-hajj', 'school-half-terms-umrah'],
  },
  {
    slug: 'birmingham-mumbai',
    airportSlug: 'birmingham',
    destinationSlug: 'mumbai',
    flightTime: 'Journey duration varies by connection and has not been independently established.',
    frequency: 'Connecting options exist; exact schedules and frequency have not been independently verified — check directly with the airline or a booking site.',
    // Only the airlines Birmingham Airport's own Mumbai page actually names
    // AND that already exist in data/airlines.ts — the source also lists
    // Air France, KLM, Lufthansa and Swiss, which are omitted here because
    // they have no registry entry, not because the source doesn't name
    // them. See the route-level verification note below: the source names
    // these airlines and separately names hub cities, but never maps any
    // specific airline to any specific hub — no such mapping is asserted
    // anywhere in this route's copy either.
    airlineSlugs: ['air-india', 'emirates', 'qatar-airways', 'saudia', 'turkish-airlines'],
    isDirect: false,
    verification: {
      status: 'verified',
      sourceName: "Birmingham Airport's own official Mumbai destination page (airport.birminghamairport.co.uk)",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/mumbai/',
      verifiedDate: '2026-07-23',
      reviewDueDate: '2026-08-23',
      note: 'This source confirms only that no direct Birmingham–Mumbai flight currently exists ("There are currently no direct flights to Mumbai"), and separately names hub cities (Amsterdam, Delhi, Dubai, Istanbul, Paris) and airlines (Air France, Air India, Emirates, KLM, Lufthansa, Qatar Airways, Turkish Airlines, Saudia, Swiss) it associates with reaching Mumbai from Birmingham. It does not map any specific airline to any specific hub, and does not establish total journey duration, frequency, demand periods, fare behaviour, or self-transfer risk for any named itinerary — none of those are claimed anywhere in this route\'s public copy. Does not by itself change the public "Connecting route" display, which already follows from isDirect: false regardless of this record.',
    },
    intro:
      'Birmingham has no direct service to Mumbai. Birmingham Airport\'s own destination page confirms this, and separately lists Air India, Emirates, Qatar Airways, Saudia and Turkish Airlines among the airlines connecting Birmingham to Mumbai and hub cities including Amsterdam, Delhi, Dubai, Istanbul and Paris — the source does not say which airline uses which hub, so treat any specific routing as unconfirmed and compare options directly before booking.',
    bookingWindowNote:
      'Every itinerary on this route involves at least one connection, so total journey time, layover length, baggage-transfer conditions and ticket flexibility matter as much as the headline fare. Compare these details directly with the airline or a booking site — this route does not currently have an independently verified duration, frequency or fare pattern to base timing advice on.',
    peakPeriodIds: [],
  },
  {
    slug: 'glasgow-dubai',
    airportSlug: 'glasgow',
    destinationSlug: 'dubai',
    flightTime: '7h 25m direct',
    frequency: 'Daily direct',
    airlineSlugs: ['emirates'],
    isDirect: true,
    intro:
      'Emirates\' daily Glasgow to Dubai service is Scotland\'s longest-established direct long-haul route, giving the West of Scotland genuine non-stop access to the Gulf without travelling south first.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. UK school holidays and the winter months carry the clearest premium; outside those, fares are comparatively stable year-round.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'edinburgh-dubai',
    airportSlug: 'edinburgh',
    destinationSlug: 'dubai',
    flightTime: '8h 10m direct',
    frequency: 'Daily direct',
    airlineSlugs: ['emirates'],
    isDirect: true,
    intro:
      'Emirates resumed a daily direct Edinburgh to Dubai service after a four-year gap, giving Scotland\'s capital a long-haul gateway independent of Glasgow. Both cities now run daily Emirates services, so it\'s genuinely worth comparing departure times across the two.',
    bookingWindowNote:
      'As one of two daily Scotland to Dubai options, fares here are comparatively stable outside UK school holidays. Worth comparing against the Glasgow service on the same dates before booking, since pricing can differ between the two.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'newcastle-dubai',
    airportSlug: 'newcastle',
    destinationSlug: 'dubai',
    flightTime: '7h 50m direct',
    frequency: 'Daily direct',
    airlineSlugs: ['emirates'],
    isDirect: true,
    intro:
      'Emirates\' daily Newcastle to Dubai service gives the North East genuine long-haul access to the Gulf without the drive to Manchester, and it doubles as a connecting gateway onward to South Asia.',
    bookingWindowNote:
      'Comparatively stable pricing outside UK school holidays. For onward South Asia connections via Dubai, book the connecting leg as part of the same itinerary rather than as separate tickets, to protect against missed-connection risk.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'london-gatwick-ahmedabad',
    airportSlug: 'london-gatwick',
    destinationSlug: 'ahmedabad',
    flightTime: '9h 40m direct',
    frequency: '3x weekly direct',
    airlineSlugs: ['air-india'],
    isDirect: true,
    intro:
      'Air India\'s non-stop Gatwick to Ahmedabad service is the only direct UK route into Gujarat, launched specifically to serve the UK\'s large Gujarati community without requiring a Delhi or Mumbai connection. It runs 3 times a week, not daily.',
    bookingWindowNote:
      'Because this is a reduced-frequency route rather than a daily one, confirm your travel dates align with an active flight day before booking. Navratri and Diwali both see sharp demand spikes on this specific service, more so than on the higher-frequency Delhi or Mumbai routes.',
    peakPeriodIds: ['navratri', 'diwali', 'uk-summer-holidays'],
  },
  {
    slug: 'london-gatwick-amritsar',
    airportSlug: 'london-gatwick',
    destinationSlug: 'amritsar',
    flightTime: '9h 10m direct',
    frequency: '3x weekly direct',
    airlineSlugs: ['air-india'],
    isDirect: true,
    intro:
      'Alongside Birmingham, Air India also runs a direct Gatwick to Amritsar service. It\'s worth comparing against the Birmingham route on whichever specific dates and times suit your trip, since the two don\'t always fly on the same days of the week.',
    bookingWindowNote:
      'Like the Birmingham service, this runs 3 times a week rather than daily. Confirm the specific flight day before booking, and compare both Gatwick and Birmingham schedules for your travel dates rather than assuming either is guaranteed to fly on your preferred day.',
    peakPeriodIds: ['baisakhi', 'diwali', 'uk-summer-holidays'],
  },
  {
    slug: 'manchester-delhi',
    airportSlug: 'manchester',
    destinationSlug: 'delhi',
    flightTime: '9h 30m direct (currently)',
    frequency: '3x weekly direct (reduced from 5x weekly in Feb 2026)',
    airlineSlugs: ['indigo'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "IndiGo official press release: \"IndiGo Adjusts Wide-body Network to Enhance Operational Resilience and Schedule Reliability\" (4 Feb 2026)",
      sourceUrl: 'https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html',
      verifiedDate: '2026-07-23',
      reviewDueDate: '2026-08-31',
      note: 'Primary-sourced directly from IndiGo\'s own press office. This release describes the reduced post-cut schedule (Delhi–Manchester 6E0033/6E0034, Mon/Thu/Sun and Mon/Wed/Thu, effective from 7 and 19 Feb 2026) — it supports the current-schedule claim only. IndiGo\'s separate 2 June 2026 announcement discontinuing Manchester service from 31 August 2026 is a different claim, tracked as its own sourced event in data/route-status-events.ts (Route Status ledger) rather than duplicated or blended into this record.',
    },
    // Truth Reset (final audit): this prose must never duplicate the
    // ledger's own current-change claim — a cancellation or reschedule
    // recorded in data/route-status-events.ts must not leave this text
    // stating a stale date/announcement. The Route Status panel (driven by
    // getRouteStatus()/getRouteStatusCopy()) is the only place the current
    // change is asserted; this intro keeps only the independently verified
    // historical facts and points readers to that panel for current status.
    intro:
      'IndiGo launched the first non-stop Manchester to Delhi service in 25 years in November 2025, flying a two-class Boeing 787-9 leased from Norse Atlantic Airways. It\'s currently the only airline flying this route direct. IndiGo cut frequency from 5x to 3x weekly in February 2026 citing airspace-related operational strain. See the Route Status panel below for the latest verified service status.',
    bookingWindowNote:
      'Diwali and the December to January window are the two periods when fares rise sharply on this route. This is a single-airline direct service, so it\'s worth comparing against the well-established one-stop Gulf-carrier options on price and schedule regardless of season.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    connectingAlternative: {
      typicalStops: 1,
      hubAirports: ['Dubai', 'Doha', 'Abu Dhabi', 'Istanbul'],
      typicalAirlines: ['Emirates', 'Qatar Airways', 'Etihad Airways', 'Turkish Airlines', 'British Airways'],
      typicalJourneyTime: '12 to 15h total, depending on layover length',
    },
  },
  {
    slug: 'manchester-mumbai',
    airportSlug: 'manchester',
    destinationSlug: 'mumbai',
    flightTime: '9h 45m direct (currently)',
    frequency: '4x weekly direct (Mon/Tue/Sat/Sun ex-Manchester, per Feb 2026 schedule)',
    airlineSlugs: ['indigo'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "IndiGo official press release: \"IndiGo Adjusts Wide-body Network to Enhance Operational Resilience and Schedule Reliability\" (4 Feb 2026)",
      sourceUrl: 'https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html',
      verifiedDate: '2026-07-23',
      reviewDueDate: '2026-08-31',
      note: 'Primary-sourced directly from IndiGo\'s own press office. This release describes the reduced post-cut schedule (Mumbai–Manchester 6E0031/6E0032, departing Manchester Mon/Tue/Sat/Sun) — it supports the current-schedule claim only. IndiGo\'s separate 2 June 2026 announcement discontinuing Manchester service from 31 August 2026 is a different claim, tracked as its own sourced event in data/route-status-events.ts (Route Status ledger) rather than duplicated or blended into this record.',
    },
    // Truth Reset (final audit): see manchester-delhi's identical comment
    // above — this prose keeps only independently verified historical
    // facts; the Route Status panel is the sole owner of the current
    // change, so a cancellation or reschedule in the ledger never leaves a
    // stale date/announcement stranded here.
    intro:
      'IndiGo\'s Mumbai to Manchester service, launched in July 2025, was the airline\'s first ever long-haul route and remains the only non-stop link between Manchester and India\'s financial capital. As with the Delhi route, it\'s a single-airline direct service rather than a long-established one. See the Route Status panel below for the latest verified service status.',
    bookingWindowNote:
      'Diwali and the December to January window are the two periods when fares rise sharply on this route. The well-established one-stop Gulf-carrier options below run far more frequently and are worth comparing on price and convenience regardless of season, since this is a single-airline direct service.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    connectingAlternative: {
      typicalStops: 1,
      hubAirports: ['Dubai', 'Doha', 'Abu Dhabi'],
      typicalAirlines: ['Emirates', 'Qatar Airways', 'Etihad Airways', 'British Airways'],
      typicalJourneyTime: '12 to 14h total, depending on layover length',
    },
  },
  {
    slug: 'manchester-amritsar',
    airportSlug: 'manchester',
    destinationSlug: 'amritsar',
    flightTime: '13h 20m, usually 1 stop',
    frequency: 'Multiple daily 1-stop options, no direct service',
    airlineSlugs: ['qatar-airways', 'indigo', 'british-airways', 'air-india'],
    isDirect: false,
    intro:
      'There is no direct Manchester to Amritsar service. Qatar Airways\' one-stop routing via Doha is the most consistently quoted fastest option, at around 13h 20m total, though other one-stop combinations via Delhi or London add meaningfully to journey time. Birmingham and Gatwick both have genuine direct Amritsar services, worth comparing against a Manchester connection if either is within reasonable travelling distance.',
    bookingWindowNote:
      'Because every option here involves a connection, total journey time and layover length matter as much as the headline price. Compare the Doha one-stop against driving to Birmingham or Gatwick for their direct services, particularly for family travel with young children or elderly relatives.',
    peakPeriodIds: ['baisakhi', 'diwali', 'uk-summer-holidays'],
    connectingAlternative: {
      typicalStops: 1,
      hubAirports: ['Doha', 'Delhi', 'London Heathrow'],
      typicalAirlines: ['Qatar Airways', 'IndiGo', 'British Airways'],
      typicalJourneyTime: '13 to 15h total, depending on the connection',
    },
  },
  {
    slug: 'manchester-ahmedabad',
    airportSlug: 'manchester',
    destinationSlug: 'ahmedabad',
    flightTime: 'Around 13h, usually 1 stop',
    frequency: 'Multiple daily 1-stop options, no direct service',
    airlineSlugs: ['qatar-airways', 'etihad-airways', 'emirates'],
    isDirect: false,
    intro:
      'There is no direct Manchester to Ahmedabad service. Doha is the most commonly used one-stop connection, chosen on the large majority of one-stop itineraries booked on this route, with Abu Dhabi and Dubai as the other realistic Gulf-hub alternatives. London Gatwick has the UK\'s only direct service to Ahmedabad, worth comparing against a Manchester connection for Gujarati heritage travellers based in the North West.',
    bookingWindowNote:
      'Compare a Gulf one-stop departing Manchester against the cost and time of travelling to Gatwick for Air India\'s direct service. For some North West travellers the direct Gatwick option works out better overall once the whole journey is accounted for, particularly around Navratri and Diwali when both routes see sharp demand spikes.',
    peakPeriodIds: ['navratri', 'diwali', 'uk-summer-holidays'],
    connectingAlternative: {
      typicalStops: 1,
      hubAirports: ['Doha', 'Abu Dhabi', 'Dubai'],
      typicalAirlines: ['Qatar Airways', 'Etihad Airways', 'Emirates'],
      typicalJourneyTime: '13 to 16h total, depending on the connection',
    },
  },
  {
    slug: 'manchester-madinah',
    airportSlug: 'manchester',
    destinationSlug: 'madinah',
    flightTime: '9h 15m, usually 1 stop',
    frequency: 'Multiple daily 1-stop options, no current direct service',
    airlineSlugs: ['turkish-airlines', 'saudia', 'egyptair', 'royal-jordanian'],
    isDirect: false,
    intro:
      'Manchester once had a direct Saudia service to Madinah, but it doesn\'t currently operate. Turkish Airlines\' one-stop routing via Istanbul is now the fastest realistic option, at around 9h 15m total. EgyptAir via Cairo and Royal Jordanian via Amman are the other commonly used alternatives.',
    bookingWindowNote:
      'For Umrah travel specifically, compare flying into Jeddah and travelling overland to Madinah against a direct-to-Madinah connection. Manchester\'s Jeddah service runs through the same Doha-based connection pattern as the wider network, and the total journey time difference is often smaller than expected.',
    peakPeriodIds: ['ramadan', 'pre-hajj', 'school-half-terms-umrah'],
    connectingAlternative: {
      typicalStops: 1,
      hubAirports: ['Istanbul', 'Cairo', 'Amman'],
      typicalAirlines: ['Turkish Airlines', 'EgyptAir', 'Royal Jordanian'],
      typicalJourneyTime: '9 to 11h total, depending on the connection',
    },
  },
];

export function getRouteBySlug(slug: string) {
  return routes.find((r) => r.slug === slug);
}

const routesByAirportAndDestination = new Map(routes.map((r) => [`${r.airportSlug}|${r.destinationSlug}`, r]));

export function getRouteByAirportAndDestination(airportSlug: string, destinationSlug: string) {
  return routesByAirportAndDestination.get(`${airportSlug}|${destinationSlug}`);
}

export function getRoutesByAirport(airportSlug: string) {
  return routes.filter((r) => r.airportSlug === airportSlug);
}

export function getRoutesByDestination(destinationSlug: string) {
  return routes.filter((r) => r.destinationSlug === destinationSlug);
}

export function getRouteAirport(route: Route) {
  return airports.find((a) => a.slug === route.airportSlug);
}

export function getRouteDestination(route: Route) {
  return destinations.find((d) => d.slug === route.destinationSlug);
}

export function getRoutePeakPeriods(route: Route) {
  return getPeakPeriodsByIds(route.peakPeriodIds);
}

export type DisplayDirectness = 'direct' | 'connecting' | 'unverified';

export function isVerificationCurrent(v: { status: RouteVerificationStatus; reviewDueDate: string } | undefined, nowIso: string): boolean {
  if (!v) return false;
  if (v.status !== 'verified') return false;
  if (v.reviewDueDate < nowIso) return false;
  return true;
}

/** Look up one airline's own verification record on a route, if one was recorded. */
export function getAirlineVerification(route: Route, airlineSlug: string): AirlineVerification | undefined {
  return route.airlineVerifications?.find((v) => v.airlineSlug === airlineSlug);
}

/**
 * Per-airline display gate (founder correction, Truth Reset continuation) —
 * a route-level `verification` proves the route itself is direct, never
 * that every airline in `airlineSlugs` is individually confirmed. This
 * returns 'verified' only when THAT SPECIFIC airline has its own current,
 * 'verified' record — never because a different airline on the same route
 * was verified, and never because the route overall shows "Direct".
 */
export function getAirlineDisplayStatus(route: Route, airlineSlug: string, nowIso: string): 'verified' | 'unverified' {
  return isVerificationCurrent(getAirlineVerification(route, airlineSlug), nowIso) ? 'verified' : 'unverified';
}

/**
 * Deal-card airline attribution gate (founder correction, final Truth Reset
 * pass) — a narrower sibling of getAirlineDisplayStatus() for the one case
 * that function deliberately never covers on its own: a route with exactly
 * one airline in `airlineSlugs` and no separate `airlineVerifications`
 * array, where the route-level `verification` record's own evidence is
 * inherently about that single airline (e.g. Manchester–Lahore's route-level
 * source is literally "PIA runs direct Manchester to Lahore services" — the
 * airline is embedded in the only evidence that exists, just never
 * duplicated into an `airlineVerifications` entry). This fallback is
 * deliberately narrow: a route with more than one airline in `airlineSlugs`
 * NEVER falls back to route-level verification here, even if it happens to
 * have one, because that would risk exactly the mistake this whole model
 * exists to prevent — one airline's evidence silently verifying another. If
 * `route.airlineVerifications` exists at all (meaning airlines were
 * deliberately split), no fallback applies even for a single matching
 * airline, since the split itself signals the evidence needs airline-level
 * precision.
 */
export function getDealAirlineDisplayStatus(route: Route, airlineSlug: string, nowIso: string): 'verified' | 'unverified' {
  if (isVerificationCurrent(getAirlineVerification(route, airlineSlug), nowIso)) return 'verified';
  const isSoleUnsplitAirline =
    !route.airlineVerifications && route.airlineSlugs.length === 1 && route.airlineSlugs[0] === airlineSlug;
  if (isSoleUnsplitAirline && isVerificationCurrent(route.verification, nowIso)) return 'verified';
  return 'unverified';
}

/**
 * The single gate every public "Direct route" badge must go through
 * (Truth Reset, July 2026) — never render `route.isDirect` directly.
 * Returns 'direct' when either the route-level record is fresh and
 * 'verified', OR at least one airline on the route has its own fresh,
 * 'verified' record supporting a direct operation (founder correction:
 * "a route may display Direct only when at least one current airline claim
 * supports a direct operation" — this is the same requirement, expressed
 * either at route level for single-operator routes or per-airline for
 * multi-operator ones). Returns 'connecting' only for routes that were
 * never claimed direct (`isDirect: false`) — this codebase's standing rule
 * is that a route under genuine dispute stays `isDirect: true` with an
 * 'unverified' record rather than being flipped to `isDirect: false`, so
 * 'connecting' here always reflects a recorded, uncontested shape decision,
 * not a guess. 'unverified' covers everything else: a missing record, a
 * non-'verified' status, or an expired `reviewDueDate` — never silently
 * back to 'direct', and never conflated with 'connecting' either.
 */
export function getDisplayDirectness(route: Route, nowIso: string): DisplayDirectness {
  if (!route.isDirect) return 'connecting';
  const routeLevelCurrent = isVerificationCurrent(route.verification, nowIso);
  const anyAirlineCurrent = (route.airlineVerifications ?? []).some((v) => isVerificationCurrent(v, nowIso));
  return routeLevelCurrent || anyAirlineCurrent ? 'direct' : 'unverified';
}

/**
 * Alias for getDealAirlineDisplayStatus() (below) used from non-deal route
 * surfaces (the route page's own Airlines stat, getRoutePresentation()).
 * Same exact gate, no duplicated logic — deal cards were simply the first
 * surface this was built for, but "is this specific airline individually
 * confirmed on this specific route, with the sole-unsplit-airline fallback
 * for a single uncontested operator" is the same question regardless of
 * which surface is asking.
 */
export function getRouteAirlineDisplayStatus(route: Route, airlineSlug: string, nowIso: string): 'verified' | 'unverified' {
  return getDealAirlineDisplayStatus(route, airlineSlug, nowIso);
}

/**
 * Deliberately no "facts confidence" or "evidence" concept lives here.
 * getDisplayDirectness() returning 'connecting' for an `isDirect: false`
 * route is correct for the public "Connecting route" badge (Truth Reset: a
 * connecting route is a recorded, uncontested SHAPE decision, not a guess)
 * — but it does not mean the route's specific duration, frequency, or named
 * airline were independently verified, and even a 'direct' route's own
 * `verification` record does not mean *every* field is confirmed (see
 * AirlineVerification's doc comment for the airline case; the same applies
 * to frequency — several 'direct' routes' own `frequency` string explicitly
 * says the current frequency isn't confirmed by an official schedule, e.g.
 * manchester-lahore). An earlier version of this file exposed a
 * `factsConfidence: 'verified' | 'editorial-estimate'` field that collapsed
 * all of that into one label per route and called a 'direct' route's whole
 * fact bundle "verified" — which was false, and unused by any UI besides.
 * It was removed rather than renamed, since no currently-accurate single
 * label covers "direct service is evidenced, frequency may not be, airline
 * attribution is handled separately" — see getRouteAirlineDisplayStatus for
 * the one sub-claim (airline attribution) that already has its own honest,
 * per-field gate. A future connecting-route claim (e.g. Birmingham–Mumbai)
 * should be evidenced and gated field-by-field the same way, not through a
 * single bundled confidence flag.
 */
function pendingRouteCopy(airportCity: string | undefined, destCity: string | undefined) {
  const pair = airportCity && destCity ? `${airportCity} to ${destCity}` : 'This route';
  return {
    summary: `We don't currently have confirmed service details for ${pair} — the operating airline, schedule and duration are still being checked. Confirm directly with airlines serving ${airportCity ?? 'this departure airport'} before booking, or compare other routes below.`,
    metadataDescription: `${pair}: route details are currently being verified. Check the latest options directly before booking.`,
    shareText: `${pair}: route verification in progress — check the latest options directly.`,
  };
}

/**
 * Longest a social/OG detail line is allowed to be before falling back to a
 * short generic label instead. Not every route's own `flightTime` is safe
 * to render on a 1200×630 image at a glance-readable size — several honest
 * hedged fields (and, most sharply, a route like Birmingham–Mumbai whose
 * `flightTime` is itself a full disclaimer sentence, not a duration) run
 * well past what fits on one line with no wrapping. This is a general,
 * per-route check, not a special case for any one slug.
 */
const MAX_SOCIAL_DETAIL_LENGTH = 50;

/**
 * A concise, centrally-derived line for metadata/OG surfaces — deliberately
 * separate from the full `flightTime`/`frequency` fields used on the route
 * page itself, which are allowed to be as long and as hedged as the truth
 * requires. `frequency` in particular is excluded here entirely: several
 * routes' frequency strings carry a full confirmation caveat (e.g.
 * manchester-islamabad's is well over 100 characters) that reads fine as
 * page copy but was never designed to fit a social-image line, direct or
 * connecting. Never invents a duration, schedule, or airline fact — the
 * fallback labels name only the route's status, nothing more specific.
 */
function buildSocialDetail(status: 'direct' | 'connecting', flightTime: string, statusLabel: string): string {
  if (flightTime.length <= MAX_SOCIAL_DETAIL_LENGTH) return flightTime;
  return status === 'direct' ? `${statusLabel} — see route guide for details` : 'Connecting — compare options before booking';
}

/**
 * Strips the redundant word "direct" from a direct route's flightTime
 * before it's folded into share text — the sentence around it ("has a
 * direct option") already establishes directness, so keeping it produced
 * "direct option (9h 45m direct (currently))". Any parenthetical qualifier
 * (a hedge like "(currently)", or an attribution like "(per BA's own
 * destination page)") is preserved verbatim. A no-op for any flightTime
 * that doesn't contain the word, so this never mangles a value it wasn't
 * written to expect.
 */
function cleanDirectDurationFragment(flightTime: string): string {
  return flightTime.replace(/\bdirect\b\s*/, '').replace(/\s+/g, ' ').trim();
}

/**
 * Share text must stay concise and avoid unsupported facts — never the raw
 * frequency/bookingWindowNote (long, hedged prose that also caused doubled
 * punctuation), and flightTime only when short enough to read as a clean
 * fragment. The duration fragment is joined with an em dash rather than
 * wrapped in its own parentheses — flightTime can already carry a
 * parenthetical qualifier, and nesting one pair inside another read badly
 * (see cleanDirectDurationFragment).
 */
function buildShareText(status: 'direct' | 'connecting', pair: string, flightTime: string): string {
  if (status === 'connecting') {
    return `${pair} is a connecting route — no confirmed direct service currently exists. Compare total journey time, schedules and ticket conditions before booking.`;
  }
  const cleaned = flightTime.length <= MAX_SOCIAL_DETAIL_LENGTH ? cleanDirectDurationFragment(flightTime) : '';
  const durationFragment = cleaned ? ` — ${cleaned}` : '';
  return `${pair} has a direct option${durationFragment}. Compare current prices, confirm the exact schedule and check ticket conditions before booking.`;
}

interface RoutePresentationBase {
  /** The one canonical short label for this status — 'Direct', 'Connecting', or 'Verification pending'. Every surface should use this instead of re-deriving its own ternary. */
  statusLabel: string;
  /**
   * Airline slugs safe to name as an operator on this route right now.
   * - 'unverified' (pending) routes: always empty — nothing can be
   *   attributed to a service that isn't itself confirmed to exist.
   * - 'direct' routes: only individually-verified airlines (via
   *   getRouteAirlineDisplayStatus, including its sole-unsplit-airline
   *   fallback) — a route showing "Direct" never implies every named
   *   airline is confirmed (see AirlineVerification's doc comment).
   * - 'connecting' routes: every listed airline, unfiltered — this
   *   dataset's existing, accepted convention treats a connecting route's
   *   airline list as researched informational content, not an individual
   *   confirmed-operator claim. Unchanged by this fix.
   */
  airlineSlugs: string[];
  /** Safe hero/summary copy: route.intro for direct/connecting routes (unchanged, already hand-authored honestly), or centrally-authored neutral copy for pending routes that never depends on an intro string being hedged correctly. */
  summary: string;
  /** Safe <meta description>: the existing route.intro-derived summary for direct/connecting, or a short claim-free sentence for pending. */
  metadataDescription: string;
  /**
   * Safe <title>: content-aware, not a fixed template. "Booking Windows &
   * Peak Periods" is only used when the route actually has peak-period
   * content (route.peakPeriodIds is non-empty) — a route like
   * Birmingham–Mumbai, with no peak-period data, gets a truthful generic
   * title instead. Checked generically per-route, not special-cased to any
   * one slug, so any future sparse route gets the same treatment.
   */
  metadataTitle: string;
  /** Safe WhatsApp/share message body (URL is appended separately by the share component). Omits booking-window, demand, fare-urgency, airline and routing claims entirely when pending. */
  shareText: string;
  /** Concise line for the Open Graph/social image — see buildSocialDetail's doc comment. Never the full flightTime+frequency pairing (frequency alone can run past 100 characters on some routes), and never longer than fits a single image line. */
  socialDetail: string;
  /** Concise, universally-truthful footer line for the Open Graph/social image. Never advertises a specific section (e.g. "Peak periods", "Fare history") that may not exist for this route. */
  socialFooter: string;
}

/**
 * Discriminated on `status` so every consumer gets real compile-time
 * narrowing — inside `status !== 'unverified'`, TypeScript already knows
 * flightTime/frequency are `string`, not `string | null`, with no non-null
 * assertions needed anywhere. This is deliberate: a route fact leak is
 * exactly the kind of mistake a type system should catch, not just a
 * runtime convention.
 */
export type RoutePresentation =
  | (RoutePresentationBase & {
      status: 'unverified';
      flightTime: null;
      frequency: null;
      /**
       * False exactly when status is 'unverified' (pending). This means
       * "not blocked by pending status" — it is a pending-suppression flag,
       * not a claim that the booking-window content itself (for a
       * 'connecting' route in particular) has been independently verified.
       * route.bookingWindowNote / logged booking-window records are a
       * route-specific factual claim about when to book *this* service,
       * which cannot be safely shown at all for a route that isn't itself
       * confirmed to exist.
       */
      canShowBookingGuidance: false;
      /** Same "not pending" meaning as canShowBookingGuidance, applied to peak-period guidance — false only because the route itself isn't evidenced to exist, not a statement about how well-evidenced the peak-period content is otherwise. */
      canShowPeakPeriods: false;
      /** Same "not pending" meaning as canShowBookingGuidance — false for pending routes because route.connectingAlternative (stops, hubs, journey time, airlines) must never render for a route whose own service isn't evidenced, regardless of what data happens to be recorded on it. */
      canShowConnectingAlternative: false;
    })
  | (RoutePresentationBase & {
      status: 'direct' | 'connecting';
      flightTime: string;
      frequency: string;
      /**
       * True whenever status is not 'unverified' — i.e. this route is
       * allowed to show booking-window guidance because it is not in the
       * verification-pending state, NOT because the guidance content
       * itself has been independently verified. For a 'connecting' route
       * in particular, this content has always been researched editorial
       * copy (see route.bookingWindowNote's own doc comment), never
       * source-verified fact-by-fact — that is unchanged by this flag and
       * unchanged by this fix. Only the pending case is newly suppressed.
       */
      canShowBookingGuidance: true;
      /** Same "not pending" meaning as canShowBookingGuidance, applied to peak-period guidance. */
      canShowPeakPeriods: true;
      /** Same "not pending" meaning as canShowBookingGuidance, applied to route.connectingAlternative. */
      canShowConnectingAlternative: true;
    })
  | (RoutePresentationBase & {
      /**
       * A previously-verified direct service that a fresh, verified Route
       * Status ledger event proves has actually ended (never a status a
       * route reaches merely because an announcement's effective date
       * passed — see getRouteStatus()'s 'transition-boundary' handling,
       * which stays 'unverified' instead). Distinct from 'unverified': the
       * customer-facing label and copy must say "ended", never
       * "Verification pending" or "still being checked" — see the Route
       * Status V1 final errata §3.
       */
      status: 'service-ended';
      flightTime: null;
      frequency: null;
      /**
       * Deliberately false, same as 'unverified' — a route whose direct
       * service has ended must never show booking-window, peak-period or
       * connecting-alternative content as if the route were still live.
       * canShowConnectingAlternative in particular stays false here even
       * though route.connectingAlternative data may exist on the record:
       * "the direct service ended" and "a connecting journey exists" are
       * separate facts requiring separate evidence — this ledger event
       * proves only the former. See the Route Status V1 implementation
       * addendum §4.
       */
      canShowBookingGuidance: false;
      canShowPeakPeriods: false;
      canShowConnectingAlternative: false;
    });

/**
 * The 'unverified' (pending) branch of RoutePresentation, extracted so the
 * Route Status V1 adapter (getEffectiveRoutePresentation, in
 * lib/route-status-copy.ts) can render this exact safe shape unconditionally
 * for a ledger-managed route in 'verification-pending' — never by first
 * checking the legacy, inclusive getDisplayDirectness() gate, which can
 * still read 'direct' at the same nowIso a strict ledger check reads
 * 'pending' (see isCurrentClaimValid's doc comment on why it's deliberately
 * stricter). getRoutePresentation() itself still calls this for its own
 * non-ledger 'unverified' case below.
 */
export function buildUnverifiedPresentation(route: Route): RoutePresentation {
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const pair = airport && dest ? `${airport.city} to ${dest.city}` : 'This route';
  const copy = pendingRouteCopy(airport?.city, dest?.city);
  const statusLabel = 'Verification pending';
  return {
    status: 'unverified',
    statusLabel,
    flightTime: null,
    frequency: null,
    airlineSlugs: [],
    summary: copy.summary,
    metadataDescription: copy.metadataDescription,
    metadataTitle: `${pair}: Route Verification in Progress`,
    shareText: copy.shareText,
    socialDetail: statusLabel,
    socialFooter: 'Route verification in progress · jetstash.co.uk',
    canShowBookingGuidance: false,
    canShowPeakPeriods: false,
    canShowConnectingAlternative: false,
  };
}

/**
 * The 'service-ended' branch — a fresh, verified Route Status ledger event
 * proves a previously-verified direct service has actually ended. Every
 * former direct-service fact (duration, frequency, airline-as-current) is
 * suppressed, and canShowConnectingAlternative stays false: this event
 * proves only that the direct service ended, never that any connecting
 * service currently operates — see the Route Status V1 implementation
 * addendum §4 ("direct service ended" and "a connecting journey exists"
 * are separate facts requiring separate evidence).
 */
export function buildServiceEndedPresentation(route: Route): RoutePresentation {
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const pair = airport && dest ? `${airport.city} to ${dest.city}` : 'This route';
  const statusLabel = 'Direct service ended';
  return {
    status: 'service-ended',
    statusLabel,
    flightTime: null,
    frequency: null,
    airlineSlugs: [],
    summary: `The direct service on ${pair} that was previously verified has ended. Check current options directly with airlines before booking.`,
    metadataDescription: `${pair}: the previously verified direct service has ended. Check current options before booking.`,
    metadataTitle: `${pair}: Route Guide`,
    shareText: `${pair}'s previously verified direct service has ended. Check current options directly with airlines before booking.`,
    socialDetail: statusLabel,
    socialFooter: 'Route status updated · jetstash.co.uk',
    canShowBookingGuidance: false,
    canShowPeakPeriods: false,
    canShowConnectingAlternative: false,
  };
}

/**
 * The single reusable source of truth for everything a customer-facing
 * surface renders about a route: not just duration/frequency/airline, but
 * hero copy, metadata, share text, and whether booking-guidance/peak-period/
 * connecting-alternative sections may render at all. Every surface that
 * would otherwise read route.intro, route.flightTime, route.frequency,
 * route.airlineSlugs, route.bookingWindowNote, route.peakPeriodIds, or
 * route.connectingAlternative directly should go through this instead — or,
 * for a route that may be ledger-managed, through
 * getEffectiveRoutePresentation() in lib/route-status-copy.ts, which wraps
 * this function.
 *
 * Pending ('unverified') routes get their own branch entirely — they are
 * never treated as a variant of 'connecting'. Nothing here depends on a
 * route's author remembering to hedge free-text copy: the pending branch's
 * summary/metadataDescription/shareText are generated centrally from the
 * airport/destination names only, so a brand-new pending route is safe by
 * construction the moment isDirect/verification make it 'unverified'.
 */
export function getRoutePresentation(route: Route, nowIso: string): RoutePresentation {
  const status = getDisplayDirectness(route, nowIso);
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const pair = airport && dest ? `${airport.city} to ${dest.city}` : 'This route';

  if (status === 'unverified') {
    return buildUnverifiedPresentation(route);
  }

  const statusLabel = status === 'direct' ? 'Direct' : 'Connecting';
  const airlineSlugs =
    status === 'direct'
      ? route.airlineSlugs.filter((slug) => getRouteAirlineDisplayStatus(route, slug, nowIso) === 'verified')
      : route.airlineSlugs;

  // Content-aware title: "Booking Windows & Peak Periods" is only truthful
  // when the route actually has peak-period data behind it. Checked against
  // route.peakPeriodIds generically, not special-cased to Birmingham–Mumbai
  // — any future route with no peak-period content gets the same fallback.
  const hasPeakPeriodContent = route.peakPeriodIds.length > 0;
  const metadataTitle = hasPeakPeriodContent
    ? `${pair} Flights: Booking Windows & Peak Periods`
    : `${pair} Flights: ${status === 'direct' ? 'Route Guide' : 'Connection Guide'}`;

  return {
    status,
    statusLabel,
    flightTime: route.flightTime,
    frequency: route.frequency,
    airlineSlugs,
    summary: route.intro,
    metadataDescription: `${route.intro.slice(0, 150)}...`,
    metadataTitle,
    shareText: buildShareText(status, pair, route.flightTime),
    socialDetail: buildSocialDetail(status, route.flightTime, statusLabel),
    socialFooter: 'Travel intelligence · jetstash.co.uk',
    canShowBookingGuidance: true,
    canShowPeakPeriods: true,
    canShowConnectingAlternative: true,
  };
}

// ── Route Status V1 (Phase 1 derivation + Phase 2 view-model contract) ──

/**
 * The only four labels a ledger-managed route can carry in V1. No
 * 'connecting' — neither isDirect:false nor connectingAlternative may
 * prove a current connecting service operates, and there is no separately
 * sourced current-connecting-service model yet. A route with zero ledger
 * events is simply not managed by Route Status at all — see
 * getRouteStatus()'s null return.
 */
export type RouteStatusLabel = 'verified-direct' | 'withdrawal-announced' | 'service-ended' | 'verification-pending';

/**
 * One piece of evidence backing a 'verified-direct' result — either the
 * route-level `verification` record, or one airline's own
 * `AirlineVerification` entry. Deliberately NOT a RouteStatusEvent: a
 * verified-direct claim's evidence is the existing route/airline
 * verification model (data/routes.ts), not the withdrawal/lifecycle ledger.
 */
export interface VerifiedDirectBasis {
  kind: 'route' | 'airline';
  /** Present only when kind === 'airline'. */
  airlineSlug?: string;
  sourceName: string;
  sourceUrl?: string;
  verifiedDate: string;
  reviewDueDate: string;
}

/**
 * A structural fact only — no baked-in customer-facing copy. Attached to
 * the route's overall 'verified-direct' result when one airline's service
 * is withdrawing, ended, or has reached its announced change date without
 * reverification, but another airline's own current, explicit verification
 * proves the route still operates direct. `drivingEventId` lets the copy
 * layer (lib/route-status-copy.ts) resolve and validate the exact ledger
 * event behind the notice rather than trusting the label alone.
 */
export interface ServiceLevelNotice {
  airlineSlug: string;
  kind: 'withdrawal-announced' | 'service-ended' | 'status-reverification-pending';
  effectiveFrom: string;
  drivingEventId: string;
}

/**
 * Every reason a route can land in 'verification-pending', fully
 * enumerated so no pending result can leave a caller guessing why. Every
 * `verification-pending` RouteStatusResult below sets exactly one of
 * these — see the Route Status V1 final errata §2.
 *
 * `transition-boundary-reached` carries the driving event's id, its scope,
 * and the effective date reached — this is the one pending reason that is
 * itself a sourced claim ("a publisher's announced date has passed") and
 * so is the only one the copy layer may attach a citation to (see
 * RouteStatusViewModel's 'transition-boundary-pending' variant in
 * lib/route-status-copy.ts). Every other reason is deliberately evidence-
 * free: there is nothing to cite for "no current evidence" or an internal
 * data contradiction, so none is ever exposed to a customer.
 */
export type PendingReason =
  | { kind: 'transition-boundary-reached'; drivingEventId: string; effectiveFrom: string; scope: RouteStatusScope }
  | { kind: 'no-current-direct-evidence' }
  | {
      kind: 'conflicting-ledger-evidence';
      /** Internal diagnostic only — tests and founder ops. Never surfaced in customer copy. */
      diagnostic:
        | 'duplicate-ended-claims'
        | 'lifecycle-ordering-ambiguous'
        | 'inconsistent-active-service-scope'
        | 'multiple-active-route-services'
        | 'multiple-active-airline-services'
        | 'mixed-active-route-and-airline-services';
    };

/**
 * Discriminated on `status` so every field a given result needs is
 * enforced at compile time — a 'verified-direct' result can never be
 * constructed with an empty evidence basis (NonEmptyArray), and a
 * 'verification-pending' result can never omit its reason. Replaces the
 * earlier flat, all-optional-fields interface, which allowed a
 * 'verification-pending' result with no explanation of why.
 */
export type RouteStatusResult =
  | { status: 'verified-direct'; verifiedDirectBasis: NonEmptyArray<VerifiedDirectBasis>; serviceNotices: ServiceLevelNotice[] }
  | { status: 'withdrawal-announced'; effectiveFrom: string; drivingEventId: string; scope: RouteStatusScope; serviceNotices: ServiceLevelNotice[] }
  | { status: 'service-ended'; effectiveFrom: string; drivingEventId: string; scope: RouteStatusScope; serviceNotices: ServiceLevelNotice[] }
  | { status: 'verification-pending'; pendingReason: PendingReason };

type PlanEvent = Extract<RouteStatusEvent, { type: 'withdrawal-announced' | 'withdrawal-rescheduled' | 'withdrawal-cancelled' }>;
type EndedEvent = Extract<RouteStatusEvent, { type: 'service-ended' }>;

/**
 * `transition-boundary` is reached when the latest plan decision's
 * effective date has passed but no fresh, verified 'service-ended' event
 * exists — the announcement alone is never treated as proof of occurrence.
 * It is a DISTINCT, permanent state, never silently converted to 'ended':
 * see resolveServiceLifecycle's doc comment for why `currentClaimValidBefore`
 * does not gate it. `ambiguous` now carries which kind of contradiction was
 * found, so getRouteStatus() can report an exact diagnostic rather than a
 * bare boolean.
 */
export type ServiceLifecycleState =
  | { kind: 'none' }
  | { kind: 'ambiguous'; reason: 'duplicate-ended-claims' | 'lifecycle-ordering-ambiguous' }
  | { kind: 'planned'; effectiveFrom: string; eventId: string }
  | { kind: 'transition-boundary'; effectiveFrom: string; eventId: string }
  | { kind: 'ended'; effectiveFrom: string; eventId: string };

/**
 * Resolves the latest decision among two or more still-current plan events
 * for the SAME service (an announcement plus a later cancellation or
 * reschedule, say). Order is established only by an explicit
 * relatedEventId chain within the set, or — failing that — by a later
 * announcedAt date. Two same-day decisions with no relatedEventId link
 * between them cannot be ordered and must not be picked by event-id or
 * array-position convention — that case returns 'ambiguous'.
 */
function determineLatestPlan(plans: PlanEvent[]): PlanEvent | 'ambiguous' {
  if (plans.length === 1) return plans[0];

  const byId = new Map(plans.map((p) => [p.id, p] as const));
  const referencedIds = new Set(
    plans
      .map((p) => p.relatedEventId)
      .filter((id): id is string => Boolean(id) && byId.has(id as string))
  );
  // An event referenced by another event IN THIS SET is earlier in the
  // chain; whatever remains un-referenced is the terminal (latest) node.
  // Defensive by construction: never call reduce()/index [0] on an empty
  // array. A well-formed, validated ledger can't produce zero terminal
  // nodes (validateStatusLedger's lifecycle-cycle check rules that out),
  // but this function must stay safe even if malformed data reaches
  // derivation directly, bypassing validation (e.g. a relatedEventId cycle
  // among these plans) — that case falls straight through to 'ambiguous'
  // rather than throwing.
  const terminal = plans.filter((p) => !referencedIds.has(p.id));
  if (terminal.length === 0) return 'ambiguous';
  if (terminal.length === 1) return terminal[0];

  const maxAnnouncedAt = terminal.reduce((max, p) => (p.announcedAt > max ? p.announcedAt : max), terminal[0].announcedAt);
  const atMax = terminal.filter((p) => p.announcedAt === maxAnnouncedAt);
  if (atMax.length === 1) return atMax[0];

  // Same announcedAt, no relatedEventId chain distinguishing them: order
  // genuinely cannot be established from the evidence on hand.
  return 'ambiguous';
}

/**
 * Resolves ONE service's lifecycle in isolation — never combined with any
 * other service on the route. Occurrence (a fresh, verified 'service-ended')
 * always beats a plan: an announced withdrawal is not proof the service
 * actually ended, no matter how long ago effectiveFrom passed.
 *
 * Route Status V1 final errata §1 fix: the plan-ordering step below is
 * deliberately UNFILTERED by currentClaimValidBefore. The earlier version
 * filtered plan events to only those still "fresh" before ever determining
 * which was latest — since the real IndiGo events set
 * currentClaimValidBefore === effectiveFrom, the moment nowIso reached that
 * date the event was filtered out before any state could be assigned, and
 * derivation silently fell through to 'none', losing the driving event
 * entirely. Ordering ("which decision is latest") is a structural question
 * independent of freshness; only AFTER the latest decision is identified
 * does this function ask what nowIso means for it. currentClaimValidBefore
 * still gates whether an event may drive the POSITIVE 'planned' claim (an
 * announcement stops being citable as "upcoming" once stale) — it does NOT
 * gate whether the same event may be cited as the cause of a neutral
 * 'transition-boundary' state, since that state asserts nothing positive
 * and exists precisely to explain the uncertainty the event created.
 */
function resolveServiceLifecycle(serviceEvents: RouteStatusEvent[], nowIso: string): ServiceLifecycleState {
  const ended = serviceEvents.filter(
    (e): e is EndedEvent => e.type === 'service-ended' && isCurrentClaimValid(e.currentClaimValidBefore, nowIso) && nowIso >= e.effectiveFrom
  );
  if (ended.length > 1) return { kind: 'ambiguous', reason: 'duplicate-ended-claims' }; // more than one live 'ended' claim for one service is a data contradiction, not a pick
  if (ended.length === 1) return { kind: 'ended', effectiveFrom: ended[0].effectiveFrom, eventId: ended[0].id };

  const allPlans = serviceEvents.filter(
    (e): e is PlanEvent => e.type === 'withdrawal-announced' || e.type === 'withdrawal-rescheduled' || e.type === 'withdrawal-cancelled'
  );
  if (allPlans.length === 0) return { kind: 'none' };

  const latest = determineLatestPlan(allPlans);
  if (latest === 'ambiguous') return { kind: 'ambiguous', reason: 'lifecycle-ordering-ambiguous' };
  // A cancellation is itself the latest decision: there is no pending boundary to report.
  if (latest.type === 'withdrawal-cancelled') return { kind: 'none' };

  const effectiveDate = latest.type === 'withdrawal-rescheduled' ? latest.newEffectiveFrom : latest.effectiveFrom;

  if (nowIso >= effectiveDate) {
    // The announced date has been reached with no verified occurrence —
    // a distinct, permanent transition-boundary state, regardless of
    // whether the event's own currentClaimValidBefore has also expired.
    return { kind: 'transition-boundary', effectiveFrom: effectiveDate, eventId: latest.id };
  }

  if (isCurrentClaimValid(latest.currentClaimValidBefore, nowIso)) {
    return { kind: 'planned', effectiveFrom: effectiveDate, eventId: latest.id };
  }

  // The effective date is still in the future, but the plan event's own
  // claim horizon has already expired (a stale, superseded-in-spirit but
  // not formally superseded record). Not a positive 'planned' claim, and
  // explicitly NOT transition-boundary either — the date genuinely hasn't
  // been reached yet. Falls through to 'none': the route/airline base
  // verification fallthrough in getRouteStatus() decides honestly from
  // there.
  return { kind: 'none' };
}

/** Strict (non-inclusive) current-verification check — deliberately separate from isVerificationCurrent(), which is inclusive and must never drive a Route Status result. */
function isRouteVerificationCurrentStrict(route: Route, nowIso: string): boolean {
  return route.verification?.status === 'verified' && isCurrentClaimValid(route.verification.reviewDueDate, nowIso);
}

/** Strict per-airline current-verification check. Only explicit, current AirlineVerification evidence counts — route-level verification on a multi-airline route never identifies which airline it is. */
function isAirlineVerificationCurrentStrict(route: Route, airlineSlug: string, nowIso: string): boolean {
  const v = getAirlineVerification(route, airlineSlug);
  return v?.status === 'verified' && isCurrentClaimValid(v.reviewDueDate, nowIso);
}

/**
 * Whether `airlineSlug` can be treated as the route's verifiably sole
 * direct operator. True only for the trivial, by-construction case (the
 * route's airlineSlugs list itself names exactly one airline). Never true
 * by elimination on a multi-airline route — there is no "verified NOT
 * direct" fact in this data model, so absence of evidence about other
 * airlines is never read as proof they don't operate.
 */
function isVerifiablySoleOperator(route: Route, airlineSlug: string): boolean {
  return route.airlineSlugs.length === 1 && route.airlineSlugs[0] === airlineSlug;
}

function airlineBasis(route: Route, airlineSlug: string): VerifiedDirectBasis {
  const v = getAirlineVerification(route, airlineSlug)!;
  return { kind: 'airline', airlineSlug, sourceName: v.sourceName, sourceUrl: v.sourceUrl, verifiedDate: v.verifiedDate, reviewDueDate: v.reviewDueDate };
}

/**
 * Every currently fresh, explicit source of evidence that the route
 * operates direct — the route-level `verification` record (if fresh) plus
 * every airline's own fresh `AirlineVerification` entry. Used for the base
 * "no active plan/ended state" fallthrough, where the whole route's direct
 * status is being asserted, not one specific airline's.
 */
function buildVerifiedDirectBasis(route: Route, nowIso: string): VerifiedDirectBasis[] {
  const basis: VerifiedDirectBasis[] = [];
  if (isRouteVerificationCurrentStrict(route, nowIso) && route.verification) {
    basis.push({
      kind: 'route',
      sourceName: route.verification.sourceName,
      sourceUrl: route.verification.sourceUrl,
      verifiedDate: route.verification.verifiedDate,
      reviewDueDate: route.verification.reviewDueDate,
    });
  }
  for (const airlineSlug of route.airlineSlugs) {
    if (isAirlineVerificationCurrentStrict(route, airlineSlug, nowIso)) basis.push(airlineBasis(route, airlineSlug));
  }
  return basis;
}

/**
 * Fresh evidence from airlines OTHER than `excludeAirlineSlug` only —
 * route-level verification is deliberately excluded here, since on a
 * multi-airline route it never identifies which specific airline it
 * supports (see AirlineVerification's doc comment). Used whenever one
 * named airline's service is ended/withdrawing/in transition and the
 * question is specifically whether some OTHER airline's own explicit
 * evidence still supports a 'verified-direct' route result.
 */
function buildVerifiedDirectBasisExcluding(route: Route, excludeAirlineSlug: string, nowIso: string): VerifiedDirectBasis[] {
  const basis: VerifiedDirectBasis[] = [];
  for (const airlineSlug of route.airlineSlugs) {
    if (airlineSlug === excludeAirlineSlug) continue;
    if (isAirlineVerificationCurrentStrict(route, airlineSlug, nowIso)) basis.push(airlineBasis(route, airlineSlug));
  }
  return basis;
}

/**
 * Converts an array already proven non-empty by the caller (always guarded
 * by an `if (arr.length > 0)` immediately above every call site) into the
 * compile-time NonEmptyArray shape, without an unsafe `as` cast — TypeScript
 * accepts an array literal built this way against a NonEmptyArray-typed
 * return position. Never call this without first checking length > 0.
 */
function nonEmpty<T>(arr: T[]): NonEmptyArray<T> {
  const [first, ...rest] = arr;
  return [first, ...rest];
}

/**
 * The Route Status V1 derivation — pure, deterministic, no wall-clock read
 * (matches getDisplayDirectness()/computeBookBySnapshot()'s contract).
 *
 * Returns null for any route with zero ledger events: that route is simply
 * not managed by Route Status and continues through the existing
 * getRoutePresentation()/getDisplayDirectness() behaviour completely
 * unchanged (binding override: "ledger-managed routes only").
 *
 * Every active event is resolved per its OWN serviceId in isolation
 * (resolveServiceLifecycle) — a change to one airline's service never
 * silently combines with another's. Route-scoped events (not attributable
 * to a single airline) take precedence when present, since they describe
 * the whole route rather than one operator's slice of it.
 *
 * getDisplayDirectness()'s inclusive freshness is never consulted here —
 * every current-claim check in this function uses the strict
 * isCurrentClaimValid() (nowIso < validBefore) instead.
 */
export function getRouteStatus(route: Route, allEvents: RouteStatusEvent[], nowIso: string): RouteStatusResult | null {
  const routeEvents = getEventsForRoute(route.slug, allEvents);
  if (routeEvents.length === 0) return null;

  const active = getActiveEvents(routeEvents);
  const byService = groupByServiceId(active);

  const services: Array<{ scope: RouteStatusScope; state: ServiceLifecycleState }> = [];
  for (const serviceEvents of byService.values()) {
    // Defends against a caller bypassing validateStatusLedger(): a
    // serviceId's ACTIVE (supersession-filtered) events must agree on one
    // scope before events[0].scope is trusted — otherwise input order
    // could decide whether the service is treated as route-scoped or
    // airline-scoped. A real validated ledger can't reach this branch (see
    // validateStatusLedger's 'inconsistent-active-service-scope' check),
    // but this function must stay safe even if it does.
    const distinctScopes: RouteStatusScope[] = [];
    for (const e of serviceEvents) {
      if (!distinctScopes.some((s) => scopesMatch(s, e.scope))) {
        distinctScopes.push(e.scope);
      }
    }
    if (distinctScopes.length > 1) {
      return { status: 'verification-pending', pendingReason: { kind: 'conflicting-ledger-evidence', diagnostic: 'inconsistent-active-service-scope' } };
    }
    services.push({ scope: serviceEvents[0].scope, state: resolveServiceLifecycle(serviceEvents, nowIso) });
  }

  // Step: collect and classify every ambiguous service before anything else
  // is decided — a data contradiction anywhere on the route always wins
  // over a positive/pending call made from the rest of the (possibly
  // incomplete) picture.
  const ambiguousServices = services.filter(
    (s): s is { scope: RouteStatusScope; state: Extract<ServiceLifecycleState, { kind: 'ambiguous' }> } => s.state.kind === 'ambiguous'
  );
  if (ambiguousServices.length > 0) {
    const diagnostic = ambiguousServices.some((s) => s.state.reason === 'duplicate-ended-claims')
      ? 'duplicate-ended-claims'
      : 'lifecycle-ordering-ambiguous';
    return { status: 'verification-pending', pendingReason: { kind: 'conflicting-ledger-evidence', diagnostic } };
  }

  const isActiveKind = (k: ServiceLifecycleState['kind']) => k === 'ended' || k === 'planned' || k === 'transition-boundary';

  // Route-scoped and airline-scoped active services are collected — never
  // picked by array order, and never combined by an implicit "route beats
  // airline" precedence either. A route-scoped serviceId active AT THE
  // SAME TIME as an airline-scoped one is itself a contradiction: nothing
  // in the ledger explains how a whole-route lifecycle and one airline's
  // own separate lifecycle can both be currently live, so this is always
  // reported rather than silently resolved by picking one. See the Route
  // Status V1 implementation addendum §1.
  const routeScoped = services.filter((s) => s.scope.kind === 'route');
  const activeRouteScoped = routeScoped.filter((s) => isActiveKind(s.state.kind));
  const airlineScoped = services.filter(
    (s): s is { scope: { kind: 'airline'; airlineSlug: string }; state: ServiceLifecycleState } => s.scope.kind === 'airline'
  );
  const activeAirlineScoped = airlineScoped.filter((s) => isActiveKind(s.state.kind));

  if (activeRouteScoped.length > 0 && activeAirlineScoped.length > 0) {
    return {
      status: 'verification-pending',
      pendingReason: { kind: 'conflicting-ledger-evidence', diagnostic: 'mixed-active-route-and-airline-services' },
    };
  }

  if (activeRouteScoped.length > 1) {
    return { status: 'verification-pending', pendingReason: { kind: 'conflicting-ledger-evidence', diagnostic: 'multiple-active-route-services' } };
  }
  if (activeRouteScoped.length === 1) {
    const scope = activeRouteScoped[0].scope;
    const state = activeRouteScoped[0].state;
    if (state.kind === 'ended') {
      return { status: 'service-ended', effectiveFrom: state.effectiveFrom, drivingEventId: state.eventId, scope, serviceNotices: [] };
    }
    if (state.kind === 'transition-boundary') {
      return {
        status: 'verification-pending',
        pendingReason: { kind: 'transition-boundary-reached', drivingEventId: state.eventId, effectiveFrom: state.effectiveFrom, scope },
      };
    }
    if (state.kind === 'planned') {
      // A withdrawal notice must not substitute for fresh current-service
      // evidence: even a currently-active plan cannot assert
      // 'withdrawal-announced' unless the route's own direct-service
      // verification is itself still fresh.
      if (isRouteVerificationCurrentStrict(route, nowIso)) {
        return { status: 'withdrawal-announced', effectiveFrom: state.effectiveFrom, drivingEventId: state.eventId, scope, serviceNotices: [] };
      }
      return { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } };
    }
  }

  // Airline-scoped: never picked by array order, and never by an implicit
  // "ended beats planned/transition-boundary across different airlines"
  // rule either — that would silently let one airline's occurrence
  // dominate an unrelated airline's still-open plan. If more than one
  // distinct airline-scoped service is simultaneously active, that is an
  // unresolved ambiguity: V1 does not aggregate notices or infer which
  // operator remains when two operators' lifecycles are both live at once.
  if (activeAirlineScoped.length > 1) {
    return { status: 'verification-pending', pendingReason: { kind: 'conflicting-ledger-evidence', diagnostic: 'multiple-active-airline-services' } };
  }
  if (activeAirlineScoped.length === 1) {
    const { airlineSlug } = activeAirlineScoped[0].scope;
    const scope: RouteStatusScope = { kind: 'airline', airlineSlug };
    const state = activeAirlineScoped[0].state;

    if (state.kind === 'ended') {
      const effectiveFrom = state.effectiveFrom;
      if (isVerifiablySoleOperator(route, airlineSlug)) {
        return { status: 'service-ended', effectiveFrom, drivingEventId: state.eventId, scope, serviceNotices: [] };
      }
      const otherBasis = buildVerifiedDirectBasisExcluding(route, airlineSlug, nowIso);
      if (otherBasis.length > 0) {
        return {
          status: 'verified-direct',
          verifiedDirectBasis: nonEmpty(otherBasis),
          serviceNotices: [{ airlineSlug, kind: 'service-ended', effectiveFrom, drivingEventId: state.eventId }],
        };
      }
      // Multi-airline route, no explicit evidence the remaining operator set is known — never guess.
      return { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } };
    }

    if (state.kind === 'transition-boundary') {
      const effectiveFrom = state.effectiveFrom;
      const otherBasis = buildVerifiedDirectBasisExcluding(route, airlineSlug, nowIso);
      if (otherBasis.length > 0) {
        // Another airline's own explicit, current evidence proves the route
        // still operates direct — saying "we can't confirm this route's
        // direct service" would be false. The affected airline gets a
        // reverification-pending notice, never "ended".
        return {
          status: 'verified-direct',
          verifiedDirectBasis: nonEmpty(otherBasis),
          serviceNotices: [{ airlineSlug, kind: 'status-reverification-pending', effectiveFrom, drivingEventId: state.eventId }],
        };
      }
      // Sole operator, or no other airline has independent fresh evidence —
      // either way there is no remaining verified direct claim to fall
      // back on.
      return {
        status: 'verification-pending',
        pendingReason: { kind: 'transition-boundary-reached', drivingEventId: state.eventId, effectiveFrom, scope },
      };
    }

    if (state.kind === 'planned') {
      const effectiveFrom = state.effectiveFrom;
      if (isVerifiablySoleOperator(route, airlineSlug)) {
        // A withdrawal notice must not substitute for fresh current-service
        // evidence — the sole-operator structure identifies WHO the operator
        // is, but not that their direct service is currently verified.
        const hasFreshDirectEvidence =
          isRouteVerificationCurrentStrict(route, nowIso) || isAirlineVerificationCurrentStrict(route, airlineSlug, nowIso);
        if (hasFreshDirectEvidence) {
          return { status: 'withdrawal-announced', effectiveFrom, drivingEventId: state.eventId, scope, serviceNotices: [] };
        }
        return { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } };
      }
      const otherBasis = buildVerifiedDirectBasisExcluding(route, airlineSlug, nowIso);
      if (otherBasis.length > 0) {
        return {
          status: 'verified-direct',
          verifiedDirectBasis: nonEmpty(otherBasis),
          serviceNotices: [{ airlineSlug, kind: 'withdrawal-announced', effectiveFrom, drivingEventId: state.eventId }],
        };
      }
      return { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } };
    }
  }

  // No active plan, transition-boundary, or ended state on any service —
  // base current verification. Deliberately never 'connecting': a
  // ledger-managed route with no active change simply asserts whether its
  // direct service is currently verified.
  const basis = buildVerifiedDirectBasis(route, nowIso);
  if (route.isDirect && basis.length > 0) {
    return { status: 'verified-direct', verifiedDirectBasis: nonEmpty(basis), serviceNotices: [] };
  }
  return { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } };
}

// getEffectiveRoutePresentation() — the adapter every public surface calls
// instead of getRoutePresentation() directly — lives in
// lib/route-status-copy.ts, not here: it must route through that file's own
// getRouteStatusCopy() evidence validation so a RouteStatusResult carrying
// malformed/tampered evidence can never leak "direct" facts through the
// presentation layer merely because it never passed through the copy
// layer's stricter checks. See that file's header comment.
