import { PAKISTAN_AIRPORT_CODES } from './airports';
import { cleanRoadInput } from '@/lib/arrive-by-shared/clean-road-input';
import type { PakistanAirportCode, PakistanJourneyInput } from './types';

/**
 * Pakistan's request validation is the shared road-first validation
 * (lib/arrive-by-shared/clean-road-input.ts) with Pakistan's own
 * three-airport membership check -- one place so the founder route, the
 * public route and the generic worldwide route can never drift.
 */
export function cleanInput(value: unknown): PakistanJourneyInput {
  const input = cleanRoadInput(value, (code) => (PAKISTAN_AIRPORT_CODES as string[]).includes(code));
  return { ...input, airportCode: input.airportCode as PakistanAirportCode };
}
