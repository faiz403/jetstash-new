import { describe, expect, it } from 'vitest';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { getFareSignalForRoute, shouldShowNoFareFallback } from '@/lib/fare-signal';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';

const NOW_ISO = '2026-08-14';

const BATCH_5 = [
  ['bristol-rome', 'obs-brs-rom-economy-20260814-8w-v1', 162],
  ['london-gatwick-istanbul', 'obs-lgw-saw-economy-20260814-8w-v1', 149],
  ['glasgow-bodrum', 'obs-gla-bod-economy-20260814-8w-v1', 618],
  ['london-gatwick-marrakech', 'obs-lgw-rak-economy-20260814-8w-v1', 80],
  ['london-heathrow-casablanca', 'obs-lhr-cmn-economy-20260814-8w-v1', 220],
  ['london-gatwick-izmir', 'obs-lgw-adb-economy-20260814-8w-v1', 258],
  ['london-gatwick-agadir', 'obs-lgw-aga-economy-20260814-8w-v1', 187],
  ['london-gatwick-tangier', 'obs-lgw-tng-economy-20260814-8w-v1', 112],
] as const;

describe('Fare Coverage Programme Batch 5', () => {
  it('adds exactly eight complete append-only observations under the locked 14 August profile', () => {
    expect(BATCH_5).toHaveLength(8);
    for (const [routeSlug, id, price] of BATCH_5) {
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
      expect(observation?.sourceUrl).toMatch(/^https:\/\/www\.google\.com\/travel\/flights(?:\/search)?\?/);
      expect(observation?.baggage).toBeTruthy();
      expect(observation?.fareDirectness).not.toBe('unknown');
    }
  });

  it('keeps the generic-Istanbul observation archived but excludes it from public methodology-compliant output', () => {
    const generic = fareObservations.find((entry) => entry.id === 'obs-lgw-ist-economy-20260814-8w-v1');
    expect(generic).toMatchObject({
      routeSlug: 'london-gatwick-istanbul',
      price: 149,
      sourceUrl: 'https://www.google.com/travel/flights?q=Flights%20from%20London%20Gatwick%20to%20Istanbul%20October%208%202026%20return%20October%2022%202026&curr=GBP&hl=en&gl=GB',
    });
    // 18 August 2026: Weekly Full Fare Refresh #1 appended a second,
    // genuine, publishable observation for this route (exact LGW-IST
    // pair, Pegasus, direct both ways).
    expect(getPublishableObservationsByRoute('london-gatwick-istanbul', NOW_ISO).map((entry) => entry.id)).toEqual([
      'obs-lgw-saw-economy-20260814-8w-v1',
      'obs-lgw-ist-economy-20260818-8w-v1',
    ]);
    expect(getFareSignalForRoute('london-gatwick-istanbul', NOW_ISO).observation?.id).toBe('obs-lgw-ist-economy-20260818-8w-v1');
  });

  it('leaves Leeds Bradford–Bodrum uncovered because the exact controlled search returned no options', () => {
    expect(getPublishableObservationsByRoute('leeds-bradford-bodrum', NOW_ISO)).toHaveLength(0);
    expect(getFareSignalForRoute('leeds-bradford-bodrum', NOW_ISO).state).toBe('none');
  });

  it('raises current display-ready coverage to 79 routes without contradictory fallbacks', () => {
    // Batch 5 genuinely raised coverage to 79 at the time (14 August 2026); the
    // assertion below tracks live current-state data, which dropped to 78 on
    // 18 August 2026 when Route Verification Refresh Batch 1's correction
    // reclassified london-gatwick-ahmedabad unverified, dropping its fare
    // observation out of isObservationPublishable(). The 79-route Batch 5
    // outcome remains an accurate historical record for 14 August 2026.
    const current = routes.filter((route) => getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0);
    expect(current).toHaveLength(78);
    for (const route of current) {
      expect(shouldShowNoFareFallback(getFareSignalForRoute(route.slug, NOW_ISO)), route.slug).toBe(false);
    }
  });

  it('keeps Fare Watcher fail-closed', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    expect(candidates.every((candidate) => candidate.qualification !== 'standout-candidate')).toBe(true);
  });
});
