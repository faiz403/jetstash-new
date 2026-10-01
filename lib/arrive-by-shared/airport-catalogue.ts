import catalogueData from './catalogue/airports.generated.json';

/**
 * Worldwide airport catalogue -- searchable identity metadata only.
 *
 * This layer says WHICH airport a code is (name, city, country, coordinates,
 * IANA timezone). It says nothing about whether Arrive By can safely
 * compute a journey from it: that is the capability layer
 * (airport-capability.ts). Special behaviour for an airport (terminal
 * origins, transit-first engine, destination policy) lives in the
 * explicit override registry (airport-registry.ts), never here.
 *
 * Data: OurAirports (Public Domain), filtered to scheduled-service airports
 * with an IATA code and no military-only installations, timezones derived
 * offline. Regenerate with scripts/generate-arrive-by-airport-catalogue.mjs;
 * source, licence and counts are recorded in
 * catalogue/airports.provenance.json and
 * docs/product/ARRIVE_BY_AIRPORT_CATALOGUE.md.
 */

/** L = OurAirports "large_airport", M = medium, S = small. A size hint for ranking, not a guarantee of service. */
export type CatalogueAirportSize = 'L' | 'M' | 'S';

export interface CatalogueAirport {
  iata: string;
  /** Empty string when the source has no ICAO code for this airport. */
  icao: string;
  name: string;
  city: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  lat: number;
  lng: number;
  /** IANA timezone identifier -- never a browser/system assumption. */
  timeZone: string;
  size: CatalogueAirportSize;
}

interface CatalogueFile {
  columns: string[];
  timeZones: string[];
  airports: [string, string, string, string, string, number, number, number, CatalogueAirportSize][];
}

const EXPECTED_COLUMNS = ['iata', 'icao', 'name', 'city', 'countryCode', 'lat', 'lng', 'tzIndex', 'size'];

/**
 * Throws on anything that would make a catalogue entry unsafe to route
 * from. Run once per airport at load so a bad generated file fails at
 * build/test time, and exported so tests prove the guard rejects
 * fabricated bad entries rather than only that the shipped file is clean.
 */
export function assertValidCatalogueAirport(airport: CatalogueAirport): void {
  const prefix = `Catalogue airport ${airport.iata || '(no code)'}`;
  if (!/^[A-Z]{3}$/.test(airport.iata)) throw new Error(`${prefix}: IATA code must be three uppercase letters.`);
  if (airport.icao && !/^[A-Z0-9]{4}$/.test(airport.icao)) throw new Error(`${prefix}: ICAO code is malformed.`);
  if (!airport.name.trim()) throw new Error(`${prefix}: name is empty.`);
  if (!airport.city.trim()) throw new Error(`${prefix}: city is empty.`);
  if (!/^[A-Z]{2}$/.test(airport.countryCode)) throw new Error(`${prefix}: countryCode must be ISO 3166-1 alpha-2.`);
  if (!Number.isFinite(airport.lat) || !Number.isFinite(airport.lng) || Math.abs(airport.lat) > 90 || Math.abs(airport.lng) > 180) {
    throw new Error(`${prefix}: coordinates are not valid.`);
  }
  if (airport.lat === 0 && airport.lng === 0) throw new Error(`${prefix}: (0,0) is a null-island placeholder, not a real location.`);
  if (!airport.timeZone) throw new Error(`${prefix}: timeZone is missing.`);
  try {
    new Intl.DateTimeFormat('en', { timeZone: airport.timeZone });
  } catch {
    throw new Error(`${prefix}: ${airport.timeZone} is not a valid IANA timezone.`);
  }
}

function loadCatalogue(file: CatalogueFile): { list: readonly CatalogueAirport[]; byIata: ReadonlyMap<string, CatalogueAirport> } {
  if (JSON.stringify(file.columns) !== JSON.stringify(EXPECTED_COLUMNS)) {
    throw new Error('Airport catalogue column layout does not match airport-catalogue.ts -- regenerate it.');
  }
  const byIata = new Map<string, CatalogueAirport>();
  const list: CatalogueAirport[] = [];
  for (const [iata, icao, name, city, countryCode, lat, lng, tzIndex, size] of file.airports) {
    const airport: CatalogueAirport = { iata, icao, name, city, countryCode, lat, lng, timeZone: file.timeZones[tzIndex], size };
    assertValidCatalogueAirport(airport);
    if (byIata.has(iata)) throw new Error(`Duplicate IATA code ${iata} in the airport catalogue.`);
    byIata.set(iata, airport);
    list.push(airport);
  }
  return { list, byIata };
}

const { list: CATALOGUE, byIata: CATALOGUE_BY_IATA } = loadCatalogue(catalogueData as CatalogueFile);

export function getCatalogueAirports(): readonly CatalogueAirport[] {
  return CATALOGUE;
}

/** Exact IATA lookup. Input is normalised the same way as the shell's `?airport=` handling; anything not exactly a three-letter catalogue code returns undefined. */
export function getCatalogueAirport(code: string | null | undefined): CatalogueAirport | undefined {
  const normalised = code?.trim().toUpperCase();
  return normalised ? CATALOGUE_BY_IATA.get(normalised) : undefined;
}
