import { describe, expect, it } from 'vitest';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';

const NOW_ISO = '2026-08-13';

const BATCH_2: Record<string, { id: string; price: number; directness: 'direct' | 'connecting'; baggage: string }> = {
  'birmingham-delhi': { id: 'obs-bhx-del-economy-20260813-8w-v1', price: 658, directness: 'connecting', baggage: 'not stated' },
  'birmingham-ahmedabad': { id: 'obs-bhx-amd-economy-20260813-8w-v1', price: 565, directness: 'connecting', baggage: 'not stated' },
  'birmingham-dubai': { id: 'obs-bhx-dxb-economy-20260813-8w-v1', price: 407, directness: 'connecting', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'birmingham-doha': { id: 'obs-bhx-doh-economy-20260813-8w-v1', price: 393, directness: 'connecting', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'birmingham-jeddah': { id: 'obs-bhx-jed-economy-20260813-8w-v1', price: 398, directness: 'connecting', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'glasgow-dubai': { id: 'obs-gla-dxb-economy-20260813-8w-v1', price: 740, directness: 'connecting', baggage: 'not stated' },
  'edinburgh-dubai': { id: 'obs-edi-dxb-economy-20260813-8w-v1', price: 611, directness: 'connecting', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'newcastle-dubai': { id: 'obs-ncl-dxb-economy-20260813-8w-v1', price: 741, directness: 'direct', baggage: 'not stated' },
  'bristol-faro': { id: 'obs-brs-fao-economy-20260813-8w-v1', price: 67, directness: 'direct', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'manchester-faro': { id: 'obs-man-fao-economy-20260813-8w-v1', price: 85, directness: 'direct', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'birmingham-faro': { id: 'obs-bhx-fao-economy-20260813-8w-v1', price: 77, directness: 'direct', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'leeds-bradford-faro': { id: 'obs-lba-fao-economy-20260813-8w-v1', price: 52, directness: 'direct', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'bristol-dalaman': { id: 'obs-brs-dlm-economy-20260813-8w-v1', price: 253, directness: 'direct', baggage: 'not stated; overhead-bin access not included in quoted fare' },
  'glasgow-antalya': { id: 'obs-gla-ayt-economy-20260813-8w-v1', price: 608, directness: 'connecting', baggage: 'not stated' },
};

// birmingham-delhi was verification-pending as of this batch (13 August
// 2026) and stayed that way through Fare Coverage Batch 1B's exclusion —
// until Connecting Journey Structure + BHX-DEL unlock (22 August 2026)
// unsuppressed its 13 August observation and appended a fresh 22 August
// one, so it no longer belongs in this "stays excluded" list. See the
// dedicated assertion for it below the main loop.
const VERIFICATION_PENDING_BATCH_2 = ['birmingham-ahmedabad'];

describe('Fare Coverage Programme Batch 2', () => {
  it('records the twelve selected observations plus two approved replacements under the locked profile', () => {
    const ids = Object.values(BATCH_2).map((entry) => entry.id);
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    for (const [routeSlug, expected] of Object.entries(BATCH_2)) {
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

  it('renders twelve eligible Batch 2 replacements while keeping verification-pending routes excluded', () => {
    // Classification B: this test's own comments name evidence from 18 Aug
    // (Weekly Full Fare Refresh #1) and 22 Aug (Connecting Journey
    // Structure + BHX-DEL unlock) — both after the file's 13 Aug NOW_ISO.
    // Fixed at the later of the two named dates, the earliest point every
    // observation this test depends on actually existed.
    const BATCH_2_PLUS_LATER_REFRESHES_ISO = '2026-08-22';
    for (const routeSlug of Object.keys(BATCH_2).filter((slug) => !VERIFICATION_PENDING_BATCH_2.includes(slug) && slug !== 'birmingham-delhi')) {
      // 18 August 2026: Weekly Full Fare Refresh #1 appended a second
      // genuine, publishable observation for each of these twelve routes.
      expect(getPublishableObservationsByRoute(routeSlug, BATCH_2_PLUS_LATER_REFRESHES_ISO), routeSlug).toHaveLength(2);
      expect(routes.some((route) => route.slug === routeSlug), routeSlug).toBe(true);
    }
    for (const routeSlug of VERIFICATION_PENDING_BATCH_2) {
      expect(getPublishableObservationsByRoute(routeSlug, BATCH_2_PLUS_LATER_REFRESHES_ISO), routeSlug).toHaveLength(0);
    }
    // birmingham-delhi: also 2 publishable observations at this date, but
    // for a different reason than the other twelve — its 18 August refresh
    // (obs-bhx-del-economy-20260818-8w-v1) stays methodology-excluded, so
    // the 2 here are the 13 August observation (unsuppressed by Connecting
    // Journey Structure + BHX-DEL unlock) and the fresh 22 August one,
    // both genuinely on/before this test's own 22 Aug evaluation date.
    expect(getPublishableObservationsByRoute('birmingham-delhi', BATCH_2_PLUS_LATER_REFRESHES_ISO)).toHaveLength(2);
    // Batch 2's own public/non-public boundary must remain true even as later
    // controlled observation batches legitimately expand total coverage.
  });

  it('keeps the archive duplicate-free and does not introduce a Standout Fare record', () => {
    const ids = fareObservations.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fareObservations.filter((entry) => Object.values(BATCH_2).some((expected) => expected.id === entry.id))).toHaveLength(14);
  });

  it('reruns Fare Watcher Phase 1 without qualifying a Standout Fare', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ routeSlug: 'manchester-lahore', currentFare: 574, qualification: 'new-recent-low', lifecycle: 'detected' });
    expect(candidates.every((candidate) => candidate.qualification !== 'standout-candidate')).toBe(true);
  });
});
