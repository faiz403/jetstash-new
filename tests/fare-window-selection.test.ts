import { describe, expect, it } from 'vitest';
import { deriveFareSignal } from '@/lib/fare-signal';
import type { FareObservation } from '@/data/fare-observations';
import { getRollingFareTravelWindow, isObservationWithinRollingFareWindow, STANDARD_FARE_STAY_PROFILES } from '@/lib/fare-window';

const NOW = '2026-10-04';

function observation(overrides: Partial<FareObservation>): FareObservation {
  return {
    id: 'fixture', routeSlug: 'manchester-delhi', cabin: 'Economy', observedDate: '2026-10-04',
    price: 500, priceNote: 'return, one adult; protected one-stop itinerary', source: 'Etihad',
    currency: 'GBP', comparisonEligibility: 'current', departureDate: '2026-12-03', returnDate: '2026-12-17',
    fareDirectness: 'connecting', outboundDirectness: 'connecting', returnDirectness: 'connecting',
    outboundStops: 1, returnStops: 1, ...overrides,
  };
}

describe('rolling three-month lowest-fare policy', () => {
  it('uses the approved five standard stay profiles and keeps both dates inside the window', () => {
    expect(STANDARD_FARE_STAY_PROFILES).toEqual([7, 14, 21, 28, 42]);
    expect(getRollingFareTravelWindow(NOW)).toEqual({ startDate: '2026-10-04', endDate: '2027-01-04' });
    expect(isObservationWithinRollingFareWindow(observation({ departureDate: '2026-12-03', returnDate: '2027-01-04' }), NOW)).toBe(true);
    expect(isObservationWithinRollingFareWindow(observation({ departureDate: '2027-01-04', returnDate: '2027-02-15' }), NOW)).toBe(false);
  });

  it('chooses the lowest clean fare across different stay lengths, not the newest fare', () => {
    const signal = deriveFareSignal([
      observation({ id: 'october', price: 645, observedDate: '2026-10-04', departureDate: '2026-10-17', returnDate: '2026-10-31' }),
      observation({ id: 'december', price: 450, observedDate: '2026-10-04', departureDate: '2026-12-03', returnDate: '2027-01-03' }),
    ], NOW);
    expect(signal.observation?.id).toBe('december');
    expect(signal.observation?.price).toBe(450);
    expect(signal.observation?.departureDate).toBe('2026-12-03');
    expect(signal.observation?.returnDate).toBe('2027-01-03');
  });

  it('prefers a clean fare over a cheaper self-transfer, then uses self-transfer only when clean is absent', () => {
    const clean = observation({ id: 'clean', price: 450 });
    const selfTransfer = observation({ id: 'self', price: 390, priceNote: 'return; self-transfer between separate tickets' });
    expect(deriveFareSignal([clean, selfTransfer], NOW).observation?.id).toBe('clean');
    expect(deriveFareSignal([selfTransfer], NOW).observation?.id).toBe('self');
  });
});
