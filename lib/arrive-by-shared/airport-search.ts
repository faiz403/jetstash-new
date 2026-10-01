/**
 * Deliberately imports NO catalogue data: this module is safe to bundle into
 * the browser (the /arrive-by selector uses it over the small public-airport
 * list) without dragging the ~350 KB worldwide catalogue along. Catalogue-wide
 * search lives in catalogue-search.ts, which is server / lazy-load only.
 */

/**
 * Local, offline airport search over the catalogue -- pure string matching,
 * never a Google call (the selector must not spend API budget on keystrokes).
 *
 * Ranking, best first: exact IATA code, exact ICAO code, IATA prefix,
 * city / name prefix, country-name prefix, then any-word prefix, then
 * substring. Ties break on major-hub hint, airport size (larger first) then IATA code, so
 * results are deterministic and "Delhi" or "London" surface the major
 * airport first.
 */

/** The minimum an airport needs to be searchable. A catalogue airport satisfies this; so does a registry profile mapped by the caller. */
export interface SearchableAirport {
  iata: string;
  /** Empty string when unknown. */
  icao: string;
  name: string;
  city: string;
  countryCode: string;
  size: 'L' | 'M' | 'S';
}

export interface AirportSearchOptions {
  limit?: number;
  /** Restrict to airports the caller has already decided are eligible (e.g. publicly usable). Applied before ranking. */
  filter?: (airport: SearchableAirport) => boolean;
}

const MAX_QUERY_LENGTH = 64;
const DEFAULT_LIMIT = 8;

/** Lower-cases and strips diacritics and punctuation so "Zürich", "zurich" and "St. Louis" / "st louis" match. */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let regionNames: Intl.DisplayNames | null | undefined;
/** English country name for an ISO code, e.g. 'AE' -> 'United Arab Emirates'. Falls back to the code if ICU data is unavailable. */
export function getCountryName(countryCode: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

/**
 * Ranking hint ONLY -- never a capability or eligibility signal. The source
 * data has no passenger-volume field, so when several airports tie on match
 * quality ("Dubai" -> DXB and DWC; "London" -> five airports) a short list of
 * the world's major hubs surfaces first. An airport absent from this list is
 * searchable exactly the same, just later in a tie.
 */
const MAJOR_HUBS: ReadonlySet<string> = new Set([
  'LHR', 'LGW', 'MAN', 'STN', 'LTN', 'BHX', 'EDI', 'GLA', 'DUB', 'CDG', 'AMS', 'FRA', 'MAD', 'BCN', 'FCO', 'MUC', 'ZRH', 'IST',
  'JFK', 'LAX', 'ORD', 'ATL', 'SFO', 'MIA', 'YYZ', 'YVR', 'MEX', 'GRU', 'EZE',
  'DXB', 'AUH', 'DOH', 'JED', 'MED', 'RUH', 'KWI', 'BAH', 'MCT', 'CAI', 'JNB', 'CPT', 'NBO', 'ADD',
  'DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'AMD', 'ISB', 'LHE', 'KHI', 'DAC', 'CMB', 'KTM',
  'SIN', 'BKK', 'KUL', 'HKG', 'PEK', 'PVG', 'ICN', 'NRT', 'HND', 'KIX', 'SYD', 'MEL', 'AKL',
]);

const SIZE_RANK = { L: 0, M: 1, S: 2 } as const;
const countryFoldCache = new Map<string, string>();
function foldedCountry(countryCode: string): string {
  let folded = countryFoldCache.get(countryCode);
  if (folded === undefined) {
    folded = foldSearchText(getCountryName(countryCode));
    countryFoldCache.set(countryCode, folded);
  }
  return folded;
}

function scoreAirport(airport: SearchableAirport, query: string, tokens: string[]): number {
  const iata = airport.iata.toLowerCase();
  const icao = airport.icao.toLowerCase();
  if (iata === query) return 0;
  if (icao && icao === query) return 1;
  if (query.length >= 2 && iata.startsWith(query)) return 2;

  const city = foldSearchText(airport.city);
  const name = foldSearchText(airport.name);
  const country = foldedCountry(airport.countryCode);
  if (city.startsWith(query) || name.startsWith(query)) return 3;
  if (query.length >= 3 && country.startsWith(query)) return 4;

  const haystack = `${city} ${name} ${country} ${iata} ${icao}`;
  const words = haystack.split(' ');
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 5;
  if (query.length >= 3 && haystack.includes(query)) return 6;
  return -1;
}

export function searchAirports<T extends SearchableAirport>(rawQuery: string, airports: readonly T[], options: AirportSearchOptions = {}): T[] {
  const query = foldSearchText(rawQuery.slice(0, MAX_QUERY_LENGTH));
  if (!query) return [];
  const tokens = query.split(' ');
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);

  const scored: { airport: T; score: number }[] = [];
  for (const airport of airports) {
    if (options.filter && !options.filter(airport)) continue;
    const score = scoreAirport(airport, query, tokens);
    if (score >= 0) scored.push({ airport, score });
  }
  scored.sort((a, b) => a.score - b.score || Number(MAJOR_HUBS.has(b.airport.iata)) - Number(MAJOR_HUBS.has(a.airport.iata)) || SIZE_RANK[a.airport.size] - SIZE_RANK[b.airport.size] || a.airport.iata.localeCompare(b.airport.iata));
  return scored.slice(0, limit).map((entry) => entry.airport);
}

/** The two lines a result row shows, e.g. "London Heathrow Airport" / "LHR · London, United Kingdom". */
export function describeAirportResult(airport: SearchableAirport): { title: string; subtitle: string } {
  return { title: airport.name, subtitle: `${airport.iata} · ${airport.city}, ${getCountryName(airport.countryCode)}` };
}
