import { describe, expect, it } from 'vitest';
import { fareObservations, isPubliclyPublishable } from '@/data/fare-observations';
import { generateFareWatcherCandidates, qualifyFareWatcherObservation } from '@/lib/fare-watcher';

const BATCH_IDS = [
  'obs-man-isb-economy-20260825-8w-v1',
  'obs-man-lhe-economy-20260825-8w-v1',
  'obs-man-dxb-economy-20260825-8w-v1',
  'obs-lhr-jed-economy-20260825-8w-v1',
  'obs-lhr-doh-economy-20260825-8w-v1',
  'obs-bhx-atq-economy-20260825-8w-v1',
  'obs-lgw-atq-economy-20260825-8w-v1',
] as const;

describe('controlled weekly fare observation batch — 25 August 2026', () => {
  it('contains exactly seven complete, current, Economy observations on the locked profile', () => {
    const batch = BATCH_IDS.map((id) => fareObservations.find((observation) => observation.id === id));
    expect(batch.every(Boolean)).toBe(true);
    expect(batch).toHaveLength(7);
    for (const observation of batch) {
      expect(observation).toMatchObject({
        cabin: 'Economy',
        observedDate: '2026-08-25',
        departureDate: '2026-10-20',
        returnDate: '2026-11-03',
        currency: 'GBP',
        observationReason: 'routine-weekly',
        comparisonEligibility: 'current',
        fareDirectness: 'connecting',
      });
      // 22 September 2026: obs-man-dxb-economy-20260825-8w-v1 is the one
      // member of this batch that is now methodology-excluded — its
      // itinerary lands at Sharjah, not Dubai. It remains a complete,
      // correctly-structured record (everything asserted above still holds);
      // it simply may no longer reach a public surface.
      const expectPublishable = observation!.id !== 'obs-man-dxb-economy-20260825-8w-v1';
      expect(isPubliclyPublishable(observation!), observation!.id).toBe(expectPublishable);
      expect(observation?.baggage).toMatch(/not stated/i);
      expect(observation?.sourceUrl).toContain('curr=GBP');
    }
  });

  it('keeps Journey Choice frozen and keeps the generic representative surface in Economy', () => {
    const newIslamabad = fareObservations.find((observation) => observation.id === BATCH_IDS[0]);
    expect(newIslamabad?.departureDate).not.toBe('2026-10-06');
    expect(fareObservations.filter((observation) => observation.routeSlug === 'manchester-islamabad' && observation.price === 601).length).toBeGreaterThan(0);
    expect(fareObservations.find((observation) => observation.id === 'obs-man-lhe-business-20260822-8w-v1')?.cabin).toBe('Business');
  });

  it('runs Fare Watcher after append without auto-publishing a candidate', () => {
    const results = BATCH_IDS.map((id) => {
      const candidate = fareObservations.find((observation) => observation.id === id)!;
      return qualifyFareWatcherObservation(candidate, fareObservations, '2026-08-25');
    });
    expect(results.map((result) => result.qualification)).toEqual([
      'standout-candidate', 'insufficient-baseline', 'insufficient-baseline',
      'insufficient-baseline', 'insufficient-baseline', 'insufficient-baseline', 'insufficient-baseline',
    ]);
    expect(results.every((result) => result.evidenceLimits.length > 0)).toBe(true);
    // Verified-Candidate Price Integrity (25 August 2026): each of these
    // four routes has a same-day `emergency-recheck` that verifies this
    // exact routine detection (same route/cabin/profile/travel-dates/
    // currency) -- generateFareWatcherCandidates() now evaluates the
    // candidate's currentFare/qualification from that verified evidence
    // rather than the stale routine price, while checkedDate/id stay
    // anchored to the routine detection observed here (see
    // lib/fare-watcher.ts's findLatestVerificationRecheck()).
    const candidates = generateFareWatcherCandidates(fareObservations, '2026-08-25');
    expect(candidates.filter((candidate) => BATCH_IDS.includes(candidate.id.replace('fare-watcher-', '') as typeof BATCH_IDS[number]))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ routeSlug: 'manchester-islamabad', currentFare: 480, qualification: 'standout-candidate', lifecycle: 'detected', founderVerificationRequired: true, checkedDate: '2026-08-25' }),
      ])
    );
    // FWATCH-ST-001 (7 October 2026): manchester-lahore, london-heathrow-jeddah and birmingham-amritsar
    // detections and rechecks are explicit self-transfer fares, so they are no longer Fare Watcher candidates;
    // only manchester-islamabad (clean evidence) is. The clean-only baseline
    // below preserves diagnostics but cannot qualify the self-transfer fare.
    for (const slug of ['manchester-lahore', 'london-heathrow-jeddah', 'birmingham-amritsar']) {
      expect(candidates.some((candidate) => candidate.routeSlug === slug), slug).toBe(false);
    }
    expect(results.find((result) => result.candidate.id === BATCH_IDS[1])).toMatchObject({
      qualification: 'insufficient-baseline',
      baselineMedian: 628,
      previousLow: 574,
      baselineSampleSize: 3,
    });
  });
});
