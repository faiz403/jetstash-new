export interface Airline {
  slug: string;
  iataCode: string;
  name: string;
}

/**
 * Canonical airline reference, keyed by slug and referenced from
 * data/routes.ts (Route.airlineSlugs) instead of retyping free-text airline
 * names per route. Add new carriers here rather than inlining a new string
 * elsewhere.
 */
export const airlines: Airline[] = [
  { slug: 'pia', iataCode: 'PK', name: 'PIA' },
  { slug: 'virgin-atlantic', iataCode: 'VS', name: 'Virgin Atlantic' },
  { slug: 'british-airways', iataCode: 'BA', name: 'British Airways' },
  { slug: 'air-india', iataCode: 'AI', name: 'Air India' },
  { slug: 'emirates', iataCode: 'EK', name: 'Emirates' },
  { slug: 'qatar-airways', iataCode: 'QR', name: 'Qatar Airways' },
  { slug: 'saudia', iataCode: 'SV', name: 'Saudia' },
  { slug: 'indigo', iataCode: '6E', name: 'IndiGo' },
  { slug: 'etihad-airways', iataCode: 'EY', name: 'Etihad Airways' },
  { slug: 'turkish-airlines', iataCode: 'TK', name: 'Turkish Airlines' },
  { slug: 'egyptair', iataCode: 'MS', name: 'EgyptAir' },
  { slug: 'royal-jordanian', iataCode: 'RJ', name: 'Royal Jordanian' },
];

const airlinesBySlug = new Map(airlines.map((a) => [a.slug, a]));

export function getAirlineBySlug(slug: string) {
  return airlinesBySlug.get(slug);
}

export function getAirlinesBySlugs(slugs: string[]) {
  return slugs.map((slug) => getAirlineBySlug(slug)).filter((a): a is Airline => Boolean(a));
}
