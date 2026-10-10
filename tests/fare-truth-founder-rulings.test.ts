import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fareObservations, type FareObservation } from '@/data/fare-observations';
import { fareReverifications, type FareReverification } from '@/data/fare-reverifications';
import { routes } from '@/data/routes';
import { FareSignal } from '@/components/route/fare-signal';
import { formatChecked } from '@/data/deals';
import { generateFareWatcherCandidates, qualifyFareWatcherObservation } from '@/lib/fare-watcher';
import { prepareFareWatcherOperatorReport } from '@/lib/fare-watcher-operator';
import { deriveFareSignal, getFareSignalForRoute } from '@/lib/fare-signal';
import { getReverifiedObservationIds, withoutReverifiedObservations } from '@/lib/fare-reverification';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';

const NOW = '2026-10-09';
function obs(id: string, overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id, routeSlug: 'fixture-route', cabin: 'Economy', observedDate: '2026-10-01', price: 100,
    priceNote: 'return, one adult; no self-transfer notice', source: 'Example Airline', currency: 'GBP',
    profileId: 'fixture-v1', comparisonEligibility: 'current', observationReason: 'routine-weekly',
    departureDate: '2026-11-17', returnDate: '2026-12-01', fareDirectness: 'direct', ...overrides,
  };
}
const baseline = () => ['2026-09-25', '2026-09-26', '2026-09-27'].map((observedDate, i) => obs(`b${i}`, { observedDate, price: 200 + i * 10 }));
const retirement: FareReverification = { id: 'retirement', targetObservationId: 'old', reverifyingObservationId: 'recheck', action: 'retire', recordedDate: NOW, note: 'Explicit non-reproduction fixture' };

describe('founder fare truth rulings', () => {
  it('excludes self-transfer and missing or unknown directness baseline points without changing the archive', () => {
    const candidate = obs('candidate');
    const dirty = [
      obs('flagged', { observedDate: '2026-09-28', priceNote: 'self-transfer', price: 20 }),
      obs('unknown', { observedDate: '2026-09-29', fareDirectness: 'unknown', price: 30 }),
      obs('missing', { observedDate: '2026-09-30', fareDirectness: undefined, price: 40 }),
    ];
    const archive = [...baseline(), ...dirty, candidate];
    const frozen = JSON.stringify(archive);
    const result = qualifyFareWatcherObservation(candidate, archive, NOW);
    expect(result).toMatchObject({ baselineSampleSize: 3, baselineMedian: 210, previousLow: 200, qualification: 'standout-candidate' });
    expect(result.exclusions).toEqual(expect.arrayContaining([
      { observationId: 'flagged', reason: 'self-transfer' },
      { observationId: 'unknown', reason: 'unknown-directness' },
      { observationId: 'missing', reason: 'unknown-directness' },
    ]));
    expect(JSON.stringify(archive)).toBe(frozen);
    expect(qualifyFareWatcherObservation(candidate, [candidate, ...dirty, ...baseline().slice(0, 2)], NOW).qualification).toBe('insufficient-baseline');
  });

  it('newer unknown routine evidence suppresses the identity rather than reviving its older clean lead', () => {
    const older = obs('older');
    expect(generateFareWatcherCandidates([older, ...baseline()], NOW)).toHaveLength(1);
    expect(generateFareWatcherCandidates([older, obs('newer', { observedDate: '2026-10-02', fareDirectness: 'unknown' }), ...baseline()], NOW)).toEqual([]);
  });

  it('future matching rechecks do not suppress today; unknown rechecks do suppress once observed', () => {
    const lead = obs('lead');
    const recheck = obs('recheck', { observedDate: '2026-10-10', observationReason: 'emergency-recheck', fareDirectness: 'unknown' });
    const archive = [...baseline(), lead, recheck];
    expect(generateFareWatcherCandidates(archive, NOW)[0]?.verifiedObservation.id).toBe('lead');
    expect(generateFareWatcherCandidates(archive, '2026-10-10')).toEqual([]);
  });

  it('durable retirement survives filtering its supporting recheck, with clean fallback or fail closed', () => {
    const old = obs('old');
    const recheck = obs('recheck', { observedDate: '2026-10-07', observationReason: 'emergency-recheck', fareDirectness: 'unknown', price: 180 });
    const clean = obs('clean', { observedDate: '2026-10-08', price: 200 });
    const evidence = [old, recheck, clean];
    const live = withoutReverifiedObservations([old, clean], NOW, [retirement], evidence);
    expect(live.map((o) => o.id)).toEqual(['clean']);
    expect(deriveFareSignal(live, NOW, []).observation?.id).toBe('clean');
    expect(withoutReverifiedObservations([old], NOW, [retirement], evidence)).toEqual([]);
    expect(getReverifiedObservationIds([old], '2026-10-06', [retirement], evidence).size).toBe(0);
    const real = fareReverifications[0];
    const realTarget = fareObservations.find((o) => o.id === real.targetObservationId)!;
    expect(getReverifiedObservationIds([realTarget], NOW).has(realTarget.id)).toBe(true);
    expect(deriveFareSignal([realTarget], NOW).state).toBe('none');
  });

  it('unknown directness cannot bypass any-cabin fallback or clean two-signal substitution', () => {
    const unknown = obs('unknown', { fareDirectness: 'unknown', price: 110 });
    expect(deriveFareSignal([unknown], NOW, []).state).toBe('none');
    expect(deriveFareSignal([{ ...unknown, cabin: 'Business' }], NOW, []).state).toBe('none');
    const flagged = obs('flagged', { price: 90, priceNote: 'self-transfer', fareDirectness: 'connecting' });
    const signal = deriveFareSignal([flagged, unknown], NOW, []);
    expect(signal.observation?.id).toBe('flagged');
    expect(signal.observation?.isSelfTransfer).toBe(true);
    const old = obs('old');
    const recheck = { ...unknown, id: 'recheck', observationReason: 'emergency-recheck' as const };
    expect(deriveFareSignal([old, recheck], NOW, [retirement]).state).toBe('none');
  });

  it('one-stop self-transfer operator evidence cannot be recommended for founder review', () => {
    const report = prepareFareWatcherOperatorReport([{
      routeSlug: 'manchester-dubai', usable: true, fare: 100, airline: 'Example Airline', source: 'google-flights', baggage: 'not stated',
      outboundDirectness: 'connecting', outboundStops: 1, returnDirectness: 'connecting', returnStops: 1, evidenceNote: 'self-transfer on both legs',
    }], { observedDate: '2026-10-01', departureDate: '2026-11-17', returnDate: '2026-12-01', observationReason: 'routine-weekly' },
    baseline().map((o) => ({ ...o, routeSlug: 'manchester-dubai', profileId: 'manchester-dubai-economy-operator-v1' })));
    expect(report.entries[0]).toMatchObject({ disposition: 'suppressed-self-transfer', selfTransfer: true, poorItinerary: false });
    const prepared = report.entries[0].validation.preparedObservation!;
    expect(generateFareWatcherCandidates([prepared, ...baseline()], '2026-10-01')).toEqual([]);
  });

  it('all 35 different-date public secondaries disclose their own dates beside their price', () => {
    const signals = routes.map((route) => ({ route, signal: getFareSignalForRoute(route.slug, NOW) }));
    expect(signals.filter(({ signal }) => signal.observation)).toHaveLength(70);
    const mismatches = signals.filter(({ signal: { observation: p, lowerSelfTransfer: s } }) => p && s && (p.departureDate !== s.departureDate || p.returnDate !== s.returnDate));
    expect(mismatches).toHaveLength(35);
    for (const { route, signal } of mismatches) {
      const secondary = signal.lowerSelfTransfer!;
      const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: route.slug, nowIso: NOW }));
      const block = html.slice(html.indexOf('Lower fare also seen:'));
      expect(block).toContain(`Travel dates: ${formatChecked(secondary.departureDate)} – ${formatChecked(secondary.returnDate)}`);
      expect(block).toContain(`£${secondary.price.toLocaleString('en-GB')}`);
      expect(secondary.isSelfTransfer).toBe(true);
    }
    expect(fareObservations.filter((o) => isSelfTransferItinerary(o.priceNote))).toHaveLength(306);
  });
});
