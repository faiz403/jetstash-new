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
    const historic = fareObservations.find((entry) => entry.id === 'obs-lhr-bom-economy-2');
    expect(historic).toMatchObject({ price: 491 });
    expect(historic?.currency).toBeUndefined();
    expect(getFareSignalForRoute('london-heathrow-mumbai', NOW_ISO)).toMatchObject({ state: 'current', observation: { id: 'obs-lhr-bom-economy-20260813-8w-v1', price: 424 } });
  });

  it('uses the approved Birmingham-Athens replacement because the exact Leeds Bradford-Bodrum search returned no result', () => {
    expect(fareObservations.some((entry) => entry.routeSlug === 'leeds-bradford-bodrum' && entry.observedDate === NOW_ISO)).toBe(false);
    expect(getPublishableObservationsByRoute('birmingham-athens', NOW_ISO)).toHaveLength(1);
  });

  it('keeps current display-ready coverage aligned with Fare Signals after later append-only batches', () => {
    const current = routes.filter((route) => getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0);
    expect(current).toHaveLength(79);
    for (const route of current) {
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
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
