import type { PakistanAirport, PakistanAirportCode } from './types';

/**
 * Deliberately minimal per-airport configuration — only what routing
 * actually needs. New Pakistan airports can be added here later without
 * touching journey.ts or outcomes.ts.
 *
 * routingAddress is a free-text query, not a hand-typed coordinate — the
 * Routes API resolves it as an ordinary address origin, the same way
 * Manchester's own DRIVE request already resolves its destination via a
 * free-text address rather than a coordinate. Nothing here invents an
 * airport location Google itself hasn't already confirmed it understands.
 *
 * Pakistan Standard Time (Asia/Karachi) applies nationwide with no
 * daylight saving — one timeZone value is correct for all three airports,
 * not an oversight.
 */
export const PAKISTAN_AIRPORTS: Readonly<Record<PakistanAirportCode, PakistanAirport>> = {
  ISB: {
    code: 'ISB',
    displayName: 'Islamabad International Airport',
    timeZone: 'Asia/Karachi',
    routingAddress: 'Islamabad International Airport, Pakistan',
  },
  LHE: {
    code: 'LHE',
    displayName: 'Allama Iqbal International Airport, Lahore',
    timeZone: 'Asia/Karachi',
    routingAddress: 'Allama Iqbal International Airport, Lahore, Pakistan',
  },
  KHI: {
    code: 'KHI',
    displayName: 'Jinnah International Airport, Karachi',
    timeZone: 'Asia/Karachi',
    routingAddress: 'Jinnah International Airport, Karachi, Pakistan',
  },
};

export const PAKISTAN_AIRPORT_CODES = Object.keys(PAKISTAN_AIRPORTS) as PakistanAirportCode[];

export function getPakistanAirport(code: PakistanAirportCode): PakistanAirport {
  return PAKISTAN_AIRPORTS[code];
}
