import { getPakistanAirport } from './airports';
import { computeRoadJourney } from '@/lib/arrive-by-shared/road-journey';
import type { PakistanJourneyInput, PakistanJourneyResult } from './types';

/**
 * Pakistan's journey calculation is the shared road-first engine
 * (lib/arrive-by-shared/road-journey.ts -- see it for the formula and the
 * confirmation/selection safety rules) run with Pakistan's own validated
 * airport configuration: a routing address Google itself resolves, the
 * Asia/Karachi timezone, and the PK-only destination policy with region
 * bias 'pk'. Behaviour is unchanged from before that engine was extracted.
 */
export async function computePakistanJourney(apiKey: string, input: PakistanJourneyInput): Promise<PakistanJourneyResult> {
  const airport = getPakistanAirport(input.airportCode);
  const result = await computeRoadJourney(
    apiKey,
    { code: airport.code, displayName: airport.displayName, timeZone: airport.timeZone, origin: { kind: 'address', value: airport.routingAddress } },
    input,
    { expectedCountryCodes: ['PK'], regionBias: 'pk' },
  );
  return result as PakistanJourneyResult;
}
