import { describe, expect, it } from 'vitest';
import { fareObservations, type FareObservation } from '@/data/fare-observations';
import { fareReverifications, type FareReverification } from '@/data/fare-reverifications';
import { generateFareWatcherCandidates, qualifyFareWatcherObservation } from '@/lib/fare-watcher';
import { prepareFareWatcherOperatorReport } from '@/lib/fare-watcher-operator';
import { deriveFareSignal, selectRepresentativeObservation } from '@/lib/fare-signal';
import { generateRouteWatchFareCandidates } from '@/lib/route-watch-fare-trigger';
import { deriveApprovedStandoutFare } from '@/lib/standout-fare';

const NOW = '2026-10-09';
function obs(id: string, overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id, routeSlug: 'manchester-dubai', cabin: 'Economy', observedDate: '2026-10-01', price: 100,
    priceNote: 'return; no self-transfer notice', source: 'Example Airline', observedVia: 'google-flights',
    currency: 'GBP', baggage: 'not stated', profileId: 'manchester-dubai-economy-operator-v1',
    comparisonEligibility: 'current', observationReason: 'routine-weekly', departureDate: '2026-11-17',
    returnDate: '2026-12-01', fareDirectness: 'direct', outboundDirectness: 'direct', outboundStops: 0,
    returnDirectness: 'direct', returnStops: 0, ...overrides,
  };
}

describe('operator shares the production evaluation, including actual recheck price', () => {
  const baseline = ['2026-09-25', '2026-09-26', '2026-09-27'].map((observedDate, i) => obs(`baseline-${i}`, { observedDate, price: 600 + i * 10 }));
  const profile = { observedDate: '2026-10-01', departureDate: '2026-11-17', returnDate: '2026-12-01', observationReason: 'routine-weekly' as const };
  const entry = { routeSlug: 'manchester-dubai', usable: true, fare: 100, airline: 'Example Airline', source: 'google-flights' as const, baggage: 'not stated', outboundDirectness: 'direct' as const, outboundStops: 0, returnDirectness: 'direct' as const, returnStops: 0 };
  it.each([
    ['clean qualifying recheck', { price: 150 }, true],
    ['clean non-qualifying recheck', { price: 620 }, false],
    ['unknown recheck', { price: 150, fareDirectness: 'unknown' }, false],
    ['self-transfer recheck', { price: 150, fareDirectness: 'connecting', priceNote: 'self-transfer on both legs' }, false],
  ] as const)('%s agrees on both paths', (_label, overrides, accepted) => {
    const recheck = obs('matching-recheck', { observationReason: 'emergency-recheck', ...overrides });
    const existing = [...baseline, recheck];
    const report = prepareFareWatcherOperatorReport([entry], profile, existing).entries[0];
    expect(report.validation.status).toBe('VALID');
    const prepared = report.validation.preparedObservation!;
    const candidates = generateFareWatcherCandidates([...existing, prepared], profile.observedDate);
    expect(candidates.length > 0).toBe(accepted);
    expect(report.disposition === 'founder-review-required').toBe(accepted);
    expect(report.qualification?.candidate.id).toBe(recheck.id);
    expect(report.qualification?.candidate.price).toBe(recheck.price);
    if (accepted) expect(candidates[0]).toMatchObject({ id: `fare-watcher-${prepared.id}`, verifiedObservation: recheck });
  });
});

describe('retirement-specific fallback preserves ordinary route behaviour', () => {
  const target = obs('retired-target');
  const recheck = obs('retirement-recheck', { observedDate: '2026-10-07', observationReason: 'emergency-recheck', fareDirectness: 'unknown', price: 180 });
  const ledger: FareReverification[] = [{ id: 'explicit-retirement', targetObservationId: target.id, reverifyingObservationId: recheck.id, action: 'retire', recordedDate: '2026-10-07', note: 'Explicit non-reproduction, not price inference' }];
  const clean = obs('later-clean', { observedDate: '2026-10-08', price: 200 });
  const flagged = obs('later-self-transfer', { observedDate: '2026-10-08', price: 90, fareDirectness: 'connecting', priceNote: 'self-transfer' });
  const unknown = obs('later-unknown', { observedDate: '2026-10-08', price: 90, fareDirectness: 'unknown' });
  it.each([
    ['A no fallback', [], null], ['B clean fallback', [clean], clean.id],
    ['C self-transfer only', [flagged], null], ['D unknown only', [unknown], null],
  ])('%s follows the clean-only invariant with and without supporting evidence in the pool', (_label, fallbacks, expected) => {
    const evidence = [target, recheck, ...(fallbacks as FareObservation[])];
    for (const input of [evidence, evidence.filter((o) => o.id !== recheck.id)]) {
      const signal = deriveFareSignal(input, NOW, ledger, evidence);
      expect(signal.observation?.id ?? null).toBe(expected);
      expect(selectRepresentativeObservation(input, NOW, ledger, evidence).observation?.id ?? null).toBe(expected);
      expect(signal.state).toBe(expected ? 'current' : 'none');
    }
  });
  it('an ordinary non-retirement route retains its labelled self-transfer fallback', () => {
    expect(deriveFareSignal([flagged], NOW, []).observation?.id).toBe(flagged.id);
  });
  it('a retirement in another route or cabin does not suppress ordinary fallback', () => {
    for (const ordinary of [{ ...flagged, id: 'other-route', routeSlug: 'bristol-marrakech' }, { ...flagged, id: 'other-cabin', cabin: 'Business' as const }]) {
      expect(deriveFareSignal([target, recheck, ordinary], NOW, ledger).observation?.id).toBe(ordinary.id);
    }
  });
  it('an out-of-window or no-longer-current retired target does not suppress a future search', () => {
    const later = { ...flagged, observedDate: '2026-12-02', departureDate: '2027-01-15', returnDate: '2027-01-29' };
    expect(deriveFareSignal([target, recheck, later], '2026-12-02', ledger).observation?.id).toBe(later.id);
    const agedTarget = { ...target, observedDate: '2026-08-01' };
    expect(deriveFareSignal([agedTarget, recheck, flagged], NOW, ledger).observation?.id).toBe(flagged.id);
  });
});

describe('actual MAN–ISB supersession stays durable across deal surfaces', () => {
  const entry = fareReverifications[0];
  const target = fareObservations.find((o) => o.id === entry.targetObservationId)!;
  const recheck = fareObservations.find((o) => o.id === entry.reverifyingObservationId)!;
  const prefix = fareObservations.filter((o) => o.routeSlug === target.routeSlug && o.cabin === target.cabin && o.observedDate <= target.observedDate);
  it('retains original detection identity with the surviving clean £480 recheck', () => {
    for (const candidates of [generateFareWatcherCandidates(prefix, NOW), generateRouteWatchFareCandidates(prefix, NOW)]) {
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({ id: `fare-watcher-${target.id}`, checkedDate: target.observedDate, currentFare: 480, verifiedObservation: recheck });
    }
  });
  it('filtering supporting evidence never restores the superseded £460 as evaluated fare', () => {
    const filtered = prefix.filter((o) => o.id !== recheck.id);
    expect(generateFareWatcherCandidates(filtered, NOW)).toEqual([]);
    expect(generateRouteWatchFareCandidates(filtered, NOW)).toEqual([]);
    expect(qualifyFareWatcherObservation(target, filtered, NOW).qualification).toBe('insufficient-baseline');
    const approval = [{ id: 'fixture-approval', routeSlug: target.routeSlug, cabin: target.cabin, detectionObservationId: target.id, approvedVerifiedObservationId: target.id, approvedDate: NOW, approvedBy: 'founder' as const, note: 'Never publish retired evidence' }];
    expect(deriveApprovedStandoutFare(approval, target.routeSlug, target.cabin, filtered, NOW)).toBeNull();
    expect(deriveFareSignal(filtered, NOW).observation?.id).not.toBe(target.id);
  });
  it('excludes an explicitly superseded target from a later clean baseline', () => {
    const later = { ...target, id: 'later-lead', observedDate: '2026-08-26', price: 400 };
    const result = qualifyFareWatcherObservation(later, [...prefix.filter((o) => o.id !== recheck.id), later], NOW);
    expect(result.comparableBaseline.some((o) => o.id === target.id)).toBe(false);
    expect(result.exclusions).toContainEqual({ observationId: target.id, reason: 'retired' });
  });
  it.each([
    ['clean', { fareDirectness: 'direct', priceNote: 'return; no self-transfer notice' }, true],
    ['self-transfer', { fareDirectness: 'connecting', priceNote: 'self-transfer' }, false],
    ['unknown', { fareDirectness: 'unknown', priceNote: 'return; itinerary not confirmed' }, false],
  ] as const)('a later %s detection does not restore the retired target', (_label, overrides, accepted) => {
    const bases = ['2026-10-01', '2026-10-02', '2026-10-03'].map((observedDate, i) => obs(`new-baseline-${i}`, { routeSlug: target.routeSlug, profileId: target.profileId, observedDate, price: 600 + i * 10 }));
    const later = obs('later-detection', { routeSlug: target.routeSlug, profileId: target.profileId, observedDate: '2026-10-08', ...overrides });
    const input = [...prefix.filter((o) => o.id !== recheck.id), ...bases, later];
    for (const candidates of [generateFareWatcherCandidates(input, NOW), generateRouteWatchFareCandidates(input, NOW)]) {
      expect(candidates.length > 0).toBe(accepted);
      expect(candidates.some((c) => c.verifiedObservation.id === target.id)).toBe(false);
      if (accepted) expect(candidates[0].verifiedObservation.id).toBe(later.id);
    }
  });
});
