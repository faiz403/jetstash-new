import { describe, expect, it } from 'vitest';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { getFareSignalForRoute, shouldShowNoFareFallback } from '@/lib/fare-signal';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';

const NOW_ISO = '2026-08-14';

const BATCH_4 = [
  ['london-gatwick-bodrum', 'obs-lgw-bod-economy-20260814-8w-v1', 179],
  ['london-gatwick-faro', 'obs-lgw-fao-economy-20260814-8w-v1', 84],
  ['london-gatwick-barcelona', 'obs-lgw-bcn-economy-20260814-8w-v1', 48],
  ['birmingham-rome', 'obs-bhx-rom-economy-20260814-8w-v1', 148],
  ['manchester-athens', 'obs-man-ath-economy-20260814-8w-v1', 175],
  ['birmingham-barcelona', 'obs-bhx-bcn-economy-20260814-8w-v1', 55],
  ['bristol-barcelona', 'obs-brs-bcn-economy-20260814-8w-v1', 41],
  ['leeds-bradford-barcelona', 'obs-lba-bcn-economy-20260814-8w-v1', 229],
  ['london-gatwick-rome', 'obs-lgw-rom-economy-20260814-8w-v1', 107],
  ['london-gatwick-athens', 'obs-lgw-ath-economy-20260814-8w-v1', 128],
  ['london-gatwick-dalaman', 'obs-lgw-dlm-economy-20260814-8w-v1', 137],
  ['london-gatwick-antalya', 'obs-lgw-ayt-economy-20260814-8w-v1', 137],
] as const;

describe('Fare Coverage Programme Batch 4', () => {
  it('adds exactly twelve complete append-only observations under the locked 14 August profile', () => {
    expect(BATCH_4).toHaveLength(12);
    for (const [routeSlug, id, price] of BATCH_4) {
      const observation = fareObservations.find((entry) => entry.id === id);
      expect(observation, routeSlug).toMatchObject({
        routeSlug,
        observedDate: NOW_ISO,
        price,
        cabin: 'Economy',
        currency: 'GBP',
        observationReason: 'routine-weekly',
        comparisonEligibility: 'current',
        departureDate: '2026-10-08',
        returnDate: '2026-10-22',
      });
      expect(observation?.sourceUrl).toMatch(/^https:\/\/www\.google\.com\/travel\/flights\?/);
      expect(observation?.baggage).toBeTruthy();
      expect(observation?.fareDirectness).not.toBe('unknown');
    }
  });

  it('keeps current display-ready coverage aligned after later append-only batches', () => {
    const current = routes.filter((route) => getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0);
    expect(current).toHaveLength(79);
    for (const route of current) {
      expect(shouldShowNoFareFallback(getFareSignalForRoute(route.slug, NOW_ISO)), route.slug).toBe(false);
    }
  });

  it('keeps Fare Watcher fail-closed: no public Standout Fare candidate is manufactured', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    expect(candidates.every((candidate) => candidate.qualification !== 'standout-candidate')).toBe(true);
  });
});
