import { airports } from './airports';
import { destinations } from './destinations';
import { getAirlinesBySlugs } from './airlines';
import { getPeakPeriodsByIds } from './peak-periods';

export interface Route {
  slug: string; // e.g. "manchester-lahore"
  airportSlug: string;
  destinationSlug: string;
  flightTime: string;
  frequency: string; // e.g. "Daily direct" or "4x weekly via Dubai"
  airlineSlugs: string[]; // references data/airlines.ts
  isDirect: boolean;
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
    frequency: 'Several times weekly, direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro:
      'The flagship Pakistan corridor from the North of England. PIA runs direct Manchester to Lahore services, and for the North West\'s Punjabi community it\'s usually the most convenient option going: no Gulf connection, no extra layover, no risk of luggage going missing at a transfer.',
    bookingWindowNote:
      'Outside Eid and the summer school holidays, fares hold reasonably steady 8 to 10 weeks out. Within 3 weeks of Eid, expect a sharp jump, so book that window at least 3 months ahead if your dates are fixed.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays', 'wedding-season'],
  },
  {
    slug: 'manchester-islamabad',
    airportSlug: 'manchester',
    destinationSlug: 'islamabad',
    flightTime: '7h 45m direct',
    frequency: 'Several times weekly, direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro:
      'Manchester to Islamabad direct services are the practical choice for families based across Yorkshire, Lancashire and the wider North West heading to Punjab or onward to Khyber Pakhtunkhwa.',
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
    flightTime: '6h direct',
    frequency: 'Several times weekly, direct',
    airlineSlugs: ['saudia', 'british-airways'],
    isDirect: true,
    intro:
      'The primary direct Umrah arrival route from the UK. Most flight-inclusive Umrah packages are built around this exact corridor, with onward ground transport to Makkah.',
    bookingWindowNote:
      'Ramadan and the weeks immediately before Hajj season are by far the steepest pricing windows on this route. Outside them, pricing is comparatively settled.',
    peakPeriodIds: ['ramadan', 'pre-hajj', 'school-half-terms-umrah'],
  },
  {
    slug: 'manchester-karachi',
    airportSlug: 'manchester',
    destinationSlug: 'karachi',
    flightTime: '8h 30m direct',
    frequency: 'Several times weekly, direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro:
      'PIA operates direct Manchester to Karachi services alongside its Lahore and Islamabad routes, giving the North of England a genuine third direct option into Pakistan\'s commercial capital and Sindh province.',
    bookingWindowNote:
      'PIA\'s UK network has expanded significantly through 2025 and 2026 after a long suspension, and frequency is still settling. Confirm the current weekly schedule before assuming daily availability, and book 2 to 3 months ahead of Eid or wedding season.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'wedding-season', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-lahore',
    airportSlug: 'birmingham',
    destinationSlug: 'lahore',
    flightTime: '8h direct',
    frequency: 'Weekly direct, more via connection',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro:
      'Birmingham\'s direct PIA service to Lahore gives the Midlands\' large Punjabi community a non-stop option alongside the existing Islamabad route, sparing you either a drive to Manchester or a Gulf connection.',
    bookingWindowNote:
      'This direct service is newer and runs at a lower weekly frequency than the Manchester equivalent, so confirm seat availability well ahead of Eid or wedding season and have a Gulf-connecting fare priced as a fallback.',
    peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'wedding-season', 'uk-summer-holidays'],
  },
  {
    slug: 'birmingham-islamabad',
    airportSlug: 'birmingham',
    destinationSlug: 'islamabad',
    flightTime: '7h 50m direct',
    frequency: 'Several times weekly, direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro:
      'Birmingham to Islamabad is PIA\'s longest-established direct route from the Midlands, predating the airline\'s newer Lahore service, and it remains the most reliable non-stop option for Midlands-based families.',
    bookingWindowNote:
      'As the more established of Birmingham\'s two direct Pakistan routes, this one tends to hold marginally more availability during peak weeks than the newer Lahore service, though it\'s still worth booking 2 to 3 months ahead of Eid.',
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
    frequency: 'Daily direct',
    airlineSlugs: ['british-airways', 'air-india', 'virgin-atlantic'],
    isDirect: true,
    intro:
      'Heathrow to Mumbai has genuine multi-carrier competition, with British Airways, Air India and Virgin Atlantic all operating direct services. Comparing all three rather than booking the first result is consistently worthwhile.',
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
    frequency: 'Currently 3 to 4x weekly direct, reducing; confirm before booking',
    airlineSlugs: ['indigo'],
    isDirect: true,
    intro:
      'IndiGo launched the first non-stop Manchester to Delhi service in 25 years in November 2025, flying a two-class Boeing 787-9 leased from Norse Atlantic Airways. It\'s currently the only airline flying this route direct, and frequency has already been reduced once on operational grounds, so always confirm the live schedule rather than assuming a fixed weekly pattern.',
    bookingWindowNote:
      'Because this is a single-airline direct service with announced frequency cuts, treat any specific date as unconfirmed until checked. If your dates are flexible, compare the direct fare against the well-established one-stop Gulf-carrier options below before committing. The direct service isn\'t necessarily the cheaper or more reliable choice on every date.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    directServiceEndDate: '2026-09-01',
    directServiceEndNote:
      'IndiGo has announced it will withdraw from Manchester entirely from 31 August 2026, ending both the Delhi and Mumbai direct services. If you are travelling after this date, plan around the one-stop alternative below rather than the direct route.',
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
    frequency: 'Currently around 4x weekly direct; confirm before booking',
    airlineSlugs: ['indigo'],
    isDirect: true,
    intro:
      'IndiGo\'s Mumbai to Manchester service, launched in July 2025, was the airline\'s first ever long-haul route and remains the only non-stop link between Manchester and India\'s financial capital. As with the Delhi route, it\'s a single-airline direct service rather than a long-established one, and scheduling has already shifted once since launch.',
    bookingWindowNote:
      'Treat the direct schedule as worth double-checking close to your travel date rather than assumed fixed. The well-established one-stop Gulf-carrier options below run far more frequently and are worth comparing on price and convenience, not just kept as a fallback.',
    peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    directServiceEndDate: '2026-09-01',
    directServiceEndNote:
      'IndiGo has announced it will withdraw from Manchester entirely from 31 August 2026, ending both the Mumbai and Delhi direct services. If you are travelling after this date, plan around the one-stop alternative below rather than the direct route.',
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
