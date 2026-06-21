import { airports } from './airports';
import { destinations } from './destinations';

export interface Route {
  slug: string; // e.g. "manchester-lahore"
  airportSlug: string;
  destinationSlug: string;
  flightTime: string;
  frequency: string; // e.g. "Daily direct" or "4x weekly via Dubai"
  airlines: string[];
  isDirect: boolean;
  intro: string;
  bookingWindowNote: string;
  peakPeriods: string[];
}

export const routes: Route[] = [
  {
    slug: 'manchester-lahore',
    airportSlug: 'manchester',
    destinationSlug: 'lahore',
    flightTime: '8h direct',
    frequency: 'Several times weekly, direct',
    airlines: ['PIA'],
    isDirect: true,
    intro:
      'This is the single most-travelled long-haul route on JetStash. PIA runs direct Manchester–Lahore services, making it the most convenient option for the North West\'s Punjabi community — no Gulf connection, no extra layover, no lost luggage transfer risk.',
    bookingWindowNote:
      'Outside Eid and the summer school holidays, fares hold reasonably steady 8–10 weeks out. Within 3 weeks of Eid, expect a sharp jump — book that window 3+ months ahead if your dates are fixed.',
    peakPeriods: ['Eid al-Fitr', 'Eid al-Adha', 'UK summer holidays (Jul–Aug)', 'Winter wedding season (Dec–Feb)'],
  },
  {
    slug: 'manchester-islamabad',
    airportSlug: 'manchester',
    destinationSlug: 'islamabad',
    flightTime: '7h 45m direct',
    frequency: 'Several times weekly, direct',
    airlines: ['PIA'],
    isDirect: true,
    intro:
      'Manchester–Islamabad direct services are the practical choice for families based across Yorkshire, Lancashire and the wider North West heading to Punjab or onward to Khyber Pakhtunkhwa.',
    bookingWindowNote:
      'Similar pattern to the Lahore route — stable pricing most of the year, sharp rises tight to Eid and major family events. The route sells out faster than Lahore in peak weeks due to fewer weekly frequencies.',
    peakPeriods: ['Eid al-Fitr', 'Eid al-Adha', 'UK summer holidays (Jul–Aug)'],
  },
  {
    slug: 'london-heathrow-delhi',
    airportSlug: 'london-heathrow',
    destinationSlug: 'delhi',
    flightTime: '8h 45m direct',
    frequency: 'Daily, multiple direct options',
    airlines: ['Virgin Atlantic', 'British Airways', 'Air India'],
    isDirect: true,
    intro:
      'Heathrow–Delhi is the busiest UK–India corridor, with genuine airline competition keeping fares more elastic than routes served by a single carrier. Worth comparing across all three direct operators rather than booking the first result.',
    bookingWindowNote:
      'Diwali and the December–January window are the two demand spikes that matter most. Outside those, February–April and September–October are reliably the best value months.',
    peakPeriods: ['Diwali', 'Christmas–New Year', 'UK summer holidays (Jul–Aug)'],
  },
  {
    slug: 'birmingham-amritsar',
    airportSlug: 'birmingham',
    destinationSlug: 'amritsar',
    flightTime: '9h direct',
    frequency: 'Seasonal direct, year-round via connection',
    airlines: ['Air India'],
    isDirect: true,
    intro:
      'For the Midlands\' large Punjabi community, Birmingham\'s seasonal direct service to Amritsar avoids the otherwise-necessary Delhi or Heathrow connection — the most direct route to the Golden Temple and rural Punjab.',
    bookingWindowNote:
      'Direct frequency drops outside peak season — confirm whether your travel dates fall within the direct schedule before assuming a non-stop option exists, and have a Delhi-connection fallback priced as backup.',
    peakPeriods: ['Baisakhi (April)', 'Diwali', 'UK summer holidays (Jul–Aug)'],
  },
  {
    slug: 'manchester-dubai',
    airportSlug: 'manchester',
    destinationSlug: 'dubai',
    flightTime: '7h direct',
    frequency: 'Daily direct',
    airlines: ['Emirates'],
    isDirect: true,
    intro:
      'Emirates\' daily Manchester–Dubai service is one of the most reliably priced long-haul routes from the North — strong competition from connecting Gulf carriers via other UK airports keeps fares honest.',
    bookingWindowNote:
      'Less booking-window sensitive than South Asia routes. Winter (UK school holidays) carries the clearest premium; outside that, fares are comparatively stable.',
    peakPeriods: ['UK Christmas/New Year holidays', 'February half-term', 'Easter holidays'],
  },
  {
    slug: 'london-heathrow-doha',
    airportSlug: 'london-heathrow',
    destinationSlug: 'doha',
    flightTime: '6h 30m direct',
    frequency: 'Multiple daily direct',
    airlines: ['Qatar Airways'],
    isDirect: true,
    intro:
      'Qatar Airways operates this as a high-frequency hub route — most UK travellers heading further afield through Doha will pass through here, but it also stands alone as a city break or family stopover.',
    bookingWindowNote:
      'High frequency means more fare classes open at once — comparing departure times on the same day can surface meaningfully different prices.',
    peakPeriods: ['UK school holidays generally', 'Ramadan (different pace, not price)'],
  },
  {
    slug: 'london-heathrow-jeddah',
    airportSlug: 'london-heathrow',
    destinationSlug: 'jeddah',
    flightTime: '6h direct',
    frequency: 'Several times weekly, direct',
    airlines: ['Saudia', 'British Airways'],
    isDirect: true,
    intro:
      'The primary direct Umrah arrival route from the UK. Most flight-inclusive Umrah packages are built around this exact corridor, with onward ground transport to Makkah.',
    bookingWindowNote:
      'Ramadan and the weeks immediately preceding Hajj season carry the sharpest price increases of any route on JetStash. Outside those windows, pricing is comparatively settled.',
    peakPeriods: ['Ramadan', 'Pre-Hajj season', 'School half-terms for family Umrah trips'],
  },
];

export function getRouteBySlug(slug: string) {
  return routes.find((r) => r.slug === slug);
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
