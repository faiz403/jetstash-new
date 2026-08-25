import { describe, it, expect } from 'vitest';
import { fareObservations, isIndependentComparisonObservation, type FareObservation } from '@/data/fare-observations';
import { deriveFareSignal, getFareSignalForRoute } from '@/lib/fare-signal';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';

/**
 * Same-day verification-recheck representative priority (25 Aug 2026,
 * founder-approved narrow rule). See lib/fare-signal.ts's
 * compareByRepresentativePriority() doc comment for the full rationale.
 *
 * Root cause this fixes: the deferred four-observation append (£480 MAN-ISB,
 * £547 MAN-LHE, £361 LHR-JED, £591 BHX-ATQ, all `observationReason:
 * 'emergency-recheck'`, all sharing their route's routine observation's
 * exact observedDate of 2026-08-25) would have left every one of those
 * routes still showing its cheaper, already-superseded routine fare as the
 * public representative Fare Signal -- the old tie-break
 * (observedDate desc, then price asc) always let the lower same-day price
 * win, with no way to express "this is a LATER check of the SAME day's
 * evidence" in a schema that only stores a calendar date, not a time.
 *
 * The rule is evidence-recency, not a price rule -- both directions are
 * tested below (a recheck that came back higher, and one that came back
 * lower, both still win on a same-day tie).
 */
const NOW_ISO = '2026-08-25';

function fixture(overrides: Partial<FareObservation> & { id: string; routeSlug: string; price: number; observedDate: string }): FareObservation {
  return {
    cabin: 'Economy',
    priceNote: 'return, per person, one adult; fixture',
    source: 'Fixture Air',
    observedVia: 'google-flights',
    currency: 'GBP',
    baggage: 'not stated',
    profileId: 'fixture-route-economy-1adult-v1',
    comparisonEligibility: 'current',
    departureDate: '2026-10-20',
    returnDate: '2026-11-03',
    ...overrides,
  };
}

describe('same-day recheck priority -- the core rule', () => {
  it('a same-day recheck that came back HIGHER than the routine fare still becomes representative', () => {
    const routine = fixture({ id: 'fx-routine-1', routeSlug: 'fixture-route', price: 460, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'fx-recheck-1', routeSlug: 'fixture-route', price: 480, observedDate: '2026-08-25', observationReason: 'emergency-recheck' });
    const signal = deriveFareSignal([routine, recheck], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-recheck-1');
    expect(signal.observation?.price).toBe(480);
  });

  it('"same-day recheck falls" -- a same-day recheck that came back LOWER also wins, proving this is evidence precedence, not a price rule', () => {
    const routine = fixture({ id: 'fx-routine-2', routeSlug: 'fixture-route', price: 500, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'fx-recheck-2', routeSlug: 'fixture-route', price: 470, observedDate: '2026-08-25', observationReason: 'emergency-recheck' });
    const signal = deriveFareSignal([routine, recheck], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-recheck-2');
    expect(signal.observation?.price).toBe(470);
  });

  it('a newer normal observation on a DIFFERENT date still beats an older emergency recheck -- date recency always wins before reason', () => {
    const olderRecheck = fixture({ id: 'fx-recheck-3', routeSlug: 'fixture-route', price: 300, observedDate: '2026-08-19', observationReason: 'emergency-recheck' });
    const newerRoutine = fixture({ id: 'fx-routine-3', routeSlug: 'fixture-route', price: 999, observedDate: '2026-08-20', observationReason: 'routine-weekly' });
    const signal = deriveFareSignal([olderRecheck, newerRoutine], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-routine-3');
    expect(signal.observation?.price).toBe(999);
  });

  it('two same-day observations that are BOTH routine (neither is a recheck) fall through to the pre-existing price tie-break, unchanged', () => {
    const a = fixture({ id: 'fx-routine-4a', routeSlug: 'fixture-route', price: 400, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const b = fixture({ id: 'fx-routine-4b', routeSlug: 'fixture-route', price: 350, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const signal = deriveFareSignal([a, b], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-routine-4b');
    expect(signal.observation?.price).toBe(350);
  });
});

describe('recheck priority cannot bypass existing eligibility rules -- it is a tie-break inside otherwise-valid candidates only', () => {
  it('a recheck in a DIFFERENT cabin does not win over an eligible Economy routine observation -- cabin filtering happens before this tie-break', () => {
    const economyRoutine = fixture({ id: 'fx-cabin-economy', routeSlug: 'fixture-route', cabin: 'Economy', price: 900, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const businessRecheck = fixture({ id: 'fx-cabin-business', routeSlug: 'fixture-route', cabin: 'Business', price: 100, observedDate: '2026-08-25', observationReason: 'emergency-recheck' });
    const signal = deriveFareSignal([economyRoutine, businessRecheck], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-cabin-economy');
  });

  it('a recheck marked comparisonEligibility "historical" does not win merely because it is a recheck -- historical exclusion happens before this tie-break', () => {
    const currentRoutine = fixture({ id: 'fx-hist-current', routeSlug: 'fixture-route', price: 900, observedDate: '2026-08-25', observationReason: 'routine-weekly', comparisonEligibility: 'current' });
    const historicalRecheck = fixture({ id: 'fx-hist-recheck', routeSlug: 'fixture-route', price: 50, observedDate: '2026-08-25', observationReason: 'emergency-recheck', comparisonEligibility: 'historical' });
    const signal = deriveFareSignal([currentRoutine, historicalRecheck], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-hist-current');
  });

  it('an incomplete recheck (missing return date, so not publicly publishable) does not win over a complete routine observation', () => {
    const completeRoutine = fixture({ id: 'fx-incomplete-routine', routeSlug: 'fixture-route', price: 900, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const incompleteRecheck = fixture({ id: 'fx-incomplete-recheck', routeSlug: 'fixture-route', price: 50, observedDate: '2026-08-25', observationReason: 'emergency-recheck', returnDate: undefined });
    const signal = deriveFareSignal([completeRoutine, incompleteRecheck], NOW_ISO);
    expect(signal.observation?.id).toBe('fx-incomplete-routine');
  });
});

describe('comparison-integrity protection unweakened by this change', () => {
  it('an emergency-recheck is still never an independent Smart Fare/Journey Choice comparison option', () => {
    const recheck = fixture({ id: 'fx-comparison-guard', routeSlug: 'fixture-route', price: 1, observedDate: '2026-08-25', observationReason: 'emergency-recheck' });
    expect(isIndependentComparisonObservation(recheck)).toBe(false);
  });

  it('manchester-islamabad Journey Choice is unaffected by this logic change -- still the real, frozen £601/£621/£626 comparison', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;
    expect(journeyChoice.lowerFare.price).toBe(601);
    expect(journeyChoice.fasterJourney.price).toBe(626);
    expect(journeyChoice.otherOptions[0].price).toBe(621);
    expect(journeyChoice.decision.sentence).toBe('£25 more saves 14h 15m of journey time.');
  });
});

describe('Fare Watcher baseline-depth protection unweakened by this change', () => {
  it('adding a same-day emergency-recheck of an existing candidate does not change its baseline sample size, median, or qualification', () => {
    const withoutRecheck = fareObservations;
    const recheckOfManIsb = fixture({
      id: 'fx-watcher-guard-recheck',
      routeSlug: 'manchester-islamabad',
      price: 480,
      observedDate: '2026-08-25',
      observationReason: 'emergency-recheck',
      profileId: 'manchester-islamabad-economy-1adult-23kg-v1',
    });
    const withRecheck = [...fareObservations, recheckOfManIsb];

    const before = generateFareWatcherCandidates(withoutRecheck, NOW_ISO).find((c) => c.routeSlug === 'manchester-islamabad')!;
    const after = generateFareWatcherCandidates(withRecheck, NOW_ISO).find((c) => c.routeSlug === 'manchester-islamabad')!;

    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after.baselineSampleSize).toBe(before.baselineSampleSize);
    expect(after.baselineMedian).toBe(before.baselineMedian);
    expect(after.qualification).toBe(before.qualification);
    // The recheck itself must never be selected as THE candidate merely by
    // being present -- the real, already-current £460 routine observation
    // remains the evaluated candidate (Fare Watcher's own candidate-
    // identity selection, fare-watcher.ts's isNewerCandidate(), is
    // deliberately untouched by this change).
    expect(after.id).toBe(before.id);
  });
});

describe('four-fare simulation -- proves the deferred append would now resolve correctly, without appending any real data', () => {
  // These four pairs mirror the real routine-vs-recheck evidence pending
  // founder re-approval (manchester-islamabad, manchester-lahore,
  // london-heathrow-jeddah, birmingham-amritsar, all 20 Oct-3 Nov 2026,
  // all observed 2026-08-25) but exist ONLY inside this test file --
  // nothing here is written to data/fare-observations.ts.
  const pairs: { routeSlug: string; routine: number; recheck: number }[] = [
    { routeSlug: 'manchester-islamabad', routine: 460, recheck: 480 },
    { routeSlug: 'manchester-lahore', routine: 538, recheck: 547 },
    { routeSlug: 'london-heathrow-jeddah', routine: 361, recheck: 361 },
    { routeSlug: 'birmingham-amritsar', routine: 589, recheck: 591 },
  ];

  it.each(pairs)('$routeSlug: the simulated recheck ($recheck) becomes the representative Fare Signal, not the routine fare ($routine)', ({ routeSlug, routine, recheck }) => {
    const routineObs = fixture({ id: `sim-${routeSlug}-routine`, routeSlug, price: routine, observedDate: '2026-08-25', observationReason: 'routine-weekly' });
    const recheckObs = fixture({ id: `sim-${routeSlug}-recheck`, routeSlug, price: recheck, observedDate: '2026-08-25', observationReason: 'emergency-recheck' });
    const signal = deriveFareSignal([routineObs, recheckObs], NOW_ISO);
    expect(signal.observation?.id).toBe(`sim-${routeSlug}-recheck`);
    expect(signal.observation?.price).toBe(recheck);
  });

  it('meanwhile, Journey Choice (real archive, real manchester-islamabad pilot) remains completely unaffected by the simulated data above', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;
    expect(journeyChoice.lowerFare.price).toBe(601);
    expect(journeyChoice.fasterJourney.price).toBe(626);
    expect(journeyChoice.otherOptions[0].price).toBe(621);
  });

  it('meanwhile, if all four simulated rechecks existed alongside the real archive, Fare Watcher baseline counts for all four routes would stay exactly as they are today', () => {
    const simulatedRechecks = pairs.map((p) =>
      fixture({ id: `sim-watcher-${p.routeSlug}`, routeSlug: p.routeSlug, price: p.recheck, observedDate: '2026-08-25', observationReason: 'emergency-recheck', profileId: `${p.routeSlug}-economy-1adult-23kg-v1` })
    );
    const before = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    const after = generateFareWatcherCandidates([...fareObservations, ...simulatedRechecks], NOW_ISO);
    for (const { routeSlug } of pairs) {
      const b = before.find((c) => c.routeSlug === routeSlug);
      const a = after.find((c) => c.routeSlug === routeSlug);
      expect(a, routeSlug).toBeDefined();
      expect(b, routeSlug).toBeDefined();
      expect(a!.baselineSampleSize, routeSlug).toBe(b!.baselineSampleSize);
      expect(a!.baselineMedian, routeSlug).toBe(b!.baselineMedian);
      expect(a!.qualification, routeSlug).toBe(b!.qualification);
      // No candidate is auto-approved/published by this change -- lifecycle
      // stays exactly what generateFareWatcherCandidates() always produces.
      expect(a!.lifecycle).toBe('detected');
      expect(a!.founderVerificationRequired).toBe(true);
    }
  });
});
