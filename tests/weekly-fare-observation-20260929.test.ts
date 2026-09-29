import { describe, expect, it } from 'vitest';
import { fareObservations, isPubliclyPublishable } from '@/data/fare-observations';

const BATCH_DATE = '2026-09-29';
const DEPARTURE_DATE = '2026-11-17';
const RETURN_DATE = '2026-12-01';

const KAYAK_FALLBACK_ROUTES = [
  'leeds-bradford-antalya',
  'leeds-bradford-dalaman',
  'leeds-bradford-bodrum',
  'glasgow-dalaman',
  'bristol-antalya',
  'bristol-dalaman',
  'newcastle-dalaman',
  'leeds-bradford-islamabad',
];

describe('weekly fare observation batch — 29 September 2026', () => {
  const batch = fareObservations.filter((observation) => observation.observedDate === BATCH_DATE && observation.observationReason === 'routine-weekly');

  it('accounts for all 89 public fare-tracked routes exactly once', () => {
    expect(batch).toHaveLength(89);
    expect(new Set(batch.map((observation) => observation.routeSlug)).size).toBe(89);
  });

  it('uses the locked Tuesday control profile and remains publicly publishable', () => {
    for (const observation of batch) {
      expect(observation).toMatchObject({
        cabin: 'Economy',
        currency: 'GBP',
        observationReason: 'routine-weekly',
        comparisonEligibility: 'current',
        departureDate: DEPARTURE_DATE,
        returnDate: RETURN_DATE,
      });
      expect(isPubliclyPublishable(observation)).toBe(true);
      expect(observation.price).toBeGreaterThan(0);
      expect(observation.baggage).toBeTruthy();
      expect(observation.profileId).toBeTruthy();
    }
  });

  it('keeps KAYAK as a fallback-only source for the eight Google-unavailable routes', () => {
    const kayakRoutes = batch
      .filter((observation) => observation.observedVia === 'kayak')
      .map((observation) => observation.routeSlug)
      .sort();

    expect(kayakRoutes).toEqual([...KAYAK_FALLBACK_ROUTES].sort());
    expect(batch.filter((observation) => observation.observedVia === 'google-flights')).toHaveLength(81);
  });
});
