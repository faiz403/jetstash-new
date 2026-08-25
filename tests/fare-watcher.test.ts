import { describe, expect, it } from 'vitest';
import { fareObservations, type FareObservation } from '@/data/fare-observations';
import {
  advanceFareWatcherCandidate,
  FARE_WATCHER_MIN_BASELINE,
  generateFareWatcherCandidates,
  isFareWatcherCandidateExpired,
  qualifyFareWatcherObservation,
} from '@/lib/fare-watcher';

const currentIslamabad = fareObservations.filter((observation) => observation.routeSlug === 'manchester-islamabad' && observation.observedDate === '2026-08-10');

function fixture(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture', routeSlug: 'fixture-route', cabin: 'Economy', observedDate: '2026-08-10',
    price: 500, priceNote: 'return, one adult', source: 'Example', observedVia: 'google-flights',
    sourceUrl: 'https://example.test', currency: 'GBP', baggage: 'not stated', profileId: 'fixture-v1',
    observationReason: 'routine-weekly', comparisonEligibility: 'current', departureDate: '2026-10-05', returnDate: '2026-10-19', fareDirectness: 'connecting',
    ...overrides,
  };
}

function baselineFixture(id: string, observedDate: string, departureDate: string, price: number, routeSlug = 'fixture-route'): FareObservation {
  const returnDate = new Date(`${departureDate}T12:00:00Z`);
  returnDate.setUTCDate(returnDate.getUTCDate() + 14);
  return fixture({ id, routeSlug, observedDate, departureDate, returnDate: returnDate.toISOString().slice(0, 10), price });
}

describe('Fare Watcher / Standout Fares', () => {
  it('audits the real archive without fabricating a standout candidate', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, '2026-08-11');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ routeSlug: 'manchester-lahore', currentFare: 574, qualification: 'new-recent-low', founderVerificationRequired: true, lifecycle: 'detected' });
    expect(qualifyFareWatcherObservation(currentIslamabad[0], fareObservations, '2026-08-11')).toMatchObject({ qualification: 'ordinary-fare', baselineSampleSize: 3, baselineMedian: 562, previousLow: 524 });
  });

  it('reports the five 11 August observations without qualifying a Standout Fare', () => {
    const scheduled = ['manchester-lahore', 'manchester-islamabad', 'london-heathrow-delhi', 'birmingham-amritsar', 'london-heathrow-jeddah'];
    const results = scheduled.map((routeSlug) => {
      const candidate = fareObservations.find((observation) => observation.routeSlug === routeSlug && observation.observedDate === '2026-08-11');
      return qualifyFareWatcherObservation(candidate!, fareObservations, '2026-08-11');
    });

    expect(results.map((result) => result.candidate.price)).toEqual([574, 601, 454, 823, 495]);
    expect(results.map((result) => result.qualification)).toEqual(['new-recent-low', 'ordinary-fare', 'insufficient-baseline', 'ordinary-fare', 'insufficient-baseline']);
    expect(results.map((result) => result.baselineSampleSize)).toEqual([3, 5, 2, 3, 2]);
    expect(results[0]).toMatchObject({ baselineMedian: 620, previousLow: 578, differencePounds: 46 });
    expect(results[1]).toMatchObject({ baselineMedian: 621, previousLow: 524, differencePounds: 20 });
    expect(results[2]).toMatchObject({ baselineMedian: null, previousLow: 432 });
    expect(results[3]).toMatchObject({ baselineMedian: 733, previousLow: 714, differencePounds: -90 });
    expect(results[4]).toMatchObject({ baselineMedian: null, previousLow: 487 });
    expect(results.every((result) => result.qualification !== 'standout-candidate')).toBe(true);
  });

  it('requires three comparable prior observations and fails closed below that bar', () => {
    const candidate = fixture({ routeSlug: 'fixture-route', price: 400 });
    const result = qualifyFareWatcherObservation(candidate, [candidate, baselineFixture('one', '2026-08-03', '2026-09-28', 500)], '2026-08-11');
    expect(result.qualification).toBe('insufficient-baseline');
    expect(result.evidenceLimits[0]).toContain(`${FARE_WATCHER_MIN_BASELINE}`);
  });

  it('uses a median and qualifies a meaningful new low as a standout candidate', () => {
    const candidate = fixture({ price: 400 });
    const baseline = [
      baselineFixture('one', '2026-08-01', '2026-09-26', 500),
      baselineFixture('two', '2026-08-02', '2026-09-27', 510),
      baselineFixture('three', '2026-08-03', '2026-09-28', 520),
    ];
    const result = qualifyFareWatcherObservation(candidate, [candidate, ...baseline], '2026-08-11');
    expect(result).toMatchObject({ qualification: 'standout-candidate', baselineMedian: 510, previousLow: 500, differencePounds: 110, baselineSampleSize: 3 });
    expect(result.differencePercent).toBeCloseTo(21.568, 2);
  });

  it('distinguishes a meaningful drop that is not a new low, a new low that is trivial, and an ordinary fare', () => {
    const meaningfulNotLow = qualifyFareWatcherObservation(fixture({ price: 450 }), [fixture({ price: 450 }), baselineFixture('a', '2026-08-01', '2026-09-26', 400), baselineFixture('b', '2026-08-02', '2026-09-27', 520), baselineFixture('c', '2026-08-03', '2026-09-28', 530)], '2026-08-11');
    const trivialLow = qualifyFareWatcherObservation(fixture({ price: 498 }), [fixture({ price: 498 }), baselineFixture('a', '2026-08-01', '2026-09-26', 500), baselineFixture('b', '2026-08-02', '2026-09-27', 510), baselineFixture('c', '2026-08-03', '2026-09-28', 520)], '2026-08-11');
    const ordinary = qualifyFareWatcherObservation(fixture({ price: 505 }), [fixture({ price: 505 }), baselineFixture('a', '2026-08-01', '2026-09-26', 500), baselineFixture('b', '2026-08-02', '2026-09-27', 510), baselineFixture('c', '2026-08-03', '2026-09-28', 520)], '2026-08-11');
    expect(meaningfulNotLow.qualification).toBe('notable-drop');
    expect(trivialLow.qualification).toBe('new-recent-low');
    expect(ordinary.qualification).toBe('ordinary-fare');
  });

  it('excludes historical, same-snapshot, mismatched profile, cabin, currency and horizon records', () => {
    const candidate = fixture({ price: 400 });
    const result = qualifyFareWatcherObservation(candidate, [candidate,
      fixture({ id: 'historical', observedDate: '2026-08-01', comparisonEligibility: 'historical' }),
      fixture({ id: 'same-snapshot', observedDate: '2026-08-10' }),
      fixture({ id: 'profile', observedDate: '2026-08-02', profileId: 'other-v1' }),
      fixture({ id: 'cabin', observedDate: '2026-08-03', cabin: 'Business' }),
      fixture({ id: 'horizon', observedDate: '2026-08-04', departureDate: '2026-11-01' }),
    ], '2026-08-11');
    expect(result.baselineSampleSize).toBe(0);
    expect(result.exclusions.map((item) => item.reason)).toEqual(expect.arrayContaining(['historical', 'same-snapshot', 'different-profile', 'different-booking-horizon']));
  });

  it('allows an emergency-recheck to be verified as a candidate but never counts it as an independent baseline point', () => {
    const candidate = fixture({ id: 'recheck-candidate', price: 400, observationReason: 'emergency-recheck' });
    const recheckBaseline = baselineFixture('recheck-baseline', '2026-08-09', '2026-10-05', 450);
    recheckBaseline.observationReason = 'emergency-recheck';
    const ordinaryBaseline = [
      baselineFixture('ordinary-a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('ordinary-b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('ordinary-c', '2026-08-03', '2026-09-28', 520),
    ];

    const result = qualifyFareWatcherObservation(candidate, [candidate, recheckBaseline, ...ordinaryBaseline], '2026-08-11');
    expect(result.qualification).toBe('standout-candidate');
    expect(result.baselineSampleSize).toBe(3);
    expect(result.comparableBaseline.map((observation) => observation.id)).not.toContain('recheck-baseline');
    expect(result.exclusions).toContainEqual({ observationId: 'recheck-baseline', reason: 'verification-recheck' });
  });

  it('requires an explicitly current candidate and excludes stale baselines', () => {
    const candidate = fixture({ comparisonEligibility: undefined });
    expect(qualifyFareWatcherObservation(candidate, [candidate], '2026-08-11').qualification).toBe('insufficient-baseline');
    const staleCandidate = fixture({ observedDate: '2026-05-01', comparisonEligibility: 'current' });
    expect(qualifyFareWatcherObservation(staleCandidate, [staleCandidate], '2026-08-11').evidenceLimits[0]).toContain('fresh-candidate');
    const freshCandidate = fixture({ price: 400 });
    const stale = [freshCandidate, fixture({ id: 'old', observedDate: '2025-12-01', price: 500 })];
    expect(qualifyFareWatcherObservation(freshCandidate, stale, '2026-08-11').baselineSampleSize).toBe(0);
  });

  it('rejects a currency mismatch rather than comparing unlike amounts', () => {
    const candidate = fixture({ price: 400 });
    const currencyMismatch = fixture({ id: 'usd', observedDate: '2026-08-01', departureDate: '2026-09-26', returnDate: '2026-10-10', currency: 'USD' as FareObservation['currency'] });
    const result = qualifyFareWatcherObservation(candidate, [candidate, currencyMismatch], '2026-08-11');
    expect(result.baselineSampleSize).toBe(0);
    expect(result.exclusions).toContainEqual({ observationId: 'usd', reason: 'currency-mismatch' });
  });

  it('requires founder verification and supports approval, eligibility, rejection and expiry transitions', () => {
    const candidate = generateFareWatcherCandidates([
      fixture({ id: 'candidate', routeSlug: 'manchester-lahore', price: 400 }),
      baselineFixture('a', '2026-08-01', '2026-09-26', 500, 'manchester-lahore'),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510, 'manchester-lahore'),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520, 'manchester-lahore'),
    ], '2026-08-11')[0];
    expect(candidate.founderVerificationRequired).toBe(true);
    const pending = advanceFareWatcherCandidate(candidate, 'request-verification', '2026-08-11');
    const approved = advanceFareWatcherCandidate(pending, 'approve', '2026-08-11');
    expect(advanceFareWatcherCandidate(approved, 'make-eligible', '2026-08-11').lifecycle).toBe('eligible-for-publication');
    expect(advanceFareWatcherCandidate(pending, 'reject', '2026-08-11').lifecycle).toBe('rejected');
    expect(isFareWatcherCandidateExpired(candidate, '2027-01-01')).toBe(true);
    expect(advanceFareWatcherCandidate(candidate, 'request-verification', '2027-01-01').lifecycle).toBe('expired');
  });

  it('excludes a methodology-excluded observation from the baseline even when every other field is otherwise valid and comparable (22 August 2026, Fare Watcher Methodology-Exclusion audit)', () => {
    const candidate = fixture({ price: 400 });
    // obs-bhx-del-economy-20260818-8w-v1 is a real id in
    // data/fare-observations.ts's methodologyExcludedObservationIds --
    // reused here as a fixture id specifically to prove the gate fires
    // purely from id membership, independent of every other field being
    // otherwise fully valid and comparable.
    const excludedButOtherwiseValid = fixture({
      id: 'obs-bhx-del-economy-20260818-8w-v1',
      observedDate: '2026-08-01',
      departureDate: '2026-09-26',
      returnDate: '2026-10-10',
      price: 300,
    });
    const result = qualifyFareWatcherObservation(candidate, [candidate, excludedButOtherwiseValid], '2026-08-11');
    expect(result.baselineSampleSize).toBe(0);
    expect(result.exclusions).toContainEqual({ observationId: 'obs-bhx-del-economy-20260818-8w-v1', reason: 'methodology-excluded' });
  });

  it('a methodology-excluded observation can never itself become a candidate either, even if every other field would otherwise qualify it', () => {
    const excludedCandidate = fixture({ id: 'obs-bhx-del-economy-20260818-8w-v1', price: 400 });
    const result = qualifyFareWatcherObservation(excludedCandidate, [excludedCandidate], '2026-08-11');
    expect(result.qualification).toBe('insufficient-baseline');
    expect(result.evidenceLimits[0]).toContain('methodology-excluded');
  });

  it('real archive: birmingham-delhi\'s excluded 18 August observation no longer counts toward the 22 August observation\'s baseline', () => {
    const obs22 = fareObservations.find((observation) => observation.id === 'obs-bhx-del-economy-20260822-8w-v1')!;
    const result = qualifyFareWatcherObservation(obs22, fareObservations, '2026-08-22');
    expect(result.comparableBaseline.map((observation) => observation.id)).toEqual(['obs-bhx-del-economy-20260813-8w-v1']);
    expect(result.exclusions).toContainEqual({ observationId: 'obs-bhx-del-economy-20260818-8w-v1', reason: 'methodology-excluded' });
  });

  it('real archive: birmingham-lahore\'s excluded 18 August observation (a PR #163 route) no longer counts toward the 22 August observation\'s baseline either', () => {
    const obs22 = fareObservations.find((observation) => observation.id === 'obs-bhx-lhe-economy-20260822-8w-v1')!;
    const result = qualifyFareWatcherObservation(obs22, fareObservations, '2026-08-22');
    expect(result.comparableBaseline).toEqual([]);
    expect(result.baselineSampleSize).toBe(0);
    expect(result.exclusions).toContainEqual({ observationId: 'obs-bhx-lhe-economy-20260818-8w-v1', reason: 'methodology-excluded' });
  });

  it('real archive: emergency rechecks do not deepen the later 25 August baselines', () => {
    const bhx = fareObservations.find((observation) => observation.id === 'obs-bhx-atq-economy-20260825-8w-v1')!;
    const jed = fareObservations.find((observation) => observation.id === 'obs-lhr-jed-economy-20260825-8w-v1')!;
    const bhxResult = qualifyFareWatcherObservation(bhx, fareObservations, '2026-08-25');
    const jedResult = qualifyFareWatcherObservation(jed, fareObservations, '2026-08-25');

    expect(bhxResult.baselineSampleSize).toBe(5);
    expect(jedResult.baselineSampleSize).toBe(4);
    expect(bhxResult.exclusions).toContainEqual({ observationId: 'obs-bhx-atq-economy-20260819-8w-v1', reason: 'verification-recheck' });
    expect(jedResult.exclusions).toContainEqual({ observationId: 'obs-lhr-jed-economy-20260819-8w-v1', reason: 'verification-recheck' });
  });

  it('real archive: a matching emergency-recheck becomes the evaluated evidence while candidate identity stays anchored to the original detection (Verified-Candidate Price Integrity, 25 August 2026)', () => {
    // Step 6 required real-data results, verified against the actual engine
    // (not hardcoded into production logic): MAN-ISB detection £460,
    // verified £480, median £621, ~£141/22.7% below median, still
    // qualifies; MAN-LHE detection £538, verified £547, median £620,
    // ~£73/11.8% below median, still qualifies; LHR-JED and BHX-ATQ use the
    // engine's own current median rather than a stale expectation.
    const candidates = generateFareWatcherCandidates(fareObservations, '2026-08-25');
    const bySlug = Object.fromEntries(candidates.map((candidate) => [candidate.routeSlug, candidate]));

    expect(bySlug['manchester-islamabad']).toMatchObject({
      id: 'fare-watcher-obs-man-isb-economy-20260825-8w-v1',
      currentFare: 480,
      baselineMedian: 621,
      differencePounds: 141,
      qualification: 'standout-candidate',
      checkedDate: '2026-08-25',
    });
    expect(bySlug['manchester-islamabad'].differencePercent).toBeCloseTo(22.7, 1);
    expect(bySlug['manchester-islamabad'].verifiedObservation).toMatchObject({ observationReason: 'emergency-recheck', price: 480 });

    expect(bySlug['manchester-lahore']).toMatchObject({
      id: 'fare-watcher-obs-man-lhe-economy-20260825-8w-v1',
      currentFare: 547,
      baselineMedian: 620,
      differencePounds: 73,
      qualification: 'standout-candidate',
    });
    expect(bySlug['manchester-lahore'].differencePercent).toBeCloseTo(11.8, 1);
    expect(bySlug['manchester-lahore'].verifiedObservation).toMatchObject({ observationReason: 'emergency-recheck', price: 547 });

    // LHR-JED and BHX-ATQ: verified price stayed the same or moved only
    // slightly, evaluated against the engine's own current median -- both
    // still qualify (their exact tier is not asserted here, since it is a
    // function of the live archive rather than this fix).
    expect(bySlug['london-heathrow-jeddah']).toBeDefined();
    expect(bySlug['london-heathrow-jeddah'].currentFare).toBe(361);
    expect(bySlug['london-heathrow-jeddah'].verifiedObservation).toMatchObject({ observationReason: 'emergency-recheck', price: 361 });
    expect(bySlug['birmingham-amritsar']).toBeDefined();
    expect(bySlug['birmingham-amritsar'].currentFare).toBe(591);
    expect(bySlug['birmingham-amritsar'].verifiedObservation).toMatchObject({ observationReason: 'emergency-recheck', price: 591 });

    // None of the four routes' emergency-recheck observations became a
    // second, independent candidate in their own right.
    const rechecks = ['obs-man-isb-economy-20260825-recheck-v1', 'obs-man-lhe-economy-20260825-recheck-v1', 'obs-lhr-jed-economy-20260825-recheck-v1', 'obs-bhx-atq-economy-20260825-recheck-v1'];
    expect(candidates.map((candidate) => candidate.id)).not.toEqual(expect.arrayContaining(rechecks.map((id) => `fare-watcher-${id}`)));
  });

  it('a matching verification recheck that raises the price can still qualify when it remains a meaningful drop', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'recheck', price: 430, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    const candidates = generateFareWatcherCandidates([detection, recheck, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: 'fare-watcher-detection', currentFare: 430, checkedDate: '2026-08-10', qualification: 'standout-candidate' });
    expect(candidates[0].verifiedObservation).toMatchObject({ id: 'recheck', price: 430 });
  });

  it('a matching verification recheck that raises the price enough to stop qualifying is no longer publication-eligible, even though the stale detection price would have qualified', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'recheck', price: 505, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    // Sanity check: the stale £400 detection price alone would have qualified.
    expect(qualifyFareWatcherObservation(detection, [detection, ...baseline], '2026-08-11').qualification).toBe('standout-candidate');
    const candidates = generateFareWatcherCandidates([detection, recheck, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(0);
  });

  it('a matching verification recheck that falls even further is used as the evaluated evidence', () => {
    const detection = fixture({ id: 'detection', price: 500, observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'recheck', price: 450, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 560),
      baselineFixture('b', '2026-08-02', '2026-09-27', 570),
      baselineFixture('c', '2026-08-03', '2026-09-28', 580),
    ];
    const candidates = generateFareWatcherCandidates([detection, recheck, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: 'fare-watcher-detection', currentFare: 450 });
    expect(candidates[0].verifiedObservation.price).toBe(450);
  });

  it('a matching verification recheck at the same price is still recognized as current evidence without creating a second candidate or baseline sample', () => {
    const detection = fixture({ id: 'detection', price: 361, observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'recheck', price: 361, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 480),
      baselineFixture('b', '2026-08-02', '2026-09-27', 490),
      baselineFixture('c', '2026-08-03', '2026-09-28', 500),
    ];
    const candidates = generateFareWatcherCandidates([detection, recheck, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].currentFare).toBe(361);
    expect(candidates[0].baselineSampleSize).toBe(3);
    expect(candidates[0].verifiedObservation.id).toBe('recheck');
  });

  it('an unrelated emergency-recheck (different travel dates) does not affect the candidate and is not itself promoted', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const unrelatedRecheck = fixture({ id: 'unrelated-recheck', price: 999, observationReason: 'emergency-recheck', observedDate: '2026-08-10', departureDate: '2026-11-20', returnDate: '2026-12-04' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    const candidates = generateFareWatcherCandidates([detection, unrelatedRecheck, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: 'fare-watcher-detection', currentFare: 400 });
    expect(candidates[0].verifiedObservation.id).toBe('detection');
  });

  it('an unrelated emergency-recheck (different profile) does not affect the candidate either', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const unrelatedRecheck = fixture({ id: 'unrelated-recheck', price: 999, observationReason: 'emergency-recheck', observedDate: '2026-08-10', profileId: 'different-profile-v1' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    const candidates = generateFareWatcherCandidates([detection, unrelatedRecheck, ...baseline], '2026-08-11');
    expect(candidates[0]).toMatchObject({ currentFare: 400 });
    expect(candidates[0].verifiedObservation.id).toBe('detection');
  });

  it('when multiple matching rechecks exist, the latest one (by the shared observation-ordering rule) wins', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const earlierRecheck = fixture({ id: 'earlier-recheck', price: 420, observationReason: 'emergency-recheck', observedDate: '2026-08-09' });
    const laterRecheck = fixture({ id: 'later-recheck', price: 440, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    const candidates = generateFareWatcherCandidates([detection, earlierRecheck, laterRecheck, ...baseline], '2026-08-11');
    expect(candidates[0].currentFare).toBe(440);
    expect(candidates[0].verifiedObservation.id).toBe('later-recheck');
  });

  it('an ordinary candidate with no matching recheck at all behaves exactly as before this fix', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    const candidates = generateFareWatcherCandidates([detection, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: 'fare-watcher-detection', currentFare: 400, checkedDate: '2026-08-10', qualification: 'standout-candidate' });
    expect(candidates[0].verifiedObservation.id).toBe('detection');
  });

  it('an emergency-recheck with no matching detection observation never becomes a candidate on its own', () => {
    const orphanRecheck = fixture({ id: 'orphan-recheck', price: 400, observationReason: 'emergency-recheck' });
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 500),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520),
    ];
    const candidates = generateFareWatcherCandidates([orphanRecheck, ...baseline], '2026-08-11');
    expect(candidates).toHaveLength(0);
  });

  it('never emits public market-wide language or an automatic approval', () => {
    const candidate = generateFareWatcherCandidates([
      fixture({ id: 'candidate', routeSlug: 'manchester-lahore', price: 400 }),
      baselineFixture('a', '2026-08-01', '2026-09-26', 500, 'manchester-lahore'),
      baselineFixture('b', '2026-08-02', '2026-09-27', 510, 'manchester-lahore'),
      baselineFixture('c', '2026-08-03', '2026-09-28', 520, 'manchester-lahore'),
    ], '2026-08-11')[0];
    expect(candidate.lifecycle).toBe('detected');
    expect(JSON.stringify(candidate)).not.toMatch(/cheapest|guaranteed|bargain|book now|prices will rise|limited time/i);
  });
});
