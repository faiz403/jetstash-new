import { airports } from './airports';
import { destinations } from './destinations';
import { getAirlinesBySlugs } from './airlines';
import { getPeakPeriodsByIds } from './peak-periods';

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
   * Set only when a CURRENTLY direct service has a publicly announced
   * withdrawal date. This exists so a route page can be honest about a
   * time-bound direct service without the whole page becoming false the
   * day the withdrawal happens — page copy should always describe the
   * realistic 1-stop alternative as the durable fallback, never assume
   * the direct service is permanent. Remove this field once the
   * withdrawal date has passed and the route data has been updated to
   * reflect connecting-only status.
   */
  directServiceEndDate?: string; // ISO date, e.g. '2026-09-01'
  /** Plain-language note explaining the withdrawal, shown alongside directServiceEndDate. */
  directServiceEndNote?: string;
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
    frequency: '3x weekly direct (reduced from 5x weekly in Feb 2026); ending 31 Aug 2026',
    airlineSlugs: ['indigo'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "IndiGo official press releases: \"IndiGo Adjusts Wide-body Network to Enhance Operational Resilience and Schedule Reliability\" (4 Feb 2026) and \"Amidst unfavorable cost and operational environment, IndiGo temporarily discontinues flights to / from Manchester starting 31 August 2026\" (2 Jun 2026)",
      sourceUrl: 'https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-31',
      note: 'Primary-sourced directly from IndiGo\'s own press office (both releases fetched and read directly, not via secondary reporting). The Feb 2026 release gives the exact post-cut schedule (Delhi–Manchester 6E0033/6E0034, Mon/Thu/Sun and Mon/Wed/Thu). The Jun 2026 release confirms discontinuation "starting 31 August 2026" and describes it as "temporary," attributed to airspace-constraint-driven cost pressure — but also states one of six Boeing 787-9s is being returned to lessor Norse Atlantic Airways, and unlike the other routes suspended the same week (which got an explicit 1 Oct 2026 resumption date), IndiGo announced no resumption date for Manchester specifically. Treat "temporary" as the airline\'s own characterisation, not a confirmed return date.',
    },
    intro:
      'IndiGo launched the first non-stop Manchester to Delhi service in 25 years in November 2025, flying a two-class Boeing 787-9 leased from Norse Atlantic Airways. It\'s currently the only airline flying this route direct. IndiGo cut frequency from 5x to 3x weekly in February 2026 citing airspace-related operational strain, and announced in June 2026 that it will discontinue the route entirely from 31 August 2026 — described by IndiGo as temporary, though no resumption date has been given.',
    bookingWindowNote:
      'This direct service ends 31 August 2026 per IndiGo\'s own announcement. If your dates are flexible, compare the direct fare against the well-established one-stop Gulf-carrier options below before committing — especially for travel after that date.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    directServiceEndDate: '2026-08-31',
    directServiceEndNote:
      'IndiGo has announced it will discontinue Manchester service entirely from 31 August 2026, ending both the Delhi and Mumbai direct services — described by IndiGo as temporary, with no resumption date announced. If you are travelling after this date, plan around the one-stop alternative below rather than the direct route.',
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
    frequency: '4x weekly direct (Mon/Tue/Sat/Sun ex-Manchester, per Feb 2026 schedule); ending 31 Aug 2026',
    airlineSlugs: ['indigo'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "IndiGo official press releases: \"IndiGo Adjusts Wide-body Network to Enhance Operational Resilience and Schedule Reliability\" (4 Feb 2026) and \"Amidst unfavorable cost and operational environment, IndiGo temporarily discontinues flights to / from Manchester starting 31 August 2026\" (2 Jun 2026)",
      sourceUrl: 'https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html',
      verifiedDate: '2026-07-13',
      reviewDueDate: '2026-08-31',
      note: 'Primary-sourced directly from IndiGo\'s own press office (both releases fetched and read directly, not via secondary reporting). The Feb 2026 release gives the exact post-cut schedule (Mumbai–Manchester 6E0031/6E0032, departing Manchester Mon/Tue/Sat/Sun). The Jun 2026 release confirms discontinuation "starting 31 August 2026" and describes it as "temporary" — but also states one of six Boeing 787-9s is being returned to lessor Norse Atlantic Airways, and unlike the other routes suspended the same week (explicit 1 Oct 2026 resumption), IndiGo announced no resumption date for Manchester. Treat "temporary" as the airline\'s own characterisation, not a confirmed return date.',
    },
    intro:
      'IndiGo\'s Mumbai to Manchester service, launched in July 2025, was the airline\'s first ever long-haul route and remains the only non-stop link between Manchester and India\'s financial capital. As with the Delhi route, it\'s a single-airline direct service rather than a long-established one. IndiGo announced in June 2026 that it will discontinue the route entirely from 31 August 2026 — described by IndiGo as temporary, though no resumption date has been given.',
    bookingWindowNote:
      'This direct service ends 31 August 2026 per IndiGo\'s own announcement. The well-established one-stop Gulf-carrier options below run far more frequently and are worth comparing on price and convenience, especially for travel after that date.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    directServiceEndDate: '2026-08-31',
    directServiceEndNote:
      'IndiGo has announced it will discontinue Manchester service entirely from 31 August 2026, ending both the Mumbai and Delhi direct services — described by IndiGo as temporary, with no resumption date announced. If you are travelling after this date, plan around the one-stop alternative below rather than the direct route.',
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

export function getRouteAirlines(route: Route) {
  return getAirlinesBySlugs(route.airlineSlugs);
}

export function getRoutePeakPeriods(route: Route) {
  return getPeakPeriodsByIds(route.peakPeriodIds);
}

export type DisplayDirectness = 'direct' | 'connecting' | 'unverified';

function isVerificationCurrent(v: { status: RouteVerificationStatus; reviewDueDate: string } | undefined, nowIso: string): boolean {
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
