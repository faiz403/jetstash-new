import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAirportCapability, resolveAirportProfile, ROAD_CAPABILITY_EVIDENCE } from '@/lib/arrive-by-shared/airport-capability';
import { ARRIVE_BY_RELEASED_AIRPORTS, getGenericAirportRelease } from '@/lib/arrive-by-shared/airport-release';
import { getArrivalAirportOptions } from '@/lib/arrive-by-journey/airport-options';
import { resolveJourneyAirports } from '@/lib/arrive-by-journey/airports';
import { getPublicJourneyRoutePairs } from '@/lib/arrive-by-journey/public-route-pairs';

const at = (date: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${date}T12:00:00Z`)); };
afterEach(() => vi.useRealTimers());

describe('Delhi individual road-only beta', () => {
  it('uses recorded capability evidence and keeps its existing review deadline', () => {
    expect(ROAD_CAPABILITY_EVIDENCE.DEL).toMatchObject({ status: 'road_supported', verifiedDate: '2026-09-30', checks: { identityVerified: true, routeProbed: true } });
    expect(ARRIVE_BY_RELEASED_AIRPORTS.DEL).toMatchObject({ status: 'public_beta', decidedDate: '2026-11-15', evidenceReviewDueDate: '2026-12-29' });
  });

  it('does not retroactively release an airport before the recorded decision date', () => {
    at('2026-11-14');
    expect(getAirportCapability('DEL')?.journeyEligible).toBe(false);
    expect(getGenericAirportRelease('DEL', undefined, '2026-11-15')).toBe('public_beta');
    expect(getGenericAirportRelease('DEL', undefined, '2026-12-30')).toBe('internal_only');
  });

  it('uses airport-level road pickup in India with Asia/Kolkata local time', () => {
    at('2026-11-15');
    expect(resolveJourneyAirports('LHR', 'DEL', 'public', 'LIVE').ok).toBe(true);
    expect(resolveAirportProfile('DEL')).toMatchObject({ countryCode: 'IN', timeZone: 'Asia/Kolkata', journeyEngine: 'ROAD_PICKUP_FIRST', routing: { originPrecision: 'airport' }, destinationRules: { expectedCountryCodes: ['IN'], policy: { mode: 'SAME_COUNTRY' } } });
    expect(getArrivalAirportOptions('public').find((a) => a.code === 'DEL')).toMatchObject({ timeZone: 'Asia/Kolkata' });
  });

  it('offers only currently supported route entry points and removes Delhi when its release expires', () => {
    at('2026-11-15');
    const pairs = getPublicJourneyRoutePairs('2026-11-15');
    expect(pairs.some((pair) => pair.routeSlug === 'london-heathrow-delhi')).toBe(true);
    expect(pairs.some((pair) => pair.routeSlug === 'manchester-delhi')).toBe(false);
    for (const code of ['BOM', 'AMD', 'DAC', 'DXB', 'JFK']) expect(getAirportCapability(code)?.journeyEligible, code).toBe(false);
    at('2026-12-30');
    expect(getArrivalAirportOptions('public').some((a) => a.code === 'DEL')).toBe(false);
    expect(resolveJourneyAirports('LHR', 'DEL', 'public', 'LIVE')).toMatchObject({ ok: false, reason: 'AIRPORT_NOT_SUPPORTED' });
  });
});
