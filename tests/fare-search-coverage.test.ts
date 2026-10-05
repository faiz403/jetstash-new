import { describe, expect, it } from 'vitest';
import type { FareObservation } from '@/data/fare-observations';
import { deriveFareSignal } from '@/lib/fare-signal';
import { getFreshFareCoverageLevel, hasFreshThreeMonthSearchCoverage } from '@/lib/fare-window';

const NOW = '2026-10-04';

const base: FareObservation = {
  id: 'coverage-fixture', routeSlug: 'manchester-delhi', cabin: 'Economy', observedDate: NOW,
  price: 450, priceNote: 'return, protected one-stop itinerary', source: 'Etihad', currency: 'GBP',
  comparisonEligibility: 'current', departureDate: '2026-12-03', returnDate: '2026-12-17',
  fareDirectness: 'connecting', outboundDirectness: 'connecting', returnDirectness: 'connecting',
  searchCoverage: { level: 'full-continuous', method: 'flexible-date', windowStart: '2026-10-04', windowEnd: '2027-01-04', stayMinNights: 7, stayMaxNights: 42, searchedAt: '2026-10-04T12:00:00Z', source: 'google-flights', continuousStayRange: { minNights: 7, maxNights: 42 } },
};

describe('three-month fare search provenance', () => {
  it('qualifies only a fresh broad flexible-date search', () => {
    expect(hasFreshThreeMonthSearchCoverage(base, NOW)).toBe(true);
    expect(hasFreshThreeMonthSearchCoverage({ ...base, searchCoverage: { ...base.searchCoverage!, level: 'full-profiled', continuousStayRange: undefined, stayProfiles: [7, 14, 21, 28, 42] } }, NOW)).toBe(false);
    expect(hasFreshThreeMonthSearchCoverage({ ...base, searchCoverage: { ...base.searchCoverage!, continuousStayRange: undefined } }, NOW)).toBe(false);
  });

  it('uses factual wording for an old spot observation without coverage provenance', () => {
    const signal = deriveFareSignal([{ ...base, id: 'spot', searchCoverage: undefined }], NOW);
    expect(signal.observation?.hasThreeMonthSearchCoverage).toBe(false);
  });

  it('distinguishes a complete profiled search from continuous coverage', () => {
    const profiled = { ...base, searchCoverage: { ...base.searchCoverage!, level: 'full-profiled' as const, continuousStayRange: undefined, stayProfiles: [7, 14, 21, 28, 42] } };
    expect(getFreshFareCoverageLevel(profiled, NOW)).toBe('full-profiled');
    expect(hasFreshThreeMonthSearchCoverage(profiled, NOW)).toBe(false);
  });

  it('keeps partial and fixed evidence on their truthful wording paths', () => {
    expect(getFreshFareCoverageLevel({ ...base, searchCoverage: { ...base.searchCoverage!, level: 'partial', method: 'partial', continuousStayRange: undefined } }, NOW)).toBe('partial');
    expect(getFreshFareCoverageLevel({ ...base, searchCoverage: { ...base.searchCoverage!, level: 'fixed', method: 'fixed-date', continuousStayRange: undefined } }, NOW)).toBe('fixed');
  });
});
