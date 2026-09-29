import { getCatalogueAirports, type CatalogueAirport } from './airport-catalogue';
import { searchAirports, type AirportSearchOptions } from './airport-search';

/**
 * Search across the full worldwide catalogue. Imports the catalogue data, so
 * it must only be used server-side or behind a lazy load -- never from a
 * component that ships in the initial client bundle (use airport-search.ts
 * with an explicit airport list there).
 */
export function searchCatalogue(query: string, options?: AirportSearchOptions): CatalogueAirport[] {
  return searchAirports(query, getCatalogueAirports(), options);
}
