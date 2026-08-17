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
    slug: 'manchester-istanbul',
    airportSlug: 'manchester',
    destinationSlug: 'istanbul',
    flightTime: 'Published timings vary: Manchester Airport lists 4h 30m; Turkish Airlines says a little over 4h',
    frequency: 'Turkish Airlines: two direct flights daily in its published route information; exact departure times vary',
    airlineSlugs: ['turkish-airlines'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Turkish Airlines official Manchester–Istanbul route page, corroborated by Manchester Airport destination guide',
      sourceUrl: 'https://www.turkishairlines.com/uk-int/flights/city/from-manchester-to-istanbul-flights/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Turkish Airlines states it operates two direct flights a day from Manchester to Istanbul Airport (IST), taking a little more than four hours. Manchester Airport lists a 4h30m scheduled flight time. Exact dates, departure times and any other operator must be checked before booking.',
    },
    intro:
      'Turkish Airlines currently publishes two direct Manchester–Istanbul flights a day to Istanbul Airport (IST). Manchester Airport lists a scheduled flight time of 4h30m, while Turkish Airlines describes the flight as taking a little more than four hours. Check your dates for the exact departure and fare.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact schedule, fare conditions and baggage terms for your dates before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-dalaman',
    airportSlug: 'manchester',
    destinationSlug: 'dalaman',
    flightTime: 'Scheduled flight time: 4h 30m from Manchester',
    frequency: 'SunExpress: daily direct overnight service from 19 May 2026 in its published summer programme; exact dates may vary',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'SunExpress official Manchester–Dalaman announcement, corroborated by Manchester Airport destination guide',
      sourceUrl: 'https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-launches-convenient-night-flights-from-manchester-to-dalaman/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress announced direct overnight Manchester–Dalaman flights from 19 May 2026, with daily operation in the published summer programme. Its current flight plan lists Manchester service seven days per week for the April–October schedule, which is subject to change. Manchester Airport lists a 4h30m scheduled flight time.',
    },
    intro:
      'SunExpress currently publishes direct overnight Manchester–Dalaman service, including daily operation from 19 May 2026 in its summer programme. Manchester Airport lists a scheduled flight time of 4h30m. Check the exact dates, schedule and baggage terms before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Dalaman schedules are date-sensitive, so check the exact service and fare conditions before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-bodrum',
    airportSlug: 'manchester',
    destinationSlug: 'bodrum',
    flightTime: 'Published timings vary by source; check the exact flight for your dates',
    frequency: 'SunExpress: twice-weekly direct service in the summer 2026 programme; exact operating days require checking',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'SunExpress official summer 2026 UK network announcement, corroborated by Manchester Airport destination guide',
      sourceUrl: 'https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-expands-uk-route-network-for-summer-2026-with-launch-of-services-from-east-midlands/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress announces twice-weekly direct Manchester–Bodrum service for summer 2026. Manchester Airport states that flights to Bodrum are offered in summer only. Published timings differ: Manchester Airport lists 4h30m while current Jet2 route examples show 4h15m–4h20m, so no single duration is presented.',
    },
    intro:
      'Manchester–Bodrum is a seasonal route. Manchester Airport says flights are summer-only, and SunExpress announces twice-weekly direct service in its summer 2026 programme. Published flight timings vary, so check the exact itinerary for your dates.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, exact operating day and fare conditions before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-antalya',
    airportSlug: 'manchester',
    destinationSlug: 'antalya',
    flightTime: 'Published timings vary by source; check the exact flight and date',
    frequency: 'Seasonal direct service; exact airlines, dates and frequency vary by schedule',
    airlineSlugs: ['sunexpress', 'jet2', 'corendon'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'SunExpress official Summer 2026 flight plan, corroborated by current Jet2 and Corendon route pages and Manchester Airport destination guide',
      sourceUrl: 'https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress lists Manchester–Antalya in its April–October 2026 plan. Current Jet2 and Corendon route pages also show Manchester–Antalya booking options. Published timings vary: Manchester Airport lists 4h45m, Jet2 examples show 4h30m outbound and 4h45m return, and Corendon lists 4h55m. No single duration or fixed total frequency is published here; check the exact airline, date and itinerary before booking.',
    },
    airlineVerifications: [
      {
        airlineSlug: 'sunexpress',
        status: 'verified',
        sourceName: 'SunExpress official Summer 2026 flight plan',
        sourceUrl: 'https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf',
        verifiedDate: '2026-08-12',
        reviewDueDate: '2026-09-12',
        effectivePeriod: 'April–October 2026 published plan',
        supportedClaim: 'Lists Manchester–Antalya service in the current seasonal plan.',
        remainingUncertainty: 'Exact operating dates, frequency and timings can change within the season.',
      },
      {
        airlineSlug: 'jet2',
        status: 'verified',
        sourceName: 'Jet2 official Manchester–Antalya booking page',
        sourceUrl: 'https://www.jet2.com/en/cheap-flights/manchester/antalya',
        verifiedDate: '2026-08-12',
        reviewDueDate: '2026-09-12',
        effectivePeriod: 'Date-specific 2026 booking examples',
        supportedClaim: 'Shows Manchester–Antalya flight options with published date-specific timings.',
        remainingUncertainty: 'Availability, operating days and timings vary by date.',
      },
      {
        airlineSlug: 'corendon',
        status: 'verified',
        sourceName: 'Corendon official Manchester–Antalya booking page',
        sourceUrl: 'https://www.corendonairlines.com/flights-from-manchester-to-antalya',
        verifiedDate: '2026-08-12',
        reviewDueDate: '2026-09-12',
        effectivePeriod: 'Current date-specific booking options',
        supportedClaim: 'Shows Manchester–Antalya flight options and a published route duration.',
        remainingUncertainty: 'Availability, operating days and exact timings vary by date.',
      },
    ],
    intro:
      'Current official airline and airport material supports seasonal direct Manchester–Antalya service. SunExpress, Jet2 and Corendon show route evidence for 2026, but airlines, dates and frequency vary. Published timings differ by source, so check your exact flight before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact seasonal schedule, flight duration and fare conditions before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-izmir',
    airportSlug: 'manchester',
    destinationSlug: 'izmir',
    flightTime: 'Published planning figure: 4h 20m from Manchester Airport; exact duration varies by flight',
    frequency: 'Seasonal direct service in SunExpress’s April–October 2026 programme; exact frequency and dates vary',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'SunExpress official Summer 2026 flight plan and programme announcement, corroborated by Manchester Airport destination guide',
      sourceUrl: 'https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress lists Manchester–Izmir in its April–October 2026 plan and described up to 19 weekly Manchester–Izmir flights in its summer programme. Manchester Airport lists a 4h20m published planning duration. Exact dates, frequency and actual journey time vary by schedule; no fixed weekly number is published here.',
    },
    intro:
      'Direct Manchester–Izmir service is included in SunExpress’s published April–October 2026 programme. SunExpress described up to 19 weekly flights in its summer programme, but exact dates and frequency vary. Manchester Airport lists a published planning figure of 4h20m; check your exact flight before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. The service is seasonal, so check the exact operating date, duration and fare conditions before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'birmingham-istanbul',
    airportSlug: 'birmingham',
    destinationSlug: 'istanbul',
    flightTime: 'Approximate published flight time: 4h 05m from Birmingham Airport',
    frequency: 'Direct service; exact dates and frequency vary by schedule',
    airlineSlugs: ['turkish-airlines', 'pegasus'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Birmingham Airport's official Istanbul destination page",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/istanbul/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Birmingham Airport lists direct Pegasus Airlines and Turkish Airlines service, identifies Istanbul Airport (IST) and Sabiha Gökçen (SAW), and publishes an approximate 4h05 flight time. Exact airport, dates, departure times and frequency must be checked before booking.',
    },
    airlineVerifications: [
      {
        airlineSlug: 'turkish-airlines',
        status: 'verified',
        sourceName: "Birmingham Airport's official Istanbul destination page",
        sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/istanbul/',
        verifiedDate: '2026-08-12',
        reviewDueDate: '2026-09-12',
        effectivePeriod: 'Current at access',
        supportedClaim: 'Lists Turkish Airlines direct service from Birmingham to Istanbul.',
        remainingUncertainty: 'Exact Istanbul airport, dates and frequency vary by schedule.',
      },
      {
        airlineSlug: 'pegasus',
        status: 'verified',
        sourceName: "Birmingham Airport's official Istanbul destination page",
        sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/istanbul/',
        verifiedDate: '2026-08-12',
        reviewDueDate: '2026-09-12',
        effectivePeriod: 'Current at access',
        supportedClaim: 'Lists Pegasus Airlines direct service from Birmingham to Istanbul.',
        remainingUncertainty: 'Exact Istanbul airport, dates and frequency vary by schedule.',
      },
    ],
    intro:
      'Birmingham has direct service to Istanbul with Turkish Airlines and Pegasus Airlines. Turkish Airlines serves Istanbul Airport (IST), while Pegasus serves Sabiha Gökçen (SAW). Birmingham Airport publishes an approximate flight time of 4h05. Check the airport, airline and exact schedule carefully before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact Istanbul airport, schedule, fare conditions and baggage terms for your dates before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'birmingham-antalya',
    airportSlug: 'birmingham',
    destinationSlug: 'antalya',
    flightTime: 'Approximate published flight time: 4h 20m from Birmingham Airport',
    frequency: 'Direct service; exact dates and frequency vary by schedule',
    airlineSlugs: ['corendon', 'easyjet', 'jet2', 'tui', 'sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Birmingham Airport's official Antalya destination page",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/antalya/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Birmingham Airport lists direct Corendon, easyJet, Jet2, TUI and SunExpress service and publishes an approximate 4h20 flight time. Exact dates, airline availability, frequency and duration vary by schedule; no year-round claim is made.',
    },
    airlineVerifications: ['corendon', 'easyjet', 'jet2', 'tui', 'sunexpress'].map((airlineSlug) => ({
      airlineSlug,
      status: 'verified' as const,
      sourceName: "Birmingham Airport's official Antalya destination page",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/antalya/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Current at access',
      supportedClaim: 'Lists direct service from Birmingham to Antalya.',
      remainingUncertainty: 'Exact dates, frequency and timings vary by airline and schedule.',
    })),
    intro:
      'Birmingham has direct service to Antalya, with several airlines listed by Birmingham Airport including Corendon, easyJet, Jet2, TUI and SunExpress. Birmingham Airport publishes an approximate flight time of 4h20. Airline availability and schedules vary by date, so check your exact flight before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact seasonal schedule, flight duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'birmingham-dalaman',
    airportSlug: 'birmingham',
    destinationSlug: 'dalaman',
    flightTime: 'Approximate published flight time: 4h 05m from Birmingham Airport',
    frequency: 'Direct service; exact dates and frequency vary by schedule',
    airlineSlugs: ['jet2', 'tui', 'easyjet'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Birmingham Airport's official Dalaman destination page",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/dalaman/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Birmingham Airport lists direct Jet2, TUI and easyJet service and publishes an approximate 4h05 flight time. Individual scheduled flights can differ, so check the exact airline, date and timing before booking. No whole-route seasonality claim is made.',
    },
    airlineVerifications: ['jet2', 'tui', 'easyjet'].map((airlineSlug) => ({
      airlineSlug,
      status: 'verified' as const,
      sourceName: "Birmingham Airport's official Dalaman destination page",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/dalaman/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Current at access',
      supportedClaim: 'Lists direct service from Birmingham to Dalaman.',
      remainingUncertainty: 'Exact dates, frequency and timings vary by airline and schedule.',
    })),
    intro:
      'Birmingham has direct service to Dalaman with Jet2, TUI and easyJet listed by Birmingham Airport. Birmingham Airport gives an approximate flight time of 4h05, while individual scheduled flights can differ. Check the airline, date and exact timing before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, flight duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'birmingham-bodrum',
    airportSlug: 'birmingham',
    destinationSlug: 'bodrum',
    flightTime: 'Approximate published flight time: 4h 15m from Birmingham Airport',
    frequency: 'Seasonal direct service; exact operating days vary by schedule',
    airlineSlugs: ['jet2', 'tui'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Birmingham Airport's official Bodrum destination page, corroborated by Jet2's current summer programme",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/bodrum/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Birmingham Airport lists direct Jet2 and TUI service and publishes an approximate 4h15 flight time. Jet2 currently markets Birmingham–Bodrum for its summer programme. Exact operating days and season boundaries across airlines require checking before booking.',
    },
    airlineVerifications: ['jet2', 'tui'].map((airlineSlug) => ({
      airlineSlug,
      status: 'verified' as const,
      sourceName: "Birmingham Airport's official Bodrum destination page",
      sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/bodrum/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Current at access; summer programme context',
      supportedClaim: 'Lists direct service from Birmingham to Bodrum.',
      remainingUncertainty: 'Exact operating days and season boundaries vary by schedule.',
    })),
    intro:
      'Birmingham has seasonal direct service to Bodrum. Birmingham Airport lists Jet2 and TUI as direct operators and publishes an approximate flight time of 4h15. Jet2 currently markets Birmingham–Bodrum for the summer programme, so check availability for your exact dates.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, exact operating day, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'leeds-bradford-antalya',
    airportSlug: 'leeds-bradford',
    destinationSlug: 'antalya',
    flightTime: 'Published duration not listed by Leeds Bradford Airport; check the exact flight for your dates',
    frequency: 'Direct destination listed by Leeds Bradford Airport; dates and frequency vary by schedule',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Leeds Bradford Airport's current destinations directory and Antalya destination page",
      sourceUrl: 'https://www.leedsbradfordairport.co.uk/destinations/turkey/antalya',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Leeds Bradford Airport currently lists Antalya as a direct destination and provides operator booking links. It does not publish a route-specific duration or fixed frequency on the reviewed pages, so those details remain for the traveller to check.',
    },
    intro:
      'Leeds Bradford Airport currently lists direct service to Antalya. The airport does not publish a fixed duration or frequency on the reviewed destination pages, so check the exact operating airline, date and itinerary before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms for your dates before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'leeds-bradford-dalaman',
    airportSlug: 'leeds-bradford',
    destinationSlug: 'dalaman',
    flightTime: 'Published duration not listed by Leeds Bradford Airport; check the exact flight for your dates',
    frequency: 'Direct destination listed by Leeds Bradford Airport; dates and frequency vary by schedule',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Leeds Bradford Airport's current destinations directory and Turkey destination pages",
      sourceUrl: 'https://www.leedsbradfordairport.co.uk/destinations',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Leeds Bradford Airport currently lists Dalaman as a direct destination. The reviewed airport pages do not publish a route-specific duration, named operator or fixed frequency, so those details remain for the traveller to check.',
    },
    intro:
      'Leeds Bradford Airport currently lists direct service to Dalaman. The airport does not publish a fixed duration, named operator or frequency on the reviewed pages, so check the exact flight details before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact seasonal schedule, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'leeds-bradford-bodrum',
    airportSlug: 'leeds-bradford',
    destinationSlug: 'bodrum',
    flightTime: 'Published duration not listed by Leeds Bradford Airport; check the exact flight for your dates',
    frequency: 'Direct destination listed by Leeds Bradford Airport; dates and frequency vary by schedule',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Leeds Bradford Airport's current destinations directory and Bodrum destination page",
      sourceUrl: 'https://www.leedsbradfordairport.co.uk/destinations/turkey/bodrum',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Leeds Bradford Airport currently lists Bodrum as a direct destination. The reviewed airport pages do not publish a route-specific duration, named operator or fixed frequency, so those details remain for the traveller to check.',
    },
    intro:
      'Leeds Bradford Airport currently lists direct service to Bodrum. The airport does not publish a fixed duration, named operator or frequency on the reviewed pages, so check the exact flight and season before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact seasonal schedule, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'glasgow-antalya',
    airportSlug: 'glasgow',
    destinationSlug: 'antalya',
    flightTime: 'Published duration not stated in the current Glasgow Airport schedule; check the exact flight for your dates',
    frequency: 'Current Glasgow Airport schedule lists direct Jet2 and easyJet examples; exact dates and frequency vary',
    airlineSlugs: ['jet2', 'easyjet'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Glasgow Airport's current Antalya destination schedule",
      sourceUrl: 'https://www.glasgowairport.com/destinations/antalya/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Glasgow Airport currently lists direct Jet2 and easyJet Antalya services across published date ranges. The schedule is date-specific and does not establish a fixed frequency or a route-wide duration.',
    },
    airlineVerifications: ['jet2', 'easyjet'].map((airlineSlug) => ({
      airlineSlug,
      status: 'verified' as const,
      sourceName: "Glasgow Airport's current Antalya destination schedule",
      sourceUrl: 'https://www.glasgowairport.com/destinations/antalya/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Published date ranges from August 2026 onward',
      supportedClaim: 'Lists direct service from Glasgow to Antalya for published dates.',
      remainingUncertainty: 'Exact operating dates, frequency and duration vary by schedule.',
    })),
    intro:
      'Glasgow Airport currently lists direct Jet2 and easyJet service to Antalya across published date ranges. Exact dates, frequency and flight duration vary by schedule, so check your itinerary before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'glasgow-dalaman',
    airportSlug: 'glasgow',
    destinationSlug: 'dalaman',
    flightTime: 'Approximately 4h 42m from Glasgow Airport; individual flights can differ',
    frequency: 'Current Glasgow Airport schedule lists direct TUI, Jet2 and easyJet examples; exact dates and frequency vary',
    airlineSlugs: ['tui', 'jet2', 'easyjet'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Glasgow Airport's current Dalaman destination schedule",
      sourceUrl: 'https://www.glasgowairport.com/destinations/dalaman/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Glasgow Airport lists direct TUI, Jet2 and easyJet Dalaman services across published date ranges and gives an approximate 4h42 flight duration. Exact dates, frequency and individual timings vary by schedule.',
    },
    airlineVerifications: ['tui', 'jet2', 'easyjet'].map((airlineSlug) => ({
      airlineSlug,
      status: 'verified' as const,
      sourceName: "Glasgow Airport's current Dalaman destination schedule",
      sourceUrl: 'https://www.glasgowairport.com/destinations/dalaman/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Published date ranges from August 2026 onward',
      supportedClaim: 'Lists direct service from Glasgow to Dalaman for published dates.',
      remainingUncertainty: 'Exact operating dates, frequency and duration vary by schedule.',
    })),
    intro:
      'Glasgow Airport currently lists direct TUI, Jet2 and easyJet service to Dalaman. It publishes an approximate flight duration of 4h42, but exact timing and operating dates vary by schedule.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'glasgow-bodrum',
    airportSlug: 'glasgow',
    destinationSlug: 'bodrum',
    flightTime: 'Approximately 4h 33m from Glasgow Airport; individual flights can differ',
    frequency: 'Current Glasgow Airport schedule lists seasonal direct Jet2 examples; exact dates and frequency vary',
    airlineSlugs: ['jet2'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Glasgow Airport's current Bodrum destination schedule",
      sourceUrl: 'https://www.glasgowairport.com/destinations/bodrum/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Glasgow Airport lists seasonal direct Jet2 Bodrum services for published summer date ranges and gives an approximate 4h33 flight duration. Exact operating dates and frequency vary by schedule.',
    },
    airlineVerifications: [{
      airlineSlug: 'jet2',
      status: 'verified',
      sourceName: "Glasgow Airport's current Bodrum destination schedule",
      sourceUrl: 'https://www.glasgowairport.com/destinations/bodrum/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Published summer 2026 date ranges',
      supportedClaim: 'Lists seasonal direct Jet2 service from Glasgow to Bodrum for published dates.',
      remainingUncertainty: 'Exact operating dates and frequency vary by schedule.',
    }],
    intro:
      'Glasgow Airport currently lists seasonal direct Jet2 service to Bodrum. It publishes an approximate flight duration of 4h33, but check the exact date and operating day before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'bristol-antalya',
    airportSlug: 'bristol',
    destinationSlug: 'antalya',
    flightTime: 'Published duration not listed on Bristol Airport\'s route page; check the exact flight for your dates',
    frequency: 'Bristol Airport publishes up to 18 flights a week and an all-year listing; exact dates and operators vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Bristol Airport's current Antalya destination page",
      sourceUrl: 'https://www.bristolairport.co.uk/where-can-i-fly/destinations/europe/turkey/antalya/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Bristol Airport currently lists Antalya, says it flies up to 18 times a week and labels the destination all year round. The reviewed page does not establish a single operator, fixed daily pattern or route duration.',
    },
    intro:
      'Bristol Airport currently lists direct Antalya service and publishes up to 18 flights a week with an all-year destination listing. Exact operators, dates, frequency and duration vary, so check your itinerary before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'bristol-dalaman',
    airportSlug: 'bristol',
    destinationSlug: 'dalaman',
    flightTime: 'Published duration not listed on Bristol Airport\'s route page; check the exact flight for your dates',
    frequency: 'Bristol Airport publishes daily service from March to November; exact dates and operators vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Bristol Airport's current Dalaman destination page",
      sourceUrl: 'https://www.bristolairport.co.uk/where-can-i-fly/destinations/europe/turkey/dalaman/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Bristol Airport currently lists direct Dalaman service, publishes daily operation from March to November and describes it as summer only. The reviewed page does not establish a single operator or route duration.',
    },
    intro:
      'Bristol Airport currently lists direct Dalaman service and publishes daily operation from March to November, described as summer only. Exact operators, dates and duration vary, so check your itinerary before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'newcastle-dalaman',
    airportSlug: 'newcastle',
    destinationSlug: 'dalaman',
    flightTime: 'Published duration not listed in Newcastle Airport\'s current destination evidence; check the exact flight for your dates',
    frequency: 'SunExpress publishes multiple weekly summer flights; exact dates and frequency vary',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Newcastle Airport's current airline directory",
      sourceUrl: 'https://www.newcastleairport.com/our-destinations/our-airlines/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Newcastle Airport states that SunExpress flies multiple times a week during summer to Dalaman. The reviewed current page does not publish a fixed frequency or duration, so check the exact date and itinerary before booking.',
    },
    airlineVerifications: [{
      airlineSlug: 'sunexpress',
      status: 'verified',
      sourceName: "Newcastle Airport's current airline directory",
      sourceUrl: 'https://www.newcastleairport.com/our-destinations/our-airlines/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Current summer-service statement',
      supportedClaim: 'States that SunExpress flies multiple times a week in summer from Newcastle to Dalaman.',
      remainingUncertainty: 'Exact operating dates, frequency and duration vary by schedule.',
    }],
    intro:
      'Newcastle Airport currently describes SunExpress direct Dalaman service as running multiple times a week during summer. It does not publish a fixed duration or frequency on the reviewed page, so check the exact flight before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-istanbul',
    airportSlug: 'london-gatwick',
    destinationSlug: 'istanbul',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Pegasus publishes daily direct Gatwick to Istanbul Sabiha Gokcen service; exact departure times vary',
    airlineSlugs: ['pegasus'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Gatwick Airport media centre: Pegasus daily London Gatwick-Istanbul launch announcement",
      sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/new-daily-flights-to-istanbul-from-london-gatwick-launch-with-pegasus-airlines-this-summer-2c983-40f32.html',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Gatwick Airport announced daily direct Pegasus service from London Gatwick to Istanbul Sabiha Gokcen in June 2026. The route guide preserves the airport distinction; Trip.com does not currently provide an exact airport-specific dateless handoff for this pair.',
    },
    airlineVerifications: [{
      airlineSlug: 'pegasus',
      status: 'verified',
      sourceName: "Gatwick Airport media centre: Pegasus daily London Gatwick-Istanbul launch announcement",
      sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/new-daily-flights-to-istanbul-from-london-gatwick-launch-with-pegasus-airlines-this-summer-2c983-40f32.html',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      effectivePeriod: 'Service launched summer 2026',
      supportedClaim: 'Confirms daily direct Pegasus service from London Gatwick to Istanbul Sabiha Gokcen.',
      remainingUncertainty: 'Exact departure times and date availability vary by schedule.',
    }],
    intro:
      'Gatwick Airport announced daily direct Pegasus service to Istanbul Sabiha Gokcen for summer 2026. Trip.com does not currently provide an exact airport-specific dateless handoff for this route, so check the airline and airport directly before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact airport, schedule, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-antalya',
    airportSlug: 'london-gatwick',
    destinationSlug: 'antalya',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Seasonal direct service is published by Jet2 and SunExpress; exact dates and frequency vary',
    airlineSlugs: ['jet2', 'sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Gatwick Airport Jet2 summer 2026 base announcement, corroborated by SunExpress's current flight plan",
      sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/london-gatwick-celebrates-arrival-of-jet2-becoming-airline-s-newest-airport-base-79203-40f32.html',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Gatwick Airport states Jet2 operates three weekly direct Antalya flights in its summer 2026 programme. SunExpress also lists London Gatwick-Antalya in its current seasonal flight plan. Exact dates, frequency and duration vary, and Trip.com remains blocked for this airport-specific pair.',
    },
    airlineVerifications: [
      {
        airlineSlug: 'jet2', status: 'verified', sourceName: "Gatwick Airport Jet2 summer 2026 base announcement", sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/london-gatwick-celebrates-arrival-of-jet2-becoming-airline-s-newest-airport-base-79203-40f32.html', verifiedDate: '2026-08-12', reviewDueDate: '2026-09-12', effectivePeriod: 'Summer 2026 programme', supportedClaim: 'Confirms three weekly direct Jet2 flights from Gatwick to Antalya in summer 2026.', remainingUncertainty: 'Exact dates and frequency vary by schedule.',
      },
      {
        airlineSlug: 'sunexpress', status: 'verified', sourceName: "SunExpress Summer 2026 flight plan", sourceUrl: 'https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf', verifiedDate: '2026-08-12', reviewDueDate: '2026-09-12', effectivePeriod: 'April-October 2026 published plan', supportedClaim: 'Lists London Gatwick-Antalya service in the current seasonal plan.', remainingUncertainty: 'Exact dates, frequency and duration can change within the season.',
      },
    ],
    intro:
      'Gatwick has published seasonal direct service to Antalya from Jet2 and SunExpress. Exact dates, frequency and duration vary by schedule, and Trip.com does not currently provide an exact airport-specific dateless handoff for this route.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact seasonal schedule, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-dalaman',
    airportSlug: 'london-gatwick',
    destinationSlug: 'dalaman',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Seasonal direct SunExpress service is published; exact dates and frequency vary',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "SunExpress official UK network material and Summer 2026 flight plan",
      sourceUrl: 'https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-named-official-airline-partner-of-crystal-palace-football-club/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress official UK network material states that London Gatwick has nonstop service to Dalaman, and its current seasonal plan includes the route. Exact dates, frequency and duration vary; Trip.com remains blocked for this airport-specific pair.',
    },
    airlineVerifications: [{
      airlineSlug: 'sunexpress', status: 'verified', sourceName: "SunExpress official UK network material and Summer 2026 flight plan", sourceUrl: 'https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-named-official-airline-partner-of-crystal-palace-football-club/', verifiedDate: '2026-08-12', reviewDueDate: '2026-09-12', effectivePeriod: 'Current seasonal UK network / summer 2026 plan', supportedClaim: 'Confirms nonstop SunExpress London Gatwick-Dalaman service.', remainingUncertainty: 'Exact dates, frequency and duration vary by schedule.',
    }],
    intro:
      'SunExpress publishes seasonal nonstop service from Gatwick to Dalaman. Exact dates, frequency and duration vary by schedule, and Trip.com does not currently provide an exact airport-specific dateless handoff for this route.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact seasonal schedule, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-bodrum',
    airportSlug: 'london-gatwick',
    destinationSlug: 'bodrum',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'SunExpress publishes twice-weekly direct summer 2026 service; exact operating days vary',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'SunExpress official Summer 2026 UK network announcement',
      sourceUrl: 'https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-expands-uk-route-network-for-summer-2026-with-launch-of-services-from-east-midlands/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress announces twice-weekly direct London Gatwick-Bodrum service for summer 2026. Exact operating days and duration vary, and Trip.com remains blocked for this airport-specific pair.',
    },
    airlineVerifications: [{
      airlineSlug: 'sunexpress', status: 'verified', sourceName: 'SunExpress official Summer 2026 UK network announcement', sourceUrl: 'https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-expands-uk-route-network-for-summer-2026-with-launch-of-services-from-east-midlands/', verifiedDate: '2026-08-12', reviewDueDate: '2026-09-12', effectivePeriod: 'Summer 2026 programme', supportedClaim: 'Confirms twice-weekly direct SunExpress service from London Gatwick to Bodrum.', remainingUncertainty: 'Exact operating days and duration vary by schedule.',
    }],
    intro:
      'SunExpress publishes twice-weekly direct London Gatwick-Bodrum service for summer 2026. Check the exact operating day and itinerary before booking; Trip.com does not currently provide an exact airport-specific dateless handoff for this route.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-izmir',
    airportSlug: 'london-gatwick',
    destinationSlug: 'izmir',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Seasonal direct SunExpress service is listed in the April-October 2026 plan; exact frequency varies',
    airlineSlugs: ['sunexpress'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'SunExpress official Summer 2026 flight plan',
      sourceUrl: 'https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'SunExpress lists London Gatwick-Izmir service in its April-October 2026 seasonal plan. No fixed frequency or duration is published in the reviewed evidence, and Trip.com remains blocked for this airport-specific pair.',
    },
    airlineVerifications: [{
      airlineSlug: 'sunexpress', status: 'verified', sourceName: 'SunExpress official Summer 2026 flight plan', sourceUrl: 'https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf', verifiedDate: '2026-08-12', reviewDueDate: '2026-09-12', effectivePeriod: 'April-October 2026 published plan', supportedClaim: 'Lists seasonal direct SunExpress service from London Gatwick to Izmir.', remainingUncertainty: 'Exact frequency, dates and duration vary by schedule.',
    }],
    intro:
      'SunExpress lists seasonal direct London Gatwick-Izmir service in its April-October 2026 plan. Exact dates, frequency and duration vary by schedule, and Trip.com does not currently provide an exact airport-specific dateless handoff for this route.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the seasonal schedule, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-marrakech',
    airportSlug: 'manchester',
    destinationSlug: 'marrakech',
    flightTime: 'Published flight time: 4h from Manchester Airport; check the exact flight for your dates',
    frequency: 'Current direct options are published by Manchester Airport and Jet2; exact dates and frequency vary',
    airlineSlugs: ['jet2'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Jet2's current Manchester–Marrakech booking page, corroborated by Manchester Airport's destination guide",
      sourceUrl: 'https://www.jet2.com/en/cheap-flights/manchester/marrakech',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Jet2 currently publishes Manchester–Marrakech flight options, and Manchester Airport lists Marrakesh as a destination with a published four-hour flight time. Exact dates, operating days and timings vary by schedule.',
    },
    intro:
      'Current airline and airport evidence supports direct Manchester–Marrakech service. Manchester Airport publishes a four-hour planning figure and Jet2 shows current route options, but exact dates, operating days and timings vary, so check your itinerary before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'bristol-marrakech',
    airportSlug: 'bristol',
    destinationSlug: 'marrakech',
    flightTime: 'Published duration not listed by Bristol Airport; check the exact flight for your dates',
    frequency: 'Bristol Airport publishes up to four flights a week and describes the service as year-round; exact operating days vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Bristol Airport's current Marrakech destination page",
      sourceUrl: 'https://www.bristolairport.co.uk/where-can-i-fly/destinations/africa/morocco/marrakech/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Bristol Airport currently publishes Marrakech service of up to four flights a week and describes it as year-round. The reviewed page does not establish a fixed operator, duration or exact operating days.',
    },
    intro:
      'Bristol Airport currently lists direct Marrakech service, with up to four flights a week and year-round availability stated on its destination page. Exact operating days, airline and duration remain date-specific, so check your flight before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-marrakech',
    airportSlug: 'london-gatwick',
    destinationSlug: 'marrakech',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Gatwick publishes direct Marrakech service; exact airlines, dates and frequency vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "London Gatwick's published Africa route table and current flight information",
      sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/london-gatwick-grows-african-connectivity-with-only-uk-to-uganda-service-a35e1-40f32.html',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Gatwick publishes direct Marrakech service in its Africa route table, and its current flight information shows Marrakech departures. Exact operators, dates, frequency and duration vary; Trip.com remains unavailable for an airport-specific dateless handoff.',
    },
    intro:
      'London Gatwick publishes direct service to Marrakech. The airport evidence does not establish one fixed operator, frequency or duration for every date, so check the exact flight before booking. Trip.com does not currently provide an airport-specific dateless handoff for Gatwick.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-agadir',
    airportSlug: 'manchester',
    destinationSlug: 'agadir',
    flightTime: 'Published flight time: 3h 55m from Manchester Airport; individual flights can differ',
    frequency: 'Direct service is currently published by Manchester Airport and airline booking pages; exact dates and frequency vary',
    airlineSlugs: ['jet2', 'easyjet'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Manchester Airport's current Agadir destination guide, corroborated by Jet2 and easyJet booking pages",
      sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/agadir/',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Manchester Airport publishes a 3h55 flight-time figure for Agadir. Current Jet2 and easyJet booking pages show Manchester–Agadir options, while Manchester Airport route material describes direct service. Exact dates, operators, frequency and timings vary by schedule.',
    },
    intro:
      'Current airport and airline evidence supports direct Manchester–Agadir service. Manchester Airport publishes a 3h55 planning figure, but exact dates, operating airline and timing vary, so check the full itinerary before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'birmingham-agadir',
    airportSlug: 'birmingham',
    destinationSlug: 'agadir',
    flightTime: 'Approximate published flight time: 3h 30m from Birmingham Airport',
    frequency: 'Direct service is listed by Birmingham Airport; exact dates and frequency vary by schedule',
    airlineSlugs: ['ryanair', 'easyjet'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Birmingham Airport's current Agadir destination page and 2026 route announcement",
      sourceUrl: 'https://www.birminghamairport.co.uk/destinations/where-we-fly/agadir/?searchresult=true',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Birmingham Airport lists direct Ryanair service and an approximate 3h30 flight time; its April 2026 announcement also confirms a new direct easyJet service for winter 2026. Exact operating dates, frequency and airline availability vary by schedule.',
    },
    intro:
      'Birmingham Airport currently lists direct Agadir service and publishes an approximate flight time of 3h30. Ryanair is listed on the destination page, while a new easyJet service is announced for winter 2026. Check the exact date and airline before booking.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-agadir',
    airportSlug: 'london-gatwick',
    destinationSlug: 'agadir',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Gatwick publishes direct Agadir service; exact operators, dates and frequency vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "London Gatwick's published Africa route table",
      sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/london-gatwick-grows-african-connectivity-with-only-uk-to-uganda-service-a35e1-40f32.html',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Gatwick publishes direct Agadir service in its Africa route table. The reviewed evidence does not establish a fixed operator, duration or date pattern for every itinerary; Trip.com remains unavailable for an airport-specific dateless handoff.',
    },
    intro:
      'London Gatwick publishes direct service to Agadir. Exact operators, dates, frequency and duration vary by schedule, so check the specific flight before booking. Trip.com does not currently provide an airport-specific dateless handoff for Gatwick.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-heathrow-casablanca',
    airportSlug: 'london-heathrow',
    destinationSlug: 'casablanca',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Royal Air Maroc publishes Heathrow–Casablanca options; exact dates and frequency vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Royal Air Maroc's current London–Casablanca booking page, corroborated by Heathrow's airline/terminal listing",
      sourceUrl: 'https://www.royalairmaroc.com/en_gb/flights-from-london-to-casablanca',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Royal Air Maroc currently publishes London Heathrow–Casablanca flight options, and Heathrow lists Royal Air Maroc operating Casablanca from Terminal 4. Exact dates, frequency, duration and itinerary details must be checked before booking; Trip.com remains blocked for an airport-specific dateless handoff.',
    },
    intro:
      'Royal Air Maroc currently publishes London Heathrow–Casablanca options, with Heathrow identifying Casablanca as a Royal Air Maroc destination from Terminal 4. Check the exact date, itinerary, duration and fare before booking. Trip.com does not currently provide an airport-specific dateless handoff for Heathrow.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-tangier',
    airportSlug: 'london-gatwick',
    destinationSlug: 'tangier',
    flightTime: 'Published duration not recorded in this evidence check; check the exact flight for your dates',
    frequency: 'Gatwick publishes direct Tangier service; exact operators, dates and frequency vary',
    airlineSlugs: [],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "London Gatwick's published Africa route table",
      sourceUrl: 'https://www.mediacentre.gatwickairport.com/news/london-gatwick-grows-african-connectivity-with-only-uk-to-uganda-service-a35e1-40f32.html',
      verifiedDate: '2026-08-12',
      reviewDueDate: '2026-09-12',
      note: 'Gatwick publishes direct Tangier service in its Africa route table. The reviewed evidence does not establish a fixed operator, duration or date pattern for every itinerary; Trip.com remains unavailable for an airport-specific dateless handoff.',
    },
    intro:
      'London Gatwick publishes direct service to Tangier. Exact operators, dates, frequency and duration vary by schedule, so check the specific flight before booking. Trip.com does not currently provide an airport-specific dateless handoff for Gatwick.',
    bookingWindowNote:
      'This guide is route context, not a booking prediction. Check the exact service, duration, fare conditions and baggage terms before booking.',
    peakPeriodIds: [],
  },
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
      verifiedDate: '2026-08-14',
      reviewDueDate: '2026-09-14',
      note: 'Re-verified on 14 August 2026 against Manchester Airport\'s current media-centre route announcement: Pakistan International Airlines adds Lahore as its second direct Manchester destination from 3 July 2026. This confirms direct status, PIA as operator and the launch date. The source does not establish a current frequency, so frequency remains unpublished. PIA\'s own site was also checked for corroboration but does not publish a Lahore–Manchester schedule detail.',
    },
    intro:
      'The flagship Pakistan corridor from the North of England. PIA runs direct Manchester to Lahore services (confirmed via Manchester Airport\'s own announcement, launched 3 July 2026) — a direct service for the North West\'s Punjabi community, avoiding a Gulf connection, an extra layover, and a transfer point where baggage could go astray.',
    bookingWindowNote:
      'Outside Eid and the summer school holidays, this window tends to be less pressured. Fares on peak-period routes often move in the final weeks before Eid — if your dates are fixed, aim to book at least 3 months ahead. Planning guidance, not a fare prediction.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays', 'wedding-season'],
  },
  {
    slug: 'manchester-islamabad',
    airportSlug: 'manchester',
    destinationSlug: 'islamabad',
    flightTime: '7h 45m direct',
    frequency: 'PIA currently describes Islamabad–Manchester as 2 weekly; exact current schedule should be checked',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: "Manchester Airport's own media centre: \"Hundreds of thousands of people to benefit as Pakistan International Airlines launches new route from Manchester Airport\" (mediacentre.manchesterairport.co.uk, 6 Oct 2025), corroborated by Manchester Airport's 19 May 2026 article describing the route as an ongoing \"successful\" service",
      sourceUrl: 'https://mediacentre.manchesterairport.co.uk/hundreds-of-thousands-of-people-to-benefit-as-pakistan-international-airlines-launches-new-route-from-manchester-airport/',
      verifiedDate: '2026-08-14',
      reviewDueDate: '2026-09-14',
      note: 'Re-verified on 14 August 2026 against PIA\'s current official homepage/news content, which describes the Islamabad–Manchester service as 2 weekly, and Manchester Airport\'s current operator information. This confirms direct status and PIA as operator. The exact operating days beyond the published 2-weekly statement and any later frequency increase remain unconfirmed, so no stronger schedule claim is made.',
    },
    intro:
      'Manchester to Islamabad direct services (confirmed via Manchester Airport\'s own announcement, launched 25 October 2025) are the practical choice for families based across Yorkshire, Lancashire and the wider North West heading to Punjab or onward to Khyber Pakhtunkhwa.',
    bookingWindowNote:
      'The pattern is similar to the Lahore route: less pressured pricing most of the year, with fares often rising close to Eid and major family events. This route also runs fewer weekly frequencies than Lahore, so seats can fill faster in peak weeks.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
  },
  {
    slug: 'london-heathrow-delhi',
    airportSlug: 'london-heathrow',
    destinationSlug: 'delhi',
    flightTime: '8h 45m direct',
    frequency: 'British Airways: up to 3 daily direct; other operators require separate confirmation',
    airlineSlugs: ['virgin-atlantic', 'british-airways', 'air-india'],
    isDirect: true,
    airlineVerifications: [
      {
        airlineSlug: 'british-airways',
        status: 'verified',
        sourceName: 'British Airways official India destination page and March 2026 network update',
        sourceUrl: 'https://www.britishairways.com/content/flights/india',
        verifiedDate: '2026-07-28',
        reviewDueDate: '2026-08-28',
        effectivePeriod: 'Current at access; winter 2026 update',
        supportedClaim: 'Confirms direct Heathrow-Delhi service. British Airways current India guidance names Delhi from London Heathrow, and its March 2026 update says Delhi continues three times daily.',
        remainingUncertainty: 'Virgin Atlantic and Air India require separate current airline evidence and are not presented as verified here.',
      },
    ],
    intro:
      'British Airways currently markets direct Heathrow to Delhi service, with its current network update stating Delhi continues three times daily. Other airlines may also appear in search results, but JetStash has not independently verified their current operation here.',
    bookingWindowNote:
      'Diwali and the December to January window are the two demand spikes that matter most. Outside those, February to April and September to October tend to be better value.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-amritsar',
    airportSlug: 'birmingham',
    destinationSlug: 'amritsar',
    flightTime: '14h 45m via connection (Air India booking page)',
    frequency: 'Connection options available; exact schedule varies',
    airlineSlugs: ['air-india'],
    isDirect: false,
    intro:
      'Air India\'s current Birmingham to Amritsar booking page does not list a direct flight and shows connection-based options. Check the live itinerary for the actual hub, duration and baggage conditions before booking.',
    bookingWindowNote:
      'Because this is a connection route, compare the full itinerary rather than relying on a headline duration. The airline\'s booking result and your exact dates should decide the viable option.',
    peakPeriodIds: ['baisakhi', 'diwali', 'uk-summer-holidays'],
  },
  {
    slug: 'manchester-dubai',
    airportSlug: 'manchester',
    destinationSlug: 'dubai',
    flightTime: '8h direct (Emirates route page)',
    frequency: '21 flights per week (Emirates; seasonal variation possible)',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Emirates official Manchester-Dubai route page',
      sourceUrl: 'https://www.emirates.com/uk/english/destinations/man/dxb/flights-from-manchester-to-dubai/',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Emirates current route information states 21 flights per week and an 8-hour flight duration; both can vary by season.',
    },
    intro:
      'Emirates operates a direct Manchester to Dubai service, with connecting alternatives available via Gulf carriers flying from other UK airports.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. Winter, when UK schools are off, tends to carry the clearest premium; outside that, this route is generally less pressured.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'london-heathrow-doha',
    airportSlug: 'london-heathrow',
    destinationSlug: 'doha',
    flightTime: 'Direct; duration varies by schedule',
    frequency: 'Regular direct service; exact frequency varies',
    airlineSlugs: ['qatar-airways'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Qatar Airways official London-Doha booking route',
      sourceUrl: 'https://www.qatarairways.com/en-sa/destinations/flights-to-doha/from-london.html',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Qatar Airways maps London Heathrow (LHR) to Doha (DOH) on its current booking route and exposes a direct-flight question; exact frequency and duration are not stated here.',
    },
    intro:
      'Qatar Airways currently offers a direct London Heathrow to Doha booking route. Doha is also a major onward hub, but connection choices and timings should be checked against the live itinerary.',
    bookingWindowNote:
      'High frequency means more fare classes open at once, so comparing departure times on the same day can turn up meaningfully different prices. Ramadan shifts the pace of travel through this hub, but it doesn\'t move the price the way it does on the Jeddah and Madinah routes.',
    peakPeriodIds: ['uk-summer-holidays', 'christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'london-heathrow-jeddah',
    airportSlug: 'london-heathrow',
    destinationSlug: 'jeddah',
    flightTime: '6h 15m direct (per BA\'s own destination page)',
    frequency: 'British Airways and Saudia have current direct-service evidence; exact frequency should be checked for the travel date',
    airlineSlugs: ['saudia', 'british-airways'],
    isDirect: true,
    airlineVerifications: [
      {
        airlineSlug: 'british-airways',
        status: 'verified',
        sourceName: "British Airways' own current destination/booking page, \"Direct Flights to Jeddah Deals (JED) 2026 | Book now with BA\" (britishairways.com/content/flights/saudi-arabia/jeddah) — live and current at time of access, presenting Jeddah as an active BA destination with a working flight-search widget, cabin options and a stated 6h15m flight time.",
        sourceUrl: 'https://www.britishairways.com/content/flights/saudi-arabia/jeddah',
        verifiedDate: '2026-08-14',
        reviewDueDate: '2026-09-14',
        effectivePeriod: 'Current at access',
        supportedClaim: 'Confirms BA publicly markets and sells direct Heathrow–Jeddah flights. Does not state a current frequency, and BA\'s own schedule-search tool could not be made to render this session (a recurring cookie-consent technical-issue block), so none is published.',
        remainingUncertainty: 'A specific secondary source (Head for Points, 10 Apr 2026) claims BA terminated this route on 24 April 2026 — unreconciled with BA\'s current destination page and Heathrow\'s current route material. Treated as a genuine, disclosed conflict, not resolved either way — see docs/LAUNCH_BLOCKERS.md TR-010.',
      },
      {
        airlineSlug: 'saudia',
        status: 'verified',
        sourceName: 'Heathrow\'s current official route page, "Fly direct from Heathrow to Saudi Arabia"',
        sourceUrl: 'https://www.heathrow.com/heathrow-blog/fly-direct-from-heathrow-to-saudi-arabia',
        verifiedDate: '2026-08-14',
        reviewDueDate: '2026-09-14',
        effectivePeriod: 'Current at access on 14 August 2026',
        supportedClaim: 'Heathrow states that direct Heathrow–Jeddah flights are current and identifies Saudia with up to 2 daily Jeddah flights. This independently verifies Saudia\'s direct route evidence without relying on the BA record.',
        remainingUncertainty: 'Exact Saudia operating dates for a particular itinerary should still be checked. The separate BA conflict remains disclosed above.',
      },
    ],
    intro:
      'The primary direct Umrah arrival route from the UK. British Airways and Saudia both have current primary-source direct-service evidence, although the BA record retains a disclosed conflict with a secondary withdrawal report. Check the exact airline and date before booking. Most flight-inclusive Umrah packages are built around the Jeddah corridor, with onward ground transport to Makkah.',
    bookingWindowNote:
      'Ramadan and the weeks immediately before Hajj season are typically the highest-demand windows on this route. Outside them, pricing tends to be calmer.',
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
      note: 'PIA\'s current public material highlights the resumed Islamabad–Manchester service and Heathrow operations for Islamabad/Lahore, but does not publish a current route-specific direct Manchester–Karachi claim. Birmingham Airport is not the relevant origin here, and no qualifying primary source currently confirms this route. It may connect via Islamabad or Lahore instead. Kept unverified pending a route-specific PIA or airport schedule source; re-check PIA\'s booking system directly.',
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
      note: 'PIA\'s current public material identifies Lahore service to London Heathrow and the resumed Islamabad–Manchester service, but does not publish a current Birmingham–Lahore direct claim. Birmingham Airport\'s live destination directory also does not list Lahore. That absence is not treated as proof that no flight can ever be sold, so the route remains unverified pending a route-specific PIA or airport schedule source; check PIA\'s booking system before assuming a direct service.',
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
      note: 'Current secondary reporting conflicts on Birmingham–Islamabad. PIA\'s current public homepage confirms the resumed Islamabad–Manchester service, while its Heathrow notice covers Islamabad/Lahore; neither publishes a Birmingham–Islamabad direct claim. Birmingham Airport\'s live destination directory does not list Islamabad. This is still insufficient to prove cancellation, so the route remains unverified pending a route-specific PIA or airport schedule source rather than being resolved from secondary sources.',
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
        verifiedDate: '2026-08-14',
        reviewDueDate: '2026-09-14',
        effectivePeriod: 'Current as of the page\'s own "Last updated: 1 July 2026" stamp',
        supportedClaim: 'Confirms BA flies direct London Heathrow/Gatwick to Mumbai among 5 India destinations. Does NOT confirm a Mumbai-specific frequency — the page states only an aggregate "up to 70 flights from the UK a week" across all 5 cities combined.',
        remainingUncertainty: 'The previously published "3 daily BA" figure came from a 1 Jun 2025 press release and is not reconfirmed by any current source — removed from public copy. Mumbai-specific BA frequency is unconfirmed.',
      },
      {
        airlineSlug: 'air-india',
        status: 'verified',
        sourceName: 'Air India\'s own newsroom press release, "Air India elevates Mumbai-London Heathrow services with brand-new B787-9..." (airindia.com), dated 1 Jul 2026',
        sourceUrl: 'https://www.airindia.com/in/en/newsroom/press-release/Air-India-elevates-Mumbai-London-Heathrow-services-with-brand-new-B787-9-featuring-new-premium-cabins.html',
        verifiedDate: '2026-08-14',
        reviewDueDate: '2026-09-14',
        effectivePeriod: 'Effective 1 Jul 2026 (press release\'s own effective date)',
        supportedClaim: 'Confirms flights AI131/AI130 on the new Boeing 787-9, and explicitly states "Air India\'s second daily service between Mumbai and London Heathrow will continue to be served by its... Boeing 777-300ER" — i.e. two daily Air India flights, both named.',
        remainingUncertainty: 'None significant — this is a dated, current, airline-issued primary source naming both daily flight numbers.',
      },
      {
        airlineSlug: 'virgin-atlantic',
        status: 'verified',
        sourceName: "Virgin Atlantic's own Mumbai destination page (virginatlantic.com/where-we-fly/asia/india/mumbai)",
        sourceUrl: 'https://www.virginatlantic.com/where-we-fly/asia/india/mumbai',
        verifiedDate: '2026-08-14',
        reviewDueDate: '2026-09-14',
        effectivePeriod: 'Current at access',
        supportedClaim: 'States directly: "We fly direct to Mumbai twice a day" — confirms 2x daily Heathrow–Mumbai.',
        remainingUncertainty: 'None significant for the frequency claim itself.',
      },
    ],
    intro:
      'Heathrow to Mumbai has genuine multi-carrier competition. Air India and Virgin Atlantic each confirmed via their own current sources to run twice daily; British Airways also operates the route direct, though its exact daily count isn\'t separately confirmed. With several carriers operating this route, compare the fare, itinerary and booking details for your own dates rather than booking the first result.',
    bookingWindowNote:
      'Less sensitive to booking window than the Punjab and Pakistan routes. Diwali and the December to January window remain the two periods when fares rise sharply, and February to April and September to October offer the most reliable value.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
  },
  {
    slug: 'london-heathrow-bengaluru',
    airportSlug: 'london-heathrow',
    destinationSlug: 'bengaluru',
    flightTime: "10h direct (Virgin Atlantic's own route page)",
    frequency: 'British Airways and Virgin Atlantic each independently confirmed daily direct via their own current sources; Air India is not verified — see note',
    airlineSlugs: ['british-airways', 'virgin-atlantic'],
    isDirect: true,
    airlineVerifications: [
      {
        airlineSlug: 'british-airways',
        status: 'verified',
        sourceName: 'British Airways\' own press release, "British Airways celebrates 20 years of connecting Bengaluru and London with launch of flash sale offering 20% off fares" (mediacentre.britishairways.com), dated 12 Nov 2025',
        sourceUrl: 'https://mediacentre.britishairways.com/pressrelease/details/24270',
        verifiedDate: '2026-07-30',
        reviewDueDate: '2026-08-30',
        effectivePeriod: 'As stated in the 12 Nov 2025 press release; not reconfirmed against a more recent source',
        supportedClaim: 'States directly: "The airline operates a daily service on its 777-200 fleet, connecting Bengaluru to London" and separately confirms the London airport as Heathrow specifically ("British Airways now operates daily flights from Kempegowda International Airport to London Heathrow"). Confirms daily direct Heathrow-Bengaluru service, operated (not merely sold) by British Airways, on a Boeing 777-200.',
        remainingUncertainty: 'The release gives no exact weekly flight count isolated to the Bengaluru route alone (it states an aggregate "56 direct flights each week" across five Indian cities combined) — no per-route weekly number is claimed here beyond "daily". Dated 12 Nov 2025; not independently reconfirmed against a more current British Airways source this session, since britishairways.com\'s own destination pages (as opposed to its press-release subdomain) remained unreachable to this session\'s tooling across 12 attempts total, this session and the prior one.',
      },
      {
        airlineSlug: 'virgin-atlantic',
        status: 'verified',
        sourceName: "Virgin Atlantic's own Bengaluru destination page (virginatlantic.com/where-we-fly/asia/india/bengaluru)",
        sourceUrl: 'https://www.virginatlantic.com/where-we-fly/asia/india/bengaluru',
        verifiedDate: '2026-07-30',
        reviewDueDate: '2026-08-30',
        effectivePeriod: 'Current at access; page carries no "last updated" date or effective period of its own',
        supportedClaim: 'States directly: "We fly to Bengaluru daily" from London Heathrow, with a stated flight time of 10 hours — confirms a daily direct service is currently marketed by Virgin Atlantic.',
        remainingUncertainty: 'The page does not disclose whether Virgin Atlantic operates every rotation itself or via a codeshare/joint-venture partner, and names no aircraft type or effective date — recorded as a sold/marketed daily direct service, not an operating-carrier guarantee on the same footing as British Airways\' explicit "the airline operates" wording above.',
      },
    ],
    intro:
      'British Airways and Virgin Atlantic each currently confirm, via their own primary sources, a daily direct London Heathrow to Bengaluru service — British Airways explicitly as its own operated 777-200 service (12 Nov 2025 press release), Virgin Atlantic via its own route page (10h stated flight time, operating detail not disclosed). Air India is not named here: its official pages give contradictory information about a direct London-Bengaluru service, and JetStash has not been able to resolve that contradiction against a current, unambiguous Air India primary source.',
    bookingWindowNote:
      'This is a newly added route guide with no JetStash-logged fare history yet. Compare current prices directly with the airline and check the live schedule before booking, rather than assuming a fixed booking window.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
  },
  {
    slug: 'london-heathrow-dhaka',
    airportSlug: 'london-heathrow',
    destinationSlug: 'dhaka',
    flightTime: 'Unverified — a current London-Dhaka Biman service is real, but whether it is nonstop is unconfirmed, see note',
    frequency: 'Unverified — confirm directly with Biman Bangladesh Airlines before booking',
    airlineSlugs: ['biman-bangladesh'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: "Heathrow's own live flight-tracking pages for flights BG201 and BG202, plus Heathrow's own airline-directory page for Biman Bangladesh Airlines",
      sourceUrl: 'https://www.heathrow.com/departures/terminal-3/flight-details/BG202',
      verifiedDate: '2026-07-30',
      reviewDueDate: '2026-08-13',
      note: 'Recheck (founder-directed): Heathrow\'s own site confirms live, current flight-tracking pages for named flight numbers BG201 and BG202 — real, current evidence this exact service operates, going beyond the previous airline-directory-only finding. Several independent flight-schedule aggregators (not treated as primary sources here, per this project\'s sourcing standard) consistently describe BG202 as making a scheduled stop at Sylhet. Biman\'s current official Manchester notice separately confirms that its Manchester-Dhaka service is via Sylhet, but neither source directly confirms or rules out a Sylhet stop on this specific Heathrow flight. Kept unverified: the safest accurate status given real evidence of current operation but no confirmed stop pattern either way — do not publish a "nonstop" claim, and do not publish a specific duration or frequency, until a genuine Biman or Heathrow route-specific primary source resolves this.',
    },
    intro:
      'Biman Bangladesh Airlines currently operates a real, live London Heathrow to Dhaka service — Heathrow\'s own flight-tracking system confirms named flights BG201 and BG202 — but no primary source directly confirms whether this service is nonstop or makes a scheduled stop at Sylhet. Several independent flight-schedule sources describe a Sylhet stop on this same flight, but this has not been confirmed against Biman\'s own site or a Heathrow route-specific source. Treat any "direct London to Dhaka" or "nonstop" claim seen elsewhere as unconfirmed until checked directly with the airline.',
    bookingWindowNote:
      'No JetStash-logged fare history exists for this route, and its exact stop pattern is unconfirmed. Check directly with Biman Bangladesh Airlines for the current routing and schedule before planning around any assumed booking window.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-dhaka',
    airportSlug: 'manchester',
    destinationSlug: 'dhaka',
    flightTime: 'One stop via Sylhet — not a nonstop service, per Biman\'s current official notice',
    frequency: 'Every Tuesday and Saturday, per Biman\'s current official notice',
    airlineSlugs: ['biman-bangladesh'],
    isDirect: false,
    verification: {
      status: 'verified',
      sourceName: 'Biman Bangladesh Airlines current official notice: "BIMAN BANGLADESH AIRLINES WILL RESUME DHAKA-MANCHESTER-DHAKA (VIA SYLHET) FLIGHTS FROM 01 JULY 2026 (EVERY TUESDAY & SATURDAY)."',
      sourceUrl: 'https://biman-airlines.com/',
      verifiedDate: '2026-07-30',
      reviewDueDate: '2026-08-30',
      note: 'Biman\'s current official notice says: "BIMAN BANGLADESH AIRLINES WILL RESUME DHAKA-MANCHESTER-DHAKA (VIA SYLHET) FLIGHTS FROM 01 JULY 2026 (EVERY TUESDAY & SATURDAY)." This supports the connecting, one-stop-via-Sylhet route pattern and the Tuesday/Saturday schedule. The notice does not identify aircraft, terminal or transfer arrangements, so JetStash makes no claim about them. Given this route\'s documented history of suspension and relaunch, confirm the live schedule directly with Biman before booking and re-check this record on its review date.',
    },
    intro:
      "Manchester to Dhaka is a connecting journey with one stop via Sylhet, not a nonstop service. Biman Bangladesh Airlines' current official notice says this route resumed from 1 July 2026 and operates every Tuesday and Saturday. The notice does not establish aircraft, terminal or transfer arrangements, and this service has a documented history of suspension and relaunch — confirm the live routing and schedule directly with Biman before booking.",
    bookingWindowNote:
      'This route\'s service history has been too unstable for a reliable booking-window pattern. If currently operating, confirm the live schedule and exact stop pattern directly with Biman Bangladesh Airlines before booking, especially around Eid, when demand and disruption risk both rise.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
  },
  {
    slug: 'manchester-sylhet',
    airportSlug: 'manchester',
    destinationSlug: 'sylhet',
    flightTime: 'Unverified — Manchester Airport\'s own current page says this destination is not currently served, see note',
    frequency: 'Historically up to 3x weekly when operating; Manchester Airport\'s own current page contradicts recent resumption reporting — see note',
    airlineSlugs: ['biman-bangladesh'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: "Manchester Airport's own current Sylhet destination page (manchesterairport.co.uk/destinations-and-guides/sylhet/), directly fetched, set against Biman Bangladesh Airlines' current official Manchester-Dhaka-via-Sylhet notice",
      sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/sylhet/',
      verifiedDate: '2026-07-30',
      reviewDueDate: '2026-08-13',
      note: 'A genuine, current, directly-fetched contradiction, not a stale or secondary one: Manchester Airport\'s own Sylhet destination page states plainly, "We\'re not flying to this location at the moment, but check back soon for updates!" Biman\'s current official notice says its Dhaka-Manchester-Dhaka flights operate via Sylhet every Tuesday and Saturday. Neither source explains whether that via-Sylhet stop is separately bookable or listed by Manchester Airport as a standalone destination. Kept Verification Pending rather than resolved either way until a source addresses this specific gap. Given the live contradiction, this record carries a shorter review window than the routes.ts default.',
    },
    intro:
      'Manchester to Sylhet sits on a genuine, currently unresolved contradiction between two directly-checked sources: Manchester Airport\'s own Sylhet page states it is "not flying to this location at the moment", while Biman\'s current official notice says its Manchester-Dhaka service operates via Sylhet every Tuesday and Saturday. It is possible Manchester Airport does not list a via-Sylhet stop as a standalone destination, but that has not been confirmed. Given the service\'s documented history of suspension and relaunch, check the current routing and stop pattern directly with Biman before booking or assuming Sylhet is reachable from Manchester on its own ticket.',
    bookingWindowNote:
      'This route\'s service history has been too unstable for a reliable booking-window pattern. If currently operating, confirm the live schedule and exact stop pattern directly with Biman Bangladesh Airlines before booking, especially around Eid, when demand and disruption risk both rise.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
  },
  {
    slug: 'london-heathrow-sylhet',
    airportSlug: 'london-heathrow',
    destinationSlug: 'sylhet',
    flightTime: 'Unverified — no confirmed Sylhet-specific service, see note',
    frequency: 'Unverified — confirm directly with Biman Bangladesh Airlines before booking',
    airlineSlugs: ['biman-bangladesh'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: "Heathrow's own live flight-tracking page for flight BG202, plus multiple independent flight-schedule aggregators describing BG202 as routing via Sylhet",
      sourceUrl: 'https://www.heathrow.com/departures/terminal-3/flight-details/BG202',
      verifiedDate: '2026-07-30',
      reviewDueDate: '2026-08-13',
      note: 'Added this session (founder-directed correction: the earlier "zero evidence" rejection was inaccurate — real signal exists, even if not yet primary-source-confirmed). Heathrow\'s own site confirms live, current flight-tracking pages for BG201 and BG202 — real evidence of a currently operating London-Dhaka Biman service. Several independent flight-schedule aggregators (flightmapper.net, Skyscanner, FlightsFrom.com and others — not treated as primary sources here, per this project\'s sourcing standard) consistently describe BG202 as making a scheduled stop at Sylhet, and some describe London-Sylhet as a separately bookable itinerary on that same flight. Biman\'s current official Manchester notice separately confirms a Manchester-Dhaka service via Sylhet, but neither that notice nor a Heathrow primary source confirms the stop or schedule for this Heathrow service. Held as Verification Pending rather than added as confirmed or excluded outright: real signal, not yet primary-source-proof. Do not publish a specific duration, frequency or stop-pattern claim until a genuine Biman or Heathrow route-specific source resolves this.',
    },
    intro:
      "Biman Bangladesh Airlines currently operates a real, live London Heathrow to Dhaka service — Heathrow's own flight-tracking system confirms named flight BG202 — and independent flight-schedule sources describe a possible Sylhet stop, with some describing London-Sylhet as separately bookable. JetStash has not been able to confirm this Sylhet stop, or any Heathrow-Sylhet-specific schedule, against a genuine Biman or Heathrow primary source, so no duration, frequency or booking guidance is published here. Check directly with Biman Bangladesh Airlines for the current routing before booking.",
    bookingWindowNote:
      'No JetStash-logged fare history exists for this route, and the underlying schedule itself is unconfirmed. Check directly with Biman Bangladesh Airlines for the current routing and schedule before planning around any assumed booking window.',
    peakPeriodIds: [],
  },
  {
    slug: 'manchester-doha',
    airportSlug: 'manchester',
    destinationSlug: 'doha',
    flightTime: 'Under 7h direct (Qatar Airways route page)',
    frequency: 'Regular direct service; exact frequency varies',
    airlineSlugs: ['qatar-airways'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Qatar Airways official Manchester-Doha booking route',
      sourceUrl: 'https://www.qatarairways.com/en-az/destinations/flights-to-doha/from-manchester.html',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Qatar Airways states that regular direct flights from Manchester to Doha take less than seven hours; exact frequency varies by schedule.',
    },
    intro:
      'Qatar Airways offers a regular direct service from Manchester to Doha, giving the North of England access to the Gulf without travelling to London first. It works both as a destination and as a connecting gateway onward.',
    bookingWindowNote:
      'High frequency on this route means more fare classes open at once. UK school holidays carry the clearest premium; outside those windows, this route is generally less pressured than the South Asia routes.',
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
      'There is no current direct Manchester to Jeddah service. Qatar Airways\' connecting itinerary via Doha is the most consistent option, using the same regular Manchester to Doha service that operates as a standalone route in its own right.',
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
    flightTime: '7h 40m direct (Emirates route page)',
    frequency: '7 flights per week (Emirates; seasonal variation possible)',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Emirates official Glasgow-Dubai route page',
      sourceUrl: 'https://www.emirates.com/english/destinations/gla/dxb/flights-from-glasgow-to-dubai/',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Emirates current route page states 7 flights per week and an approximately 7h40m outbound duration; schedules can vary.',
    },
    intro:
      'Emirates\' Glasgow to Dubai service is Scotland\'s longest-established direct long-haul route, giving the West of Scotland genuine non-stop access to the Gulf without travelling south first.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. UK school holidays and the winter months carry the clearest premium; outside those, fares are comparatively stable year-round.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'edinburgh-dubai',
    airportSlug: 'edinburgh',
    destinationSlug: 'dubai',
    flightTime: '7h 55m direct (Emirates route page)',
    frequency: '7 flights per week (Emirates; seasonal variation possible)',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Emirates official Edinburgh-Dubai route page',
      sourceUrl: 'https://www.emirates.com/uk/english/destinations/edi/dxb/flights-from-edinburgh-to-dubai/',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Emirates current route page states 7 flights per week and approximately 7h55m outbound duration; schedules can vary.',
    },
    intro:
      'Emirates operates a direct Edinburgh to Dubai service after a four-year gap, giving Scotland\'s capital a long-haul gateway independent of Glasgow. Both Scottish airports are worth comparing on the same dates, because schedules and fares can differ.',
    bookingWindowNote:
      'As one of two regular Scotland to Dubai options, fares here are comparatively stable outside UK school holidays. Worth comparing against the Glasgow service on the same dates before booking, since operating days and pricing can differ between the two.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'newcastle-dubai',
    airportSlug: 'newcastle',
    destinationSlug: 'dubai',
    flightTime: '7h 50m direct',
    frequency: '6 flights per week (Emirates; seasonal variation possible)',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Emirates official Newcastle-Dubai route page',
      sourceUrl: 'https://www.emirates.com/english/destinations/ncl/dxb/flights-from-newcastle-to-dubai/',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Emirates current route page states 6 flights per week and approximately 7h50m duration; schedules can vary by season.',
    },
    intro:
      'Emirates\' Newcastle to Dubai service gives the North East genuine long-haul access to the Gulf without the drive to Manchester, and it doubles as a connecting gateway onward to South Asia.',
    bookingWindowNote:
      'Comparatively stable pricing outside UK school holidays. For onward South Asia connections via Dubai, book the connecting leg as part of the same itinerary rather than as separate tickets, to protect against missed-connection risk.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'london-gatwick-ahmedabad',
    airportSlug: 'london-gatwick',
    destinationSlug: 'ahmedabad',
    flightTime: 'Direct; check the live schedule for duration',
    frequency: '3x weekly direct',
    airlineSlugs: ['air-india'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Air India official UK network update',
      sourceUrl: 'https://www.airindia.com/content/air-india/in/en/newsroom/press-release/Air-India-expands-UK-connectivity-this-winter-with-fourth-daily-flight.html',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Air India states that Ahmedabad-London services returned to London Gatwick at 3x weekly; exact flight duration should be checked in the live booking result.',
    },
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
    flightTime: 'Direct; check the live schedule for duration',
    frequency: 'Non-stop service shown by Air India; exact operating days vary',
    airlineSlugs: ['air-india'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Air India official London-Amritsar booking route',
      sourceUrl: 'https://www.airindia.com/en-in/book-flights/london-to-amritsar-flights',
      verifiedDate: '2026-07-28',
      reviewDueDate: '2026-08-28',
      note: 'Air India current booking results identify London Gatwick (LGW) to Amritsar (ATQ) as a nonstop route; exact operating days and duration vary by schedule.',
    },
    intro:
      'Air India runs a direct Gatwick to Amritsar service. If you are starting in the Midlands, compare it with the connection options from Birmingham on your exact dates rather than assuming the two airports offer the same routing.',
    bookingWindowNote:
      'This service does not operate daily. Confirm the specific flight day before booking, and compare Gatwick with the connection options from Birmingham for your travel dates rather than assuming either airport offers the same routing.',
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
      'Diwali and the December to January window are the two periods when fares often rise on this route. This is a single-airline direct service, so it\'s worth comparing against the well-established one-stop Gulf-carrier options on price and schedule regardless of season.',
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
      'Diwali and the December to January window are the two periods when fares often rise on this route. The well-established one-stop Gulf-carrier options below run far more frequently and are worth comparing on price and convenience regardless of season, since this is a single-airline direct service.',
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
      'There is no direct Manchester to Amritsar service. Qatar Airways\' one-stop routing via Doha is currently the shortest one-stop option, at around 13h 20m total, though other one-stop combinations via Delhi or London add meaningfully to journey time. Birmingham and Gatwick both have genuine direct Amritsar services, worth comparing against a Manchester connection if either is within reasonable travelling distance.',
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
      'Manchester once had a direct Saudia service to Madinah, but it doesn\'t currently operate. Turkish Airlines\' one-stop routing via Istanbul is currently the shortest one-stop option, at around 9h 15m total. EgyptAir via Cairo and Royal Jordanian via Amman are the other commonly used alternatives.',
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
  {
    slug: 'manchester-barcelona', airportSlug: 'manchester', destinationSlug: 'barcelona',
    flightTime: 'Published planning duration: 2h 30m; check the exact flight for your dates',
    frequency: 'Manchester Airport lists direct service; exact operators, dates and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Manchester Airport's official Barcelona destination guide", sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/barcelona/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Manchester Airport lists Barcelona as a direct destination and publishes a 2h30m flight-time planning figure. Exact operator, operating days and duration should be checked for the selected flight.' },
    intro: 'Manchester Airport lists direct service to Barcelona and publishes a 2h30m planning figure. Operators, operating days and the exact duration vary by flight, so check your dates before booking.',
    bookingWindowNote: 'Check the exact operating airline, departure time, fare conditions and baggage terms for your dates before booking.', peakPeriodIds: [],
  },
  {
    slug: 'birmingham-barcelona', airportSlug: 'birmingham', destinationSlug: 'barcelona',
    flightTime: 'Published direct service; exact duration varies by flight', frequency: 'Birmingham Airport lists direct Barcelona service; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Birmingham Airport's official destinations listing", sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Birmingham Airport lists Barcelona among its current destinations. The listing supports a direct destination connection but does not establish one operator, frequency or fixed duration for every date.' },
    intro: 'Birmingham Airport lists Barcelona among its direct destinations. Exact airline, operating days and journey time vary by flight, so check the live schedule for your dates.',
    bookingWindowNote: 'Compare the exact departure time, fare conditions and baggage terms shown for your dates before booking.', peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-barcelona', airportSlug: 'london-gatwick', destinationSlug: 'barcelona',
    flightTime: 'Direct destination listed by Gatwick; check the exact flight for duration', frequency: 'Gatwick destination information lists Barcelona; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "London Gatwick's official destinations information", sourceUrl: 'https://www.gatwickairport.com/flights/destinations.html', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Gatwick destination information lists Barcelona. No airport-specific affiliate handoff is assumed here; check the exact schedule, operator and duration directly before booking.' },
    intro: 'Gatwick destination information lists Barcelona as a direct destination. Exact airline, operating days, duration and fare depend on the selected flight, so check your dates carefully.',
    bookingWindowNote: 'This guide provides route context only. Gatwick-specific booking continuation is not currently available through JetStash for this pair.', peakPeriodIds: [],
  },
  {
    slug: 'bristol-barcelona', airportSlug: 'bristol', destinationSlug: 'barcelona',
    flightTime: 'Direct service listed by Bristol Airport; check the exact flight for duration', frequency: 'Bristol Airport lists Barcelona; exact operators, dates and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Bristol Airport's official explore-destinations listing", sourceUrl: 'https://www.bristolairport.co.uk/where-can-i-fly/explore-destinations/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Bristol Airport lists Barcelona among its destinations. The source does not establish a fixed operator, frequency or duration for all dates.' },
    intro: 'Bristol Airport lists Barcelona as a direct destination. Check the exact airline, operating day, duration and fare for your dates before booking.',
    bookingWindowNote: 'Confirm the live schedule, fare conditions and baggage terms for the exact flight you choose.', peakPeriodIds: [],
  },
  {
    slug: 'leeds-bradford-barcelona', airportSlug: 'leeds-bradford', destinationSlug: 'barcelona',
    flightTime: 'Direct destination listed by Leeds Bradford Airport; check the exact flight for duration', frequency: 'Leeds Bradford direct-destinations list includes Barcelona; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Leeds Bradford Airport's official direct destinations list", sourceUrl: 'https://www.leedsbradfordairport.co.uk/direct-destinations', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Leeds Bradford Airport lists Barcelona as a direct destination. Exact operating airline, dates, frequency and duration remain flight-specific.' },
    intro: 'Leeds Bradford Airport lists Barcelona as a direct destination. Check the exact operating airline, date, duration and fare before booking.',
    bookingWindowNote: 'Compare the live schedule and fare conditions for your selected date; operating days can vary seasonally.', peakPeriodIds: [],
  },
  {
    slug: 'bristol-faro', airportSlug: 'bristol', destinationSlug: 'faro',
    flightTime: 'Direct service listed by Bristol Airport; check the exact flight for duration', frequency: 'Bristol Airport lists Faro; exact operators, dates and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Bristol Airport's official Faro destination page", sourceUrl: 'https://www.bristolairport.co.uk/where-can-i-fly/destinations/europe/portugal/faro', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Bristol Airport lists flights to Faro and publishes flight-day information. Exact operating airline, frequency and duration should be checked for the selected date.' },
    intro: 'Bristol Airport lists direct service to Faro. Operating days, airline and journey time vary by flight, so check the exact dates before booking.',
    bookingWindowNote: 'Confirm the live schedule, fare conditions and baggage terms for your selected flight.', peakPeriodIds: [],
  },
  {
    slug: 'manchester-faro', airportSlug: 'manchester', destinationSlug: 'faro',
    flightTime: 'Published planning duration: 3h; check the exact flight for your dates', frequency: 'Manchester Airport lists direct service; exact operators, dates and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Manchester Airport's official Faro destination guide", sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/faro/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Manchester Airport lists Faro as a direct destination and publishes a 3h planning figure. Exact operator, operating days and duration remain flight-specific.' },
    intro: 'Manchester Airport lists direct service to Faro and publishes a 3h planning figure. Check the exact flight, operator and operating day for your dates.',
    bookingWindowNote: 'Compare the exact schedule, fare conditions and baggage terms before booking.', peakPeriodIds: [],
  },
  {
    slug: 'birmingham-faro', airportSlug: 'birmingham', destinationSlug: 'faro',
    flightTime: 'Published timings vary by source; check the exact flight for duration', frequency: 'Direct service listed by Birmingham Airport; easyJet, Jet2 and TUI are named on its destination page', airlineSlugs: ['easyjet', 'jet2', 'tui'], isDirect: true,
    verification: { status: 'verified', sourceName: "Birmingham Airport's official Faro destination page", sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/faro/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Birmingham Airport lists direct Faro service and names easyJet, Jet2 and TUI. Published timings conflict, so no single duration is stated; check the exact flight and date.' },
    intro: 'Birmingham Airport lists direct Faro service and names easyJet, Jet2 and TUI among the operators. Published timings vary by source, so check the exact flight and date.',
    bookingWindowNote: 'Operating days and fares vary by season and operator. Check baggage and fare conditions on the exact itinerary.', peakPeriodIds: [],
  },
  {
    slug: 'leeds-bradford-faro', airportSlug: 'leeds-bradford', destinationSlug: 'faro',
    flightTime: 'Direct destination listed by Leeds Bradford Airport; check the exact flight for duration', frequency: 'Leeds Bradford direct-destinations list includes Faro/Algarve; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Leeds Bradford Airport's official direct destinations list", sourceUrl: 'https://www.leedsbradfordairport.co.uk/direct-destinations', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Leeds Bradford Airport lists Faro/Algarve as a direct destination. Exact operator, operating days, frequency and duration remain date-specific.' },
    intro: 'Leeds Bradford Airport lists Faro and the Algarve among its direct destinations. Check the exact operator, date, duration and fare before booking.',
    bookingWindowNote: 'Operating days can vary seasonally; confirm the live schedule and baggage terms for your dates.', peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-faro', airportSlug: 'london-gatwick', destinationSlug: 'faro',
    flightTime: 'Direct destination listed by Gatwick; check the exact flight for duration', frequency: 'Gatwick destination information lists Faro; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "London Gatwick's official destinations information", sourceUrl: 'https://www.gatwickairport.com/flights/destinations.html', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Gatwick destination information lists Faro. Gatwick-specific affiliate continuation remains unavailable for this pair; no LON fallback is used.' },
    intro: 'Gatwick destination information lists Faro as a direct destination. Exact airline, operating days and duration vary by flight; check the live schedule for your dates.',
    bookingWindowNote: 'JetStash does not currently have an airport-specific Gatwick booking handoff for this pair. Check the exact itinerary directly before booking.', peakPeriodIds: [],
  },
  {
    slug: 'manchester-athens', airportSlug: 'manchester', destinationSlug: 'athens',
    flightTime: 'Published planning duration: 3h 50m; check the exact flight for your dates', frequency: 'Manchester Airport lists direct service; exact operators, dates and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Manchester Airport's official Athens destination guide", sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/athens/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Manchester Airport lists Athens as a direct destination and publishes a 3h50m planning figure. Exact operator, operating days and duration remain flight-specific.' },
    intro: 'Manchester Airport lists direct service to Athens and publishes a 3h50m planning figure. Check the exact operator, schedule and fare for your dates.',
    bookingWindowNote: 'Confirm the live schedule, fare conditions and baggage terms for the selected flight.', peakPeriodIds: [],
  },
  {
    slug: 'birmingham-athens', airportSlug: 'birmingham', destinationSlug: 'athens',
    flightTime: 'Approximate published flight time: 3h 50m; check the exact flight', frequency: 'Direct service listed by Birmingham Airport; Jet2 is named on its destination page', airlineSlugs: ['jet2'], isDirect: true,
    verification: { status: 'verified', sourceName: "Birmingham Airport's official Athens destination page", sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/athens/?searchresult=true', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Birmingham Airport lists direct Athens service, names Jet2 and gives an approximate 3h50m duration. Its seasonality and operating days vary by schedule.' },
    intro: 'Birmingham Airport lists direct Athens service and names Jet2 as an operator. The approximately 3h50m figure is a planning guide; check the exact flight and date.',
    bookingWindowNote: 'The airport identifies seasonal variation, so confirm operating dates, fare conditions and baggage terms before booking.', peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-athens', airportSlug: 'london-gatwick', destinationSlug: 'athens',
    flightTime: 'Direct destination listed by Gatwick; check the exact flight for duration', frequency: 'Gatwick destination information lists Athens; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "London Gatwick's official destinations information", sourceUrl: 'https://www.gatwickairport.com/flights/destinations.html', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Gatwick destination information lists Athens. Exact airline, dates, frequency and duration must be checked for the selected flight; no Gatwick affiliate fallback is used.' },
    intro: 'Gatwick destination information lists Athens as a direct destination. Check the exact airline, operating day, duration and fare for your dates.',
    bookingWindowNote: 'JetStash does not currently have an airport-specific Gatwick booking handoff for this pair. Check the exact itinerary directly before booking.', peakPeriodIds: [],
  },
  {
    slug: 'manchester-rome', airportSlug: 'manchester', destinationSlug: 'rome',
    flightTime: 'Published planning duration: 2h 45m; check the exact flight for your dates', frequency: 'Manchester Airport lists direct service to Rome; exact airport, operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Manchester Airport's official Rome destination guide", sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/rome/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Manchester Airport lists direct Rome service and a 2h45m planning figure, with both CIA and FCO shown. Check the exact airport and flight for your dates.' },
    intro: 'Manchester Airport lists direct service to Rome and publishes a 2h45m planning figure. Rome can use different airports, so check the exact airport, operator and date before booking.',
    bookingWindowNote: 'Confirm the Rome airport, live schedule, fare conditions and baggage terms on the exact itinerary.', peakPeriodIds: [],
  },
  {
    slug: 'birmingham-rome', airportSlug: 'birmingham', destinationSlug: 'rome',
    flightTime: 'Approximate published flight time: 2h 35m; check the exact flight', frequency: 'Direct service listed by Birmingham Airport; Jet2 is named among the operators', airlineSlugs: ['jet2'], isDirect: true,
    verification: { status: 'verified', sourceName: "Birmingham Airport's official Rome destination page", sourceUrl: 'https://airport.birminghamairport.co.uk/destinations/where-we-fly/rome/', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Birmingham Airport lists direct Rome service, the FCO/CIA airports, an approximate 2h35m duration and Jet2 among the named operators. Exact dates and frequency vary.' },
    intro: 'Birmingham Airport lists direct service to Rome and names both FCO and CIA among the airports served. Its approximately 2h35m figure is a planning guide, so check the exact airport, operator and date.',
    bookingWindowNote: 'Check the airport, operating day, fare conditions and baggage terms for the exact flight before booking.', peakPeriodIds: [],
  },
  {
    slug: 'london-gatwick-rome', airportSlug: 'london-gatwick', destinationSlug: 'rome',
    flightTime: 'Direct destination listed by Gatwick; check the exact flight for duration', frequency: 'Gatwick destination information lists Rome; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "London Gatwick's official destinations information", sourceUrl: 'https://www.gatwickairport.com/flights/destinations.html', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Gatwick destination information lists Rome. Exact airport, airline, operating days and duration must be checked for the selected flight; no Gatwick affiliate fallback is used.' },
    intro: 'Gatwick destination information lists Rome as a direct destination. Rome can use more than one airport, so check the exact airport, airline, duration and fare for your dates.',
    bookingWindowNote: 'JetStash does not currently have an airport-specific Gatwick booking handoff for this pair. Check the exact itinerary directly before booking.', peakPeriodIds: [],
  },
  {
    slug: 'bristol-rome', airportSlug: 'bristol', destinationSlug: 'rome',
    flightTime: 'Direct service listed by Bristol Airport; check the exact flight for duration', frequency: 'Bristol Airport lists Rome and flight-day information; exact operators and frequency vary', airlineSlugs: [], isDirect: true,
    verification: { status: 'verified', sourceName: "Bristol Airport's official Rome destination page", sourceUrl: 'https://www.bristolairport.co.uk/where-can-i-fly/destinations/europe/italy/rome', verifiedDate: '2026-08-13', reviewDueDate: '2026-09-13', note: 'Bristol Airport lists flights to Rome and flight-day information. Exact operator, frequency, airport and duration remain flight-specific.' },
    intro: 'Bristol Airport lists direct service to Rome. Check the exact airport, operating airline, flight day, duration and fare for your dates.',
    bookingWindowNote: 'Confirm the live schedule, fare conditions and baggage terms for the selected itinerary.', peakPeriodIds: [],
  },
  // Final Route-Guide Completion batch (13 August 2026) — see
  // docs/project-control/ROUTE_COVERAGE.md for the full 12-pair audit. Only
  // these two of twelve candidate pairs had current, authoritative
  // (airport- or airline-own) evidence reachable this session; the other
  // ten are documented there as evidence-blocked, not silently dropped.
  {
    slug: 'london-heathrow-lahore',
    airportSlug: 'london-heathrow',
    destinationSlug: 'lahore',
    flightTime: 'Approximately 8h, per Heathrow Airport\'s own announcement',
    frequency: 'Weekly (Mondays) from launch on 30 March 2026, per Heathrow Airport\'s own announcement; current frequency not independently confirmed beyond that launch figure',
    airlineSlugs: ['pia'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Heathrow Airport\'s own media centre: "Spring takes off at Heathrow with new routes and greater choice for passengers"',
      sourceUrl: 'https://mediacentre.heathrow.com/pressrelease/detail/24969',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-09-13',
      note: 'Heathrow Airport\'s own media centre confirms: "A weekly service between Heathrow and Lahore launches from 30 March, reconnecting passengers with another much-loved Pakistani city. Operating from Terminal 4..." — confirms direct status, PIA as operator (the same press release separately confirms PIA\'s Islamabad relaunch), the weekly launch frequency and Terminal 4. The release does not state a current frequency beyond that launch figure, so none beyond it is published. PIA\'s own site (piac.com.pk) remains Cloudflare-blocked to this session\'s tooling; no PIA-specific Karachi service is mentioned anywhere in this release.',
    },
    intro:
      'PIA relaunched a direct Heathrow to Lahore service on 30 March 2026 (confirmed via Heathrow Airport\'s own announcement), operating from Terminal 4 alongside PIA\'s parallel Islamabad relaunch. Check PIA\'s own booking system directly for the current schedule and fare.',
    bookingWindowNote:
      'Outside Eid and the summer school holidays, this window tends to be less pressured. Fares on peak-period routes often move in the final weeks before Eid — if your dates are fixed, aim to book at least 3 months ahead. Planning guidance, not a fare prediction.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays', 'wedding-season'],
  },
  {
    slug: 'london-gatwick-dubai',
    airportSlug: 'london-gatwick',
    destinationSlug: 'dubai',
    flightTime: '7-8 hours, per Gatwick\'s own destination listing',
    frequency: 'Direct service; exact frequency not published on Gatwick\'s own destination listing, check the exact flight',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'London Gatwick\'s official destinations information',
      sourceUrl: 'https://www.gatwickairport.com/flights/destinations.html',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-09-13',
      note: 'Gatwick\'s own destinations page lists "Dubai, UAE" with a stated "7-8 hours flight time" and "Serviced by Emirates." No frequency is published on this page; no Gatwick-specific Trip.com handoff exists for this pair, matching the standing London-origin limitation (see lib/booking-providers.ts).',
    },
    intro:
      'Gatwick\'s own destinations listing confirms direct Emirates service to Dubai, stating a 7-8 hour flight time. Exact frequency and schedule are not published on that page, so check the exact flight before booking.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. Winter, when UK schools are off, tends to carry the clearest premium; outside that, this route is generally less pressured.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  // Final Route-Guide Completion — second evidence pass (13 August 2026).
  // The first pass wrongly treated a 403 from direct WebFetch as an
  // evidence blocker for several routes whose own official pages are
  // reachable via search-indexed content (Google/Bing/DDG's own crawl of
  // the same page, not a different or lesser source) even when this
  // session's direct-fetch tooling is blocked. Re-opened per founder
  // instruction; see docs/project-control/ROUTE_COVERAGE.md for the full
  // second-pass account, including the routes that stayed blocked.
  {
    slug: 'birmingham-dubai',
    airportSlug: 'birmingham',
    destinationSlug: 'dubai',
    flightTime: 'Approximately 7h, per Birmingham Airport\'s own destination page',
    frequency: 'Direct service; current frequency not confirmed by a current official schedule (Birmingham Airport\'s own historical announcements describe a since-superseded three-times-daily launch)',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Birmingham Airport\'s own Dubai destination page, corroborated by Birmingham Airport\'s own historical Emirates service announcements',
      sourceUrl: 'https://www.birminghamairport.co.uk/destinations/where-we-fly/dubai/',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-09-13',
      note: 'Birmingham Airport\'s own Dubai destination page ("Flights to Dubai (DXB) from BHX | Birmingham Airport") is confirmed current via search-indexed content this session — direct WebFetch to birminghamairport.co.uk returns 403 across every subdomain, but the same page is independently indexed and reachable via search, per the standing rule that a 403 on direct fetch is not itself an evidence blocker when the same official source is available another way. Corroborated by Birmingham Airport\'s own historical press releases ("Emirates\' Third Daily Service Touches Down at Birmingham Airport", "Emirates Adds Second Daily A380 to Birmingham"), which independently confirm Emirates has operated direct Birmingham–Dubai service; those specific frequency figures (three-times-daily, dated 2015) are over a decade old and are not republished as current — only "direct, Emirates" is treated as currently supported. The ~7h duration is stated on Birmingham Airport\'s own page per search-indexed content; current weekly frequency was not extracted from that page this session and is not published as a specific figure.',
    },
    intro:
      'Birmingham Airport\'s own destination page confirms direct Emirates service to Dubai. Birmingham Airport has published this route consistently for over a decade, though the airport\'s own historical frequency announcements are no longer current — check the exact flight and current schedule before booking.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. Winter, when UK schools are off, tends to carry the clearest premium; outside that, this route is generally less pressured.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'birmingham-doha',
    airportSlug: 'birmingham',
    destinationSlug: 'doha',
    flightTime: 'Approximately 6h 45m, per Birmingham Airport\'s own service announcement',
    frequency: 'Daily from launch on 6 July 2023, per Birmingham Airport\'s own announcement; current frequency not independently confirmed beyond that launch figure',
    airlineSlugs: ['qatar-airways'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Birmingham Airport\'s own media centre: "Qatar Airways Returns to Birmingham Airport"',
      sourceUrl: 'https://www.birminghamairport.co.uk/latest-news/qatar-airways-returns-to-birmingham-airport/',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-09-13',
      note: 'Birmingham Airport\'s own press release, confirmed current via search-indexed content this session (direct WebFetch to birminghamairport.co.uk returns 403 across every subdomain — see the birmingham-dubai record above for the same standing note), confirms Qatar Airways resumed direct Birmingham–Doha service on 6 July 2023, "one flight a day, 7 days a week... throughout this summer", via Hamad International Airport, operated by a Boeing 787-8 Dreamliner. This is founding/launch evidence, over three years old — daily is the launch figure, not independently reconfirmed as the current frequency. Qatar Airways\' own route page for this pair (qatarairways.com) returns 403 to this session\'s tooling.',
    },
    intro:
      'Qatar Airways resumed a direct Birmingham to Doha service on 6 July 2023 (confirmed via Birmingham Airport\'s own announcement), launched as a daily service via Hamad International Airport. Check Qatar Airways\' own booking system directly for the current schedule and fare.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes, though Ramadan and the wider Gulf-travel calendar can shift demand. Check the live schedule and fare conditions before booking.',
    peakPeriodIds: ['uk-summer-holidays', 'christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'birmingham-jeddah',
    airportSlug: 'birmingham',
    destinationSlug: 'jeddah',
    flightTime: 'Approximately 6h 15m, per Birmingham Airport\'s own service announcement',
    frequency: 'Three times weekly (Tuesdays, Thursdays, Sundays) from launch on 2 July 2023, per Birmingham Airport\'s own announcement; current frequency not independently confirmed beyond that launch figure',
    airlineSlugs: ['saudia'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Birmingham Airport\'s own media centre: "Saudia Launches Three-Times-A-Week Jeddah Service from BHX"',
      sourceUrl: 'https://www.birminghamairport.co.uk/latest-news/saudia-launches-three-times-a-week-jeddah-service-from-bhx/',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-09-13',
      note: 'Birmingham Airport\'s own press release, confirmed current via search-indexed content this session (direct WebFetch to birminghamairport.co.uk returns 403 across every subdomain — see the birmingham-dubai record above for the same standing note), confirms Saudia launched direct Birmingham–Jeddah service on 2 July 2023, three times weekly (Tuesdays, Thursdays, Sundays), operated by a Boeing 787 Dreamliner (inaugural flight SV0250), with Birmingham Airport CEO Nick Barton quoted confirming the launch. This is founding/launch evidence, over three years old — three-times-weekly is the launch figure, not independently reconfirmed as the current frequency. Saudia\'s own route page for this pair (saudia.com) returns a bot-detection interruption page to this session\'s tooling.',
    },
    intro:
      'Saudia launched a direct Birmingham to Jeddah service on 2 July 2023 (confirmed via Birmingham Airport\'s own announcement), three times weekly at launch. Check Saudia\'s own booking system directly for the current schedule and fare.',
    bookingWindowNote:
      'Ramadan and the pre-Hajj period are the two periods most likely to move demand and fares on this route. Outside those, booking pressure is generally lower — check the live schedule before booking regardless.',
    peakPeriodIds: ['ramadan', 'pre-hajj'],
  },
  {
    slug: 'london-heathrow-dubai',
    airportSlug: 'london-heathrow',
    destinationSlug: 'dubai',
    flightTime: 'Approximately 7h 45m, based on Emirates\' published duration for its wider UK network',
    frequency: 'Direct service; current frequency not confirmed by a current official schedule',
    airlineSlugs: ['emirates'],
    isDirect: true,
    verification: {
      status: 'verified',
      sourceName: 'Heathrow Airport\'s own live flight-tracking system (multiple current Emirates flight-detail pages)',
      sourceUrl: 'https://www.heathrow.com/departures/terminal-3/flight-details/EK4',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-09-13',
      note: 'Heathrow\'s own live flight-tracking system currently indexes multiple genuine, current Emirates Heathrow-Dubai flight-detail pages under its own domain — departures EK2, EK4, EK6, EK32, EK42 and arrivals EK3, EK31, all at Terminal 3 — confirmed via search-indexed content this session (the pages themselves are JS-rendered and return no static content to direct WebFetch, so exact departure times were not extracted, but their existence and terminal assignment in Heathrow\'s own indexed system is genuine airport-sourced confirmation the service currently operates). Corroborated by Heathrow\'s own airline-contact-info page, which separately confirms Emirates operates from Terminal 3. Duration is not stated by Heathrow\'s own pages reached this session; the 7h45m figure is Emirates\' own published duration for this exact pair per this codebase\'s existing Manchester-Dubai and Glasgow-Dubai records (both independently verified against Emirates\' own route pages in an earlier session when emirates.com was reachable), used here as the airline\'s own stated network duration rather than a new estimate. British Airways separately operates a reduced, currently-disrupted Heathrow-Dubai service (Middle East airspace-related capacity cuts, widely reported since March 2026) — not included in airlineSlugs, since no primary BA source confirming current status was reachable this session.',
    },
    intro:
      'Heathrow\'s own live flight-tracking system confirms current Emirates service to Dubai from Terminal 3. British Airways also serves this route but with reduced, currently-disrupted capacity — check directly with each airline for the current schedule before booking.',
    bookingWindowNote:
      'Less sensitive to booking window than the South Asia routes. Winter, when UK schools are off, tends to carry the clearest premium; outside that, this route is generally less pressured.',
    peakPeriodIds: ['christmas-new-year', 'february-half-term', 'easter-holidays'],
  },
  {
    slug: 'birmingham-delhi',
    airportSlug: 'birmingham',
    destinationSlug: 'delhi',
    flightTime: 'Unverified — genuinely conflicting sources, see note',
    frequency: 'Unverified — genuinely conflicting sources, see note',
    airlineSlugs: ['air-india'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: 'Birmingham Airport\'s own current Delhi destination page, set against Air India\'s own current live booking page and schedule output',
      sourceUrl: 'https://www.airindia.com/en/book-flights/birmingham-to-delhi-flights',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-08-27',
      note: 'A genuine, currently unresolved contradiction across three current sources, not a stale or secondary one. On the "direct" side: Birmingham Airport\'s own historical press release ("Air India Resumes Six Direct Weekly Services to India from Birmingham Airport", August 2019) describes a direct Boeing 787 tag-service running three times weekly to Delhi and onward to Amritsar, and three times weekly to Amritsar and onward to Delhi — a routing that stops at both cities on one flight number. Birmingham Airport\'s own CURRENT Delhi destination page adds further weight to the "direct" side: it names Air India, describes the service as direct, and states a flight time of approximately 7 hours 55 minutes. Air India\'s own current live booking page for this exact pair (confirmed via search-indexed content this session) separately shows a schedule example under flight number AI114 that aggregators describe as Non Stop on some 2026 dates. On the "no direct" side: Air India\'s own current route-information page for this exact pair states there are 0 direct flights between Birmingham and Delhi. Neither the airport\'s own destination page nor Air India\'s own schedule output is discarded in favour of Air India\'s own conflicting route-information page — this is Air India contradicting itself, not a weaker third party against a stronger primary source. Kept Verification Pending with a shortened review window given the live contradiction.',
    },
    intro:
      'Birmingham to Delhi sits on a genuine, currently unresolved contradiction across current, authoritative sources. Birmingham Airport\'s own destination page for Delhi names Air India and describes a direct service of approximately 7 hours 55 minutes, and Air India\'s own current booking system separately shows a scheduled service under flight number AI114 that other sources describe as nonstop on some 2026 dates — but Air India\'s own current route-information page for this exact pair states there are 0 direct flights between Birmingham and Delhi. Current authoritative evidence does not resolve which of Air India\'s own statements about its own service is correct. Confirm the actual routing directly with Air India\'s own booking system — including whether your itinerary makes an intermediate stop — before assuming either claim.',
    bookingWindowNote:
      'Because this route\'s own directness is unresolved, compare the full itinerary Air India actually offers for your dates rather than assuming a nonstop service. Diwali and the December-January window are the periods most likely to move demand and fares on any India route regardless.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-ahmedabad',
    airportSlug: 'birmingham',
    destinationSlug: 'ahmedabad',
    flightTime: 'Unverified — genuinely conflicting sources, see note',
    frequency: 'Unverified — genuinely conflicting sources, see note',
    airlineSlugs: ['air-india'],
    isDirect: true,
    verification: {
      status: 'unverified',
      sourceName: 'Air India\'s own current live booking page for this exact pair, which contradicts itself',
      sourceUrl: 'https://www.airindia.com/en/book-flights/birmingham-to-ahmedabad-flights',
      verifiedDate: '2026-08-13',
      reviewDueDate: '2026-08-27',
      note: 'A genuine, currently unresolved contradiction within a single Air India source, not a stale or secondary one. Air India\'s own current page for Birmingham to Ahmedabad is internally inconsistent: its marketing copy describes flying to Ahmedabad and references a direct-flight duration, while the same page\'s structured route information and FAQ section separately state there are 0 direct flights between Birmingham and Ahmedabad. Neither statement is discarded in favour of the other, and no other current authoritative primary source reached this session resolves the contradiction. No specific connecting hub (Delhi, Mumbai or otherwise) is asserted here: no source reached this session confirms the exact hub, if any, Air India\'s own Birmingham-Ahmedabad itineraries actually route through, so none is published. Kept Verification Pending with a shortened review window given the live contradiction.',
    },
    intro:
      'Birmingham to Ahmedabad sits on a genuine, currently unresolved contradiction within Air India\'s own current booking page: its marketing copy references a direct flight, while the same page\'s structured route information and FAQ state there are 0 direct flights between Birmingham and Ahmedabad. Current authoritative evidence does not resolve which of Air India\'s own statements is correct, and no hub is confirmed if a connection is in fact required. Confirm the actual routing directly with Air India\'s own booking system — including whether your itinerary makes an intermediate stop — before assuming either claim.',
    bookingWindowNote:
      'Because this route\'s own directness is unresolved, compare the full itinerary Air India actually offers for your dates rather than assuming a nonstop service. Navratri and Diwali are the periods most likely to move demand and fares on any Gujarat route regardless.',
    peakPeriodIds: ['navratri', 'diwali', 'uk-summer-holidays'],
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
 * Metadata audit follow-up (Final Route-Guide Completion, 13 August 2026):
 * "London" is the one city shared by two distinct airports (Heathrow,
 * Gatwick — see data/airports.ts) — the first time this repository had two
 * live routes from different London airports to the exact same destination
 * (london-heathrow-dubai, london-gatwick-dubai) exposed a real,
 * previously-latent bug: metadataTitle built its origin half from
 * airport.city alone, so both pages generated the identical <title>, a
 * genuine SEO defect (duplicate titles read as the same page to a search
 * engine), not a cosmetic one.
 *
 * Deliberately NOT a blanket "always use airport.name for London" fix —
 * that would have lengthened every existing Heathrow/Gatwick route's title
 * (most already near the ~65-character guideline) and pushed roughly a
 * dozen of them over it for no reason, since most have no actual collision
 * to resolve. Instead this checks, per route, whether a REAL collision
 * exists — another current route to the same destination from the other
 * London airport — and only disambiguates (using the full airport.name,
 * "London Heathrow"/"London Gatwick") in that specific case; every route
 * with no such collision keeps the plain "London" origin exactly as
 * before. Scoped to metadataTitle only — the visible H1, breadcrumb, share
 * text and social copy everywhere else in this file still say "London to
 * Dubai" by design (the breadcrumb's own separate airport.name crumb
 * already disambiguates for a visitor); only the invisible <title> tag
 * needed a fix.
 */
function disambiguatedTitleOrigin(route: Route, airport: ReturnType<typeof getRouteAirport>): string | undefined {
  if (!airport || airport.city !== 'London') return airport?.city;
  const collides = getRoutesByDestination(route.destinationSlug).some((r) => {
    if (r.slug === route.slug) return false;
    const otherAirport = getRouteAirport(r);
    return otherAirport?.city === 'London' && otherAirport.slug !== airport.slug;
  });
  return collides ? airport.name : airport.city;
}

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
  // Same London-disambiguation fix as getRoutePresentation() above, applied
  // here too so a future unverified route from the other London airport to
  // an existing unverified destination can never silently reintroduce the
  // same duplicate-<title> bug.
  const titleOriginLabel = disambiguatedTitleOrigin(route, airport);
  const titlePair = titleOriginLabel && dest ? `${titleOriginLabel} to ${dest.city}` : pair;
  return {
    status: 'unverified',
    statusLabel,
    flightTime: null,
    frequency: null,
    airlineSlugs: [],
    summary: copy.summary,
    metadataDescription: copy.metadataDescription,
    // Metadata audit (Aug 2026): dropped "Route" — "Verification in
    // Progress" alone is unambiguous on a page whose URL and h1 already
    // say it's a route, and the shorter form keeps this title (and the
    // handful of longer city pairs using it) comfortably within the
    // ~65-character guideline.
    metadataTitle: `${titlePair}: Verification in Progress`,
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
 * Metadata audit (Aug 2026): every direct/connecting route's
 * metadataDescription used to be `${route.intro.slice(0, 150)}...` — a raw
 * character-count slice that could land mid-word, and unconditionally
 * appended "..." even on the (common) routes whose intro was already
 * short enough that nothing was actually cut. Replaced with a real
 * boundary-aware truncation: prefer ending on a genuine sentence (reads as
 * a complete thought, no ellipsis needed), fall back to the last whole
 * word before the limit, and never touch text that's already within
 * range. `route.intro` itself — the full, hand-authored hero copy — is
 * completely untouched; this only affects what ships in <meta
 * description>.
 */
const MAX_METADATA_DESCRIPTION_LENGTH = 170;
// A sentence- or word-boundary found before this fraction of the limit is
// rejected as too short a fragment to be a useful summary on its own —
// falls through to the next strategy instead of returning a near-empty string.
const MIN_USEFUL_BOUNDARY_RATIO = 0.5;

export function truncateMetadataDescription(text: string, maxLength: number = MAX_METADATA_DESCRIPTION_LENGTH): string {
  if (text.length <= maxLength) return text;
  const window = text.slice(0, maxLength);
  const minBoundary = maxLength * MIN_USEFUL_BOUNDARY_RATIO;

  const lastSentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (lastSentenceEnd >= minBoundary) return window.slice(0, lastSentenceEnd + 1);

  const lastSpace = window.lastIndexOf(' ');
  const safe = lastSpace >= minBoundary ? window.slice(0, lastSpace) : window;
  return `${safe.trimEnd()}…`;
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
  // Metadata audit (Aug 2026): dropped "Flights" from this branch
  // specifically — the full "{pair} Flights: Booking Windows & Peak
  // Periods" suffix, identical across every route with peak-period
  // content, pushed nearly half the route network's titles past the
  // ~65-character guideline. "Flights" was the one word removable without
  // losing a route fact, a search term, or the origin/destination pair —
  // "to" already signals a journey, and "Booking Windows & Peak Periods"
  // alone still says exactly what the page covers. A handful of routes
  // with an unusually long city pair (e.g. Manchester to Ahmedabad) still
  // land a few characters past the guideline even after this — an
  // accepted, documented exception (see tests/metadata-audit.test.ts)
  // rather than a further cut that would start losing meaning.
  const titleOriginLabel = disambiguatedTitleOrigin(route, airport);
  const titlePair = titleOriginLabel && dest ? `${titleOriginLabel} to ${dest.city}` : pair;
  const hasPeakPeriodContent = route.peakPeriodIds.length > 0;
  const metadataTitle = hasPeakPeriodContent
    ? `${titlePair}: Booking Windows & Peak Periods`
    : `${titlePair} Flights: ${status === 'direct' ? 'Route Guide' : 'Connection Guide'}`;

  return {
    status,
    statusLabel,
    flightTime: route.flightTime,
    frequency: route.frequency,
    airlineSlugs,
    summary: route.intro,
    metadataDescription: truncateMetadataDescription(route.intro),
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
