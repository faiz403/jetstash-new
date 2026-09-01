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
    // Classification B: the 18 August 2026 Weekly Full Fare Refresh #1
    // observation this test names is after the file's 14 Aug NOW_ISO.
    const WEEKLY_FULL_FARE_REFRESH_1_ISO = '2026-08-18';
    expect(getPublishableObservationsByRoute('london-gatwick-istanbul', WEEKLY_FULL_FARE_REFRESH_1_ISO).map((entry) => entry.id)).toEqual([
      'obs-lgw-saw-economy-20260814-8w-v1',
      'obs-lgw-ist-economy-20260818-8w-v1',
    ]);
    expect(getFareSignalForRoute('london-gatwick-istanbul', WEEKLY_FULL_FARE_REFRESH_1_ISO).observation?.id).toBe('obs-lgw-ist-economy-20260818-8w-v1');
  });

  it('Batch 5\'s own controlled search (14 August 2026) genuinely found no options for Leeds Bradford–Bodrum at the time — a real gap that stood until Fare Coverage Batch 1 closed it on 22 August 2026', () => {
    // Historical fact, unaffected by later data: Batch 5's exact controlled
    // search on 14 August 2026 returned nothing for this route — the
    // archive has no observation dated on or before 14 August 2026 for it.
    // (The archive is append-only and has no observedDate<=nowIso gate, so
    // asserting "still zero observations as evaluated at this historical
    // date" no longer holds once ANY observation is ever added, regardless
    // of its own date — that's why this checks observedDate directly
    // rather than re-running the old length-0 assertion.)
    const observations = fareObservations.filter((o) => o.routeSlug === 'leeds-bradford-bodrum');
    expect(observations.every((o) => o.observedDate > NOW_ISO), 'no observation existed on or before 14 August 2026').toBe(true);
    // Fare Coverage Batch 1 (22 August 2026) closed this exact gap — the
    // route's first-ever fare, evaluated as of today, not Batch 5's date.
    const today = '2026-08-22';
    expect(getPublishableObservationsByRoute('leeds-bradford-bodrum', today).length).toBeGreaterThan(0);
    expect(getFareSignalForRoute('leeds-bradford-bodrum', today).state).toBe('current');
  });

  it('raises current display-ready coverage to 83 routes without contradictory fallbacks', () => {
    // Classification B: see tests/fare-coverage-batch-3.test.ts's identical
    // fix for the full account, including why coverage (83 routes) is
    // fixed at 22 Aug specifically -- it is NOT monotonic through 31 Aug,
    // since manchester-delhi and manchester-mumbai genuinely drop out by
    // then (IndiGo's announced direct-service withdrawal, effective 31 Aug
    // 2026 — data/route-status-events.ts). Batch 5's own 79-route outcome
    // at its 14 August evaluation date remains an accurate historical
    // record; this test tracks live coverage, not that snapshot.
    const COVERAGE_83_ROUTES_ISO = '2026-08-22';
    const current = routes.filter((route) => getPublishableObservationsByRoute(route.slug, COVERAGE_83_ROUTES_ISO).length > 0);
    expect(current).toHaveLength(83);
    // Fare Signal poor-itinerary suppression (31 Aug 2026): 7 of these 83
    // tracked routes now correctly DO show the no-fare fallback — see
    // tests/fare-coverage-batch-3.test.ts's identical update for the full
    // account.
    const SUPPRESSION_ISO = '2026-08-31';
    const knownSuppressed = new Set([
      'manchester-lahore', 'birmingham-amritsar', 'manchester-dubai', 'london-heathrow-doha',
      'london-heathrow-jeddah', 'london-gatwick-amritsar', 'birmingham-delhi',
    ]);
    const routeStatusWithdrawnBy31Aug = new Set(['manchester-delhi', 'manchester-mumbai']);
    for (const route of current) {
      if (routeStatusWithdrawnBy31Aug.has(route.slug)) continue;
      const shouldFallback = shouldShowNoFareFallback(getFareSignalForRoute(route.slug, SUPPRESSION_ISO));
      expect(shouldFallback, route.slug).toBe(knownSuppressed.has(route.slug));
    }
  });

  it('keeps Fare Watcher fail-closed', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    expect(candidates.every((candidate) => candidate.qualification !== 'standout-candidate')).toBe(true);
  });
});
