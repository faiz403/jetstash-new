import { describe, expect, it } from 'vitest';
import type { FareObservation } from '@/data/fare-observations';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { generateRouteWatchFareCandidates } from '@/lib/route-watch-fare-trigger';

/**
 * Fare Watcher current-candidate supersession (19 August 2026).
 *
 * Root cause: `generateFareWatcherCandidates()` evaluated every
 * `comparisonEligibility: 'current'` observation as its own independent
 * candidate, with no concept of "this route/profile has a newer
 * observation now." A live-verified real case exposed it: an 18 August
 * observation qualified `standout-candidate`; a 19 August recheck of the
 * exact same route/profile found the fare no longer reproducible and
 * logged a fresh, lower-tier observation — but the stale 18 August
 * candidate kept appearing everywhere downstream (Route Watch, the
 * founder Command Centre UI) as if it were still live.
 *
 * FARE_WATCHER_DESIGN.md's candidate-flow section already documented that
 * candidates should "expire automatically when their checked date, travel
 * dates OR SOURCE AVAILABILITY no longer support the claim" — this fixes
 * the undelivered third clause. It does not touch qualification
 * thresholds, baseline computation, Route Watch's tier filter, or route
 * verification — only which single observation, per (routeSlug, cabin,
 * profileId) identity, is ever promoted to a candidate.
 */

/** Adds N days to an ISO date string. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * departureDate/returnDate are always derived from observedDate at a fixed
 * 8-week horizon / 14-night stay — matching the real methodology's fixed
 * booking-horizon rule (FARE_OBSERVATION_ARCHIVE.md) and required so every
 * fixture in a scenario stays within Fare Watcher's own
 * FARE_WATCHER_MAX_HORIZON_DRIFT_DAYS (7 days) comparability gate,
 * regardless of which observedDate it uses.
 */
function fixture(overrides: Partial<FareObservation> = {}): FareObservation {
  const observedDate = overrides.observedDate ?? '2026-08-10';
  const departureDate = overrides.departureDate ?? addDays(observedDate, 56);
  const returnDate = overrides.returnDate ?? addDays(departureDate, 14);
  return {
    id: 'fixture',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    price: 500,
    priceNote: 'return, one adult',
    source: 'Example',
    observedVia: 'google-flights',
    sourceUrl: 'https://example.test',
    currency: 'GBP',
    baggage: 'not stated',
    profileId: 'fixture-route-economy-1adult-fixture-v1',
    observationReason: 'routine-weekly',
    comparisonEligibility: 'current',
    fareDirectness: 'connecting',
    ...overrides,
    observedDate,
    departureDate,
    returnDate,
  };
}

/** Three older, genuinely comparable baseline points every scenario below shares, all clearly historical relative to the candidates under test. */
function baseline(routeSlug: string, profileId: string): FareObservation[] {
  return [
    fixture({ id: `${routeSlug}-base-1`, routeSlug, profileId, observedDate: '2026-07-21', price: 700, comparisonEligibility: 'current' }),
    fixture({ id: `${routeSlug}-base-2`, routeSlug, profileId, observedDate: '2026-07-28', price: 780, comparisonEligibility: 'current' }),
    fixture({ id: `${routeSlug}-base-3`, routeSlug, profileId, observedDate: '2026-08-04', price: 820, comparisonEligibility: 'current' }),
  ];
}

describe('Fare Watcher candidate supersession — 19 August 2026 fix', () => {
  it('1. older standout + newer notable-drop: actionable output contains only the newer notable-drop', () => {
    const routeSlug = 'scenario-one';
    const profileId = 'scenario-one-economy-1adult-v1';
    const older = fixture({ id: 'scenario-one-older', routeSlug, profileId, observedDate: '2026-08-11', price: 400 }); // deep drop vs baseline -> standout on its own
    const newer = fixture({ id: 'scenario-one-newer', routeSlug, profileId, observedDate: '2026-08-12', price: 650 }); // modest drop vs an updated baseline that now includes `older`
    const observations = [...baseline(routeSlug, profileId), older, newer];

    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forRoute = candidates.filter((c) => c.routeSlug === routeSlug);
    expect(forRoute).toHaveLength(1);
    expect(forRoute[0].id).toBe(`fare-watcher-${newer.id}`);
    expect(forRoute[0].currentFare).toBe(650);
  });

  it('2. older standout + newer ordinary: the old standout no longer appears as actionable, and nothing does for that route', () => {
    const routeSlug = 'scenario-two';
    const profileId = 'scenario-two-economy-1adult-v1';
    const older = fixture({ id: 'scenario-two-older', routeSlug, profileId, observedDate: '2026-08-11', price: 400 });
    const newer = fixture({ id: 'scenario-two-newer', routeSlug, profileId, observedDate: '2026-08-12', price: 790 }); // barely moves vs an updated median -> ordinary-fare
    const observations = [...baseline(routeSlug, profileId), older, newer];

    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forRoute = candidates.filter((c) => c.routeSlug === routeSlug);
    expect(forRoute).toHaveLength(0); // ordinary-fare never becomes a candidate at all, and the stale standout must not fill the gap
  });

  it('3. the superseded older observation still participates in baseline calculations for the observation that IS selected as the candidate', () => {
    const routeSlug = 'scenario-three';
    const profileId = 'scenario-three-economy-1adult-v1';
    const older = fixture({ id: 'scenario-three-older', routeSlug, profileId, observedDate: '2026-08-11', price: 400 });
    const newer = fixture({ id: 'scenario-three-newer', routeSlug, profileId, observedDate: '2026-08-12', price: 650 });
    const observations = [...baseline(routeSlug, profileId), older, newer];

    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forRoute = candidates.find((c) => c.routeSlug === routeSlug)!;
    // baseline = the 3 shared points + the superseded `older` (400) = 4
    expect(forRoute.baselineSampleSize).toBe(4);
    expect(forRoute.previousLow).toBe(400); // the superseded observation's own low price is still visible as evidence
  });

  it('4. unrelated routes are unaffected by another route\'s supersession', () => {
    const routeSlugA = 'scenario-four-a';
    const profileIdA = 'scenario-four-a-economy-1adult-v1';
    const olderA = fixture({ id: 'scenario-four-a-older', routeSlug: routeSlugA, profileId: profileIdA, observedDate: '2026-08-11', price: 400 });
    const newerA = fixture({ id: 'scenario-four-a-newer', routeSlug: routeSlugA, profileId: profileIdA, observedDate: '2026-08-12', price: 650 });

    const routeSlugB = 'scenario-four-b';
    const profileIdB = 'scenario-four-b-economy-1adult-v1';
    const onlyB = fixture({ id: 'scenario-four-b-only', routeSlug: routeSlugB, profileId: profileIdB, observedDate: '2026-08-11', price: 400 });

    const observations = [...baseline(routeSlugA, profileIdA), olderA, newerA, ...baseline(routeSlugB, profileIdB), onlyB];

    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forB = candidates.filter((c) => c.routeSlug === routeSlugB);
    expect(forB).toHaveLength(1);
    expect(forB[0].id).toBe(`fare-watcher-${onlyB.id}`);
    expect(forB[0].currentFare).toBe(400);
  });

  it('5. same-route competing profileIds are never collapsed together — each keeps its own latest independently', () => {
    const routeSlug = 'scenario-five';
    const profileIdX = 'scenario-five-economy-1adult-x-v1';
    const profileIdY = 'scenario-five-economy-1adult-y-v1'; // a genuinely different search methodology for the same route
    const olderX = fixture({ id: 'scenario-five-x-older', routeSlug, profileId: profileIdX, observedDate: '2026-08-11', price: 400 });
    const newerX = fixture({ id: 'scenario-five-x-newer', routeSlug, profileId: profileIdX, observedDate: '2026-08-12', price: 650 });
    const onlyY = fixture({ id: 'scenario-five-y-only', routeSlug, profileId: profileIdY, observedDate: '2026-08-11', price: 300 });

    const observations = [...baseline(routeSlug, profileIdX), olderX, newerX, ...baseline(routeSlug, profileIdY), onlyY];

    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forRoute = candidates.filter((c) => c.routeSlug === routeSlug);
    const ids = forRoute.map((c) => c.id).sort();
    // Profile X: only the newer £650 candidate (olderX superseded within X).
    // Profile Y: its own single £300 candidate, entirely untouched by X's supersession.
    expect(ids).toEqual([`fare-watcher-${newerX.id}`, `fare-watcher-${onlyY.id}`].sort());
  });

  it('6. deterministic tie-break when two observations share the same observedDate: lower price wins, then id', () => {
    const routeSlug = 'scenario-six';
    const profileId = 'scenario-six-economy-1adult-v1';
    // Same date, different price — the cheaper one is treated as "latest".
    const tieHigher = fixture({ id: 'scenario-six-b-higher', routeSlug, profileId, observedDate: '2026-08-12', price: 700 });
    const tieLower = fixture({ id: 'scenario-six-a-lower', routeSlug, profileId, observedDate: '2026-08-12', price: 400 });
    const observations = [...baseline(routeSlug, profileId), tieHigher, tieLower];

    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forRoute = candidates.filter((c) => c.routeSlug === routeSlug);
    expect(forRoute).toHaveLength(1);
    expect(forRoute[0].id).toBe(`fare-watcher-${tieLower.id}`);
    expect(forRoute[0].currentFare).toBe(400);
  });

  it('6b. deterministic tie-break when date AND price are identical: lexically smaller id wins, and the result is stable across input order', () => {
    const routeSlug = 'scenario-six-b';
    const profileId = 'scenario-six-b-economy-1adult-v1';
    const obsA = fixture({ id: 'aaa-tie', routeSlug, profileId, observedDate: '2026-08-12', price: 500 });
    const obsB = fixture({ id: 'zzz-tie', routeSlug, profileId, observedDate: '2026-08-12', price: 500 });

    const forward = generateFareWatcherCandidates([...baseline(routeSlug, profileId), obsA, obsB], '2026-08-12');
    const reversed = generateFareWatcherCandidates([...baseline(routeSlug, profileId), obsB, obsA], '2026-08-12');

    const forwardIds = forward.filter((c) => c.routeSlug === routeSlug).map((c) => c.id);
    const reversedIds = reversed.filter((c) => c.routeSlug === routeSlug).map((c) => c.id);
    expect(forwardIds).toEqual([`fare-watcher-${obsA.id}`]); // 'aaa-tie' < 'zzz-tie'
    expect(reversedIds).toEqual(forwardIds); // order-independent
  });

  it('a future-dated observation (relative to nowIso) never supersedes a candidate valid as of an earlier evaluation date — historical evaluations stay historically accurate', () => {
    const routeSlug = 'scenario-seven';
    const profileId = 'scenario-seven-economy-1adult-v1';
    const past = fixture({ id: 'scenario-seven-past', routeSlug, profileId, observedDate: '2026-08-11', price: 650 });
    const future = fixture({ id: 'scenario-seven-future', routeSlug, profileId, observedDate: '2026-08-18', price: 400 }); // exists in the archive but is AFTER the evaluation date below
    const observations = [...baseline(routeSlug, profileId), past, future];

    // Evaluated "as of" 12 August — before `future` was ever observed.
    const candidates = generateFareWatcherCandidates(observations, '2026-08-12');
    const forRoute = candidates.filter((c) => c.routeSlug === routeSlug);
    expect(forRoute).toHaveLength(1);
    expect(forRoute[0].id).toBe(`fare-watcher-${past.id}`); // NOT the future one
  });

  it('Route Watch inherits the supersession automatically (no second implementation) — a superseded standout never reaches the review-trigger queue', () => {
    const routeSlug = 'scenario-eight';
    const profileId = 'scenario-eight-economy-1adult-v1';
    const olderStandout = fixture({ id: 'scenario-eight-older', routeSlug, profileId, observedDate: '2026-08-11', price: 400 });
    const newerOrdinary = fixture({ id: 'scenario-eight-newer', routeSlug, profileId, observedDate: '2026-08-12', price: 790 });
    const observations = [...baseline(routeSlug, profileId), olderStandout, newerOrdinary];

    const triggers = generateRouteWatchFareCandidates(observations, '2026-08-12').filter((c) => c.routeSlug === routeSlug);
    expect(triggers).toHaveLength(0);
  });

  it('real-archive regression: the live-verified birmingham-amritsar / london-heathrow-jeddah case resolves exactly as founder-approved', async () => {
    const { fareObservations } = await import('@/data/fare-observations');
    const nowIso = '2026-08-19';
    const candidates = generateFareWatcherCandidates(fareObservations, nowIso);

    const amritsar = candidates.filter((c) => c.routeSlug === 'birmingham-amritsar');
    expect(amritsar).toHaveLength(1);
    expect(amritsar[0]).toMatchObject({ currentFare: 603, qualification: 'notable-drop', checkedDate: '2026-08-19' });

    const jeddah = candidates.filter((c) => c.routeSlug === 'london-heathrow-jeddah');
    expect(jeddah).toHaveLength(0);

    const routeWatch = generateRouteWatchFareCandidates(fareObservations, nowIso);
    expect(routeWatch.filter((c) => c.routeSlug === 'birmingham-amritsar')).toHaveLength(1);
    expect(routeWatch.filter((c) => c.routeSlug === 'london-heathrow-jeddah')).toHaveLength(0);
  });
});
