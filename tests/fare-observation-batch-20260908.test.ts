import { describe, expect, it } from 'vitest';
import { fareObservations } from '@/data/fare-observations';

const expected = [
  ['manchester-lahore', 423],
  ['manchester-islamabad', 428],
  ['london-heathrow-delhi', 411],
  ['birmingham-amritsar', 713],
  ['london-heathrow-jeddah', 451],
  ['london-heathrow-mumbai', 396],
  ['manchester-dubai', 420],
  ['london-heathrow-doha', 463],
  ['birmingham-mumbai', 512],
] as const;

describe('8 September 2026 Tier A + Tier B fare batch', () => {
  it('contains exactly the recovered nine observations with the source dimensions intact', () => {
    const batch = fareObservations.filter((observation) => observation.id.includes('20260908-8w-v1'));
    expect(batch).toHaveLength(9);
    expect(new Set(batch.map((observation) => observation.id)).size).toBe(9);
    expect(batch.map((observation) => [observation.routeSlug, observation.price])).toEqual(expected);

    for (const observation of batch) {
      expect(observation.observedDate).toBe('2026-09-08');
      expect(observation.departureDate).toBe('2026-11-03');
      expect(observation.returnDate).toBe('2026-11-17');
      expect(observation.cabin).toBe('Economy');
      expect(observation.currency).toBe('GBP');
      expect(observation.profileId).toContain('1adult');
      expect(observation.observedVia).toBe('google-flights');
      expect(observation.price).toBeGreaterThan(0);
      expect(observation.priceNote).toBeTruthy();
      expect(observation.baggage).toBeTruthy();
    }
  });

  it('keeps the batch range local to these records', () => {
    const batch = fareObservations.filter((observation) => observation.id.includes('20260908-8w-v1'));
    expect(Math.min(...batch.map((observation) => observation.price))).toBe(396);
    expect(Math.max(...batch.map((observation) => observation.price))).toBe(713);
  });
});
