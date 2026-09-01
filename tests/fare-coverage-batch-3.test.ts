import { describe, expect, it } from 'vitest';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { getFareSignalForRoute, shouldShowNoFareFallback } from '@/lib/fare-signal';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';

const NOW_ISO = '2026-08-13';

const BATCH_3: Record<string, { id: string; price: number; directness: 'direct' | 'connecting'; baggage: string }> = {
  'london-heathrow-mumbai': { id: 'obs-lhr-bom-economy-20260813-8w-v1', price: 424, directness: 'connecting', baggage: '1 free carry-on; 1st checked bag available for a fee' },
  'london-heathrow-lahore': { id: 'obs-lhr-lhe-economy-20260813-8w-v1', price: 489, directness: 'connecting', baggage: '1 free carry-on; no checked bags' },
  'london-heathrow-dubai': { id: 'obs-lhr-dxb-economy-20260813-8w-v1', price: 386, directness: 'connecting', baggage: '1 free carry-on; 1st checked bag free' },
  'london-gatwick-dubai': { id: 'obs-lgw-dxb-economy-20260813-8w-v1', price: 462, directness: 'connecting', baggage: '1 free carry-on; 1st checked bag free' },
  'glasgow-dalaman': { id: 'obs-gla-dlm-economy-20260813-8w-v1', price: 510, directness: 'connecting', baggage: '1 free carry-on; 1st checked bag available for a fee' },
  'bristol-antalya': { id: 'obs-brs-ayt-economy-20260813-8w-v1', price: 398, directness: 'connecting', baggage: '1 carry-on bag available for a fee; 1st checked bag available for a fee' },
  'newcastle-dalaman': { id: 'obs-ncl-dlm-economy-20260813-8w-v1', price: 313, directness: 'direct', baggage: 'not stated; optional charges may apply' },
  'bristol-marrakech': { id: 'obs-brs-rak-economy-20260813-8w-v1', price: 307, directness: 'connecting', baggage: '1 free carry-on; 1st checked bag available for a fee' },
  'birmingham-agadir': { id: 'obs-bhx-aga-economy-20260813-8w-v1', price: 214, directness: 'direct', baggage: '1 free carry-on; 1st checked bag available for a fee' },
  'manchester-barcelona': { id: 'obs-man-bcn-economy-20260813-8w-v1', price: 45, directness: 'direct', baggage: '1 carry-on bag available for a fee; 1st checked bag available for a fee' },
  'manchester-rome': { id: 'obs-man-rom-economy-20260813-8w-v1', price: 55, directness: 'direct', baggage: '1 carry-on bag available for a fee; 1st checked bag available for a fee' },
  'birmingham-athens': { id: 'obs-bhx-ath-economy-20260813-8w-v1', price: 214, directness: 'connecting', baggage: '1 free carry-on; 1st checked bag available for a fee' },
};

describe('Fare Coverage Programme Batch 3', () => {
  it('adds exactly twelve complete append-only observations under the locked profile', () => {
    const ids = Object.values(BATCH_3).map((entry) => entry.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    for (const [routeSlug, expected] of Object.entries(BATCH_3)) {
      const observation = fareObservations.find((entry) => entry.id === expected.id);
      expect(observation, routeSlug).toBeDefined();
      expect(observation!.routeSlug, routeSlug).toBe(routeSlug);
      expect(observation!.observedDate, routeSlug).toBe(NOW_ISO);
      expect(observation!.departureDate, routeSlug).toBe('2026-10-08');
      expect(observation!.returnDate, routeSlug).toBe('2026-10-22');
      expect(observation!.cabin, routeSlug).toBe('Economy');
      expect(observation!.currency, routeSlug).toBe('GBP');
      expect(observation!.price, routeSlug).toBe(expected.price);
      expect(observation!.observationReason, routeSlug).toBe('routine-weekly');
      expect(observation!.observedVia, routeSlug).toBe('google-flights');
      expect(observation!.comparisonEligibility, routeSlug).toBe('current');
      expect(observation!.fareDirectness, routeSlug).toBe(expected.directness);
      expect(observation!.outboundDirectness, routeSlug).toBe(expected.directness);
      expect(observation!.returnDirectness, routeSlug).toBe(expected.directness);
      expect(observation!.baggage, routeSlug).toBe(expected.baggage);
      expect(observation!.sourceUrl, routeSlug).toMatch(/^https:\/\/www\.google\.com\/travel\/flights\?/);
      expect(observation!.profileId, routeSlug).toContain('-economy-1adult-23kg-v1');
    }
  });

  it('restores a complete fresh Heathrow-Mumbai signal without altering the incomplete historic observation', () => {
    // Classification B: the 18 August 2026 Weekly Full Fare Refresh #1
    // observation this test names is after the file's 13 Aug NOW_ISO.
    const WEEKLY_FULL_FARE_REFRESH_1_ISO = '2026-08-18';
    const historic = fareObservations.find((entry) => entry.id === 'obs-lhr-bom-economy-2');
    expect(historic).toMatchObject({ price: 491 });
    expect(historic?.currency).toBeUndefined();
    // 18 August 2026: Weekly Full Fare Refresh #1 added a newer, later
    // observation (Etihad, £450), which is now the latest.
    expect(getFareSignalForRoute('london-heathrow-mumbai', WEEKLY_FULL_FARE_REFRESH_1_ISO)).toMatchObject({ state: 'current', observation: { id: 'obs-lhr-bom-economy-20260818-8w-v1', price: 450 } });
  });

  it('uses the approved Birmingham-Athens replacement because the exact Leeds Bradford-Bodrum search returned no result', () => {
    // Classification B: see the identical Heathrow-Mumbai test above.
    const WEEKLY_FULL_FARE_REFRESH_1_ISO = '2026-08-18';
    expect(fareObservations.some((entry) => entry.routeSlug === 'leeds-bradford-bodrum' && entry.observedDate === NOW_ISO)).toBe(false);
    // 18 August 2026: Weekly Full Fare Refresh #1 appended a second
    // genuine, publishable observation for birmingham-athens.
    expect(getPublishableObservationsByRoute('birmingham-athens', WEEKLY_FULL_FARE_REFRESH_1_ISO)).toHaveLength(2);
  });

  it('keeps current display-ready coverage aligned with Fare Signals after later append-only batches', () => {
    // Classification B: this test's own comment trail narrates the 83-route
    // coverage count through 22 August 2026 (79→78→82→83). Deliberately NOT
    // moved further forward to 31 August: by then manchester-delhi and
    // manchester-mumbai genuinely drop out of coverage too (IndiGo's
    // announced direct-service withdrawal, effective 31 Aug 2026 --
    // data/route-status-events.ts -- a real, unrelated route-truth event,
    // not a data or fix defect), so coverage is NOT monotonic across that
    // boundary and 83 is only true at 22 Aug specifically.
    const COVERAGE_83_ROUTES_ISO = '2026-08-22';
    const current = routes.filter((route) => getPublishableObservationsByRoute(route.slug, COVERAGE_83_ROUTES_ISO).length > 0);
    // 79→78 on 18 August 2026: Route Verification Refresh Batch 1's correction
    // reclassified london-gatwick-ahmedabad unverified, dropping its fare
    // observation out of isObservationPublishable(). 78→82 on 22 August 2026
    // (Fare Coverage Batch 1): four routes each gained a fresh, evidenced
    // observation (leeds-bradford-bodrum's first-ever fare; fresh rechecks
    // for manchester-karachi, birmingham-lahore, birmingham-islamabad
    // following COV-001's 21 August reclassification). 82→83, same day
    // (Connecting Journey Structure + BHX-DEL unlock): birmingham-delhi's
    // 13 August observation was unsuppressed and a fresh 22 August one
    // appended.
    expect(current).toHaveLength(83);
    // Fare Signal poor-itinerary suppression (31 Aug 2026): "tracked" (has
    // any publishable observation, checked above) and "signalled" (has a
    // displayable current Fare Signal) are no longer the same question by
    // design — 7 of these 83 tracked routes correctly show no current fare
    // because their only publishable observation is a confirmed
    // self-transfer, 2+-stop-per-leg itinerary. See
    // tests/fare-signal.test.ts's "every route with a non-empty Fare Signal
    // genuinely has tracked observations" test for the full account.
    // Checked at 31 Aug (later than the 22 Aug coverage snapshot) so this
    // suppression fix's own evidence is visible.
    const SUPPRESSION_ISO = '2026-08-31';
    const knownSuppressed = new Set([
      'manchester-lahore', 'birmingham-amritsar', 'manchester-dubai', 'london-heathrow-doha',
      'london-heathrow-jeddah', 'london-gatwick-amritsar', 'birmingham-delhi',
    ]);
    // manchester-delhi and manchester-mumbai are excluded from this loop:
    // by 31 Aug they correctly lose their Fare Signal too, but for the
    // unrelated IndiGo-withdrawal reason above, not poor-itinerary
    // suppression — asserting either branch for them here would conflate
    // two different product facts.
    const routeStatusWithdrawnBy31Aug = new Set(['manchester-delhi', 'manchester-mumbai']);
    for (const route of current) {
      if (routeStatusWithdrawnBy31Aug.has(route.slug)) continue;
      const signal = getFareSignalForRoute(route.slug, SUPPRESSION_ISO);
      if (knownSuppressed.has(route.slug)) {
        expect(signal.state, route.slug).toBe('none');
        continue;
      }
      expect(signal.state, route.slug).toBe('current');
      expect(shouldShowNoFareFallback(signal), route.slug).toBe(false);
    }
  });

  it('keeps the archive duplicate-free and does not manufacture a Standout Fare', () => {
    const ids = fareObservations.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    expect(candidates.every((candidate) => candidate.qualification !== 'standout-candidate')).toBe(true);
  });
});
