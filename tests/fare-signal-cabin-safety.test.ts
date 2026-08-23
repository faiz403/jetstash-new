import { describe, it, expect } from 'vitest';
import type { FareObservation } from '@/data/fare-observations';
import { deriveFareSignal, getFareSignalForRoute, hasCurrentFareSignalForCabinAmongRoutes } from '@/lib/fare-signal';

/**
 * Generic Fare Signal cabin safety (23 August 2026) — a narrow, evidence-only
 * fix for a defect Business Fare Evidence Batch 1 (PR #166, held pending this
 * fix) exposed: deriveFareSignal()'s plain "latest observation wins" sort has
 * no cabin awareness, so a newer Business check could silently replace a
 * perfectly valid current Economy Fare Signal on a generic route page. See
 * lib/fare-signal.ts's own "Generic Fare Signal cabin safety" doc comment for
 * the full root-cause trace (no commit, test, or doc ever exercised a
 * mixed-cabin race before this batch — it was an unexamined default, not a
 * deliberate design choice).
 *
 * Fix: deriveFareSignal() now prefers a current (fresh, non-historical,
 * publicly publishable) Economy observation outright whenever one exists,
 * regardless of what any other cabin's latest check date is. A stale or
 * missing Economy observation still correctly falls through to the
 * pre-existing cabin-blind latest-wins behaviour — this must never let a
 * genuinely fresh Business fare go unshown just because a route has some
 * long-dead Economy record on file.
 *
 * NOW_ISO chosen so a "fresh" observation (within OBSERVATION_FRESH_DAYS =
 * 60 days) and a "stale" one (beyond OBSERVATION_STALE_DAYS = 180 days) are
 * both cleanly reachable from the same reference date.
 */

const NOW_ISO = '2026-08-23';

function economy(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture-economy',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    observedDate: '2026-08-20',
    price: 500,
    priceNote: 'return, per person',
    source: 'Example Airline',
    currency: 'GBP',
    departureDate: '2026-10-01',
    returnDate: '2026-10-15',
    fareDirectness: 'connecting',
    comparisonEligibility: 'current',
    ...overrides,
  };
}

function business(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture-business',
    routeSlug: 'fixture-route',
    cabin: 'Business',
    observedDate: '2026-08-22',
    price: 3000,
    priceNote: 'return, per person',
    source: 'Example Airline',
    currency: 'GBP',
    departureDate: '2026-10-01',
    returnDate: '2026-10-15',
    fareDirectness: 'connecting',
    comparisonEligibility: 'current',
    ...overrides,
  };
}

describe('deriveFareSignal — Economy-preference fallback cases', () => {
  it('current Economy + newer current Business → Economy wins', () => {
    const eco = economy({ observedDate: '2026-08-10', price: 500 });
    const biz = business({ observedDate: '2026-08-22', price: 3000 }); // strictly newer than eco
    const signal = deriveFareSignal([eco, biz], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Economy');
    expect(signal.observation?.price).toBe(500);
  });

  it('current Economy + same-date Business → Economy wins (not merely a tiebreak coincidence)', () => {
    const eco = economy({ observedDate: '2026-08-22', price: 5000 }); // deliberately the MORE EXPENSIVE one
    const biz = business({ observedDate: '2026-08-22', price: 500 }); // cheaper, same date — old price-tiebreak would have picked this
    const signal = deriveFareSignal([eco, biz], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Economy');
    expect(signal.observation?.price).toBe(5000);
  });

  it('stale Economy + current Business → Business wins', () => {
    const eco = economy({ observedDate: '2026-01-01' }); // 234 days before NOW_ISO — well past OBSERVATION_STALE_DAYS
    const biz = business({ observedDate: '2026-08-20' });
    const signal = deriveFareSignal([eco, biz], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Business');
  });

  it('no Economy + current Business → Business wins', () => {
    const biz = business({ observedDate: '2026-08-20' });
    const signal = deriveFareSignal([biz], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Business');
  });

  it('only current Economy → Economy wins', () => {
    const eco = economy({ observedDate: '2026-08-20' });
    const signal = deriveFareSignal([eco], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Economy');
  });

  it('no current observations at all → existing no-fare behaviour, unchanged', () => {
    const signal = deriveFareSignal([], NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
  });

  it('a methodology-excluded Economy observation does not block a valid Business fallback', () => {
    // A real, currently-excluded archive id (data/fare-observations.ts's
    // methodologyExcludedObservationIds) — isPubliclyPublishable() checks
    // the id against that list before anything else, so this Economy
    // fixture is correctly treated as non-publishable despite otherwise
    // looking complete and fresh. Dated earlier than the Business fixture
    // so the pre-existing (unrelated, unchanged by this fix)
    // selectLatestObservation() fallback picks the Business observation as
    // the array's own latest, rather than tripping over the separate,
    // pre-existing "the single latest pick isn't itself skip-ahead-aware"
    // behaviour this test isn't about.
    const excludedEco = economy({ id: 'obs-lgw-ist-economy-20260814-8w-v1', observedDate: '2026-08-18' });
    const biz = business({ observedDate: '2026-08-20' });
    const signal = deriveFareSignal([excludedEco, biz], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Business');
  });

  it('a structurally incomplete (non-publishable) Economy observation does not block a valid Business fallback', () => {
    const incompleteEco = economy({ observedDate: '2026-08-18', departureDate: undefined, returnDate: undefined });
    const biz = business({ observedDate: '2026-08-20' });
    const signal = deriveFareSignal([incompleteEco, biz], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.cabin).toBe('Business');
  });

  it('a historical-only current-dated Economy observation does not count as the preferred current Economy', () => {
    const historicalEco = economy({ observedDate: '2026-08-22', comparisonEligibility: 'historical' });
    const biz = business({ observedDate: '2026-08-20' });
    const signal = deriveFareSignal([historicalEco, biz], NOW_ISO);
    expect(signal.observation?.cabin).toBe('Business');
  });

  it('a lone historical-only Economy observation (no other candidate at all) still falls through to the pre-existing historical-fallback behaviour, unchanged and never marked "current"', () => {
    const historicalEco = economy({ observedDate: '2026-08-22', comparisonEligibility: 'historical' });
    const signal = deriveFareSignal([historicalEco], NOW_ISO);
    expect(signal.state).toBe('recent');
    expect(signal.observation?.cabin).toBe('Economy');
  });
});

describe('Business-specific surfaces are unaffected by construction', () => {
  it('hasCurrentFareSignalForCabinAmongRoutes still correctly reports Business evidence — its input is always pre-filtered to one cabin, so the new Economy preference never applies', () => {
    // These are the four real routes Business Fare Evidence Batch 1 (PR
    // #166) evidenced. PR #166 is not merged into this branch, so these
    // routes carry no Business observation here yet — this proves the
    // helper still resolves false honestly today, and (per the manual
    // cross-branch check run alongside this fix) resolves true again once
    // PR #166's data lands, unaffected by this change either way.
    expect(hasCurrentFareSignalForCabinAmongRoutes(['manchester-lahore'], 'Business', NOW_ISO)).toBe(false);
  });

  it('a single-cabin Business-only input is completely untouched by the Economy-preference branch', () => {
    const biz = business({ observedDate: '2026-08-01' }); // even a much older Business-only observation must still win when it's the only candidate
    const signal = deriveFareSignal([biz], NOW_ISO);
    expect(signal.observation?.cabin).toBe('Business');
  });
});

describe('real-network sanity: today\'s actual data has zero routes where this fix changes anything (no route currently has both a current Economy and a current non-Economy observation)', () => {
  it('every route\'s Fare Signal on main today is identical to what it was before this fix — this branch is fare-evidence-neutral', () => {
    // A pure logic fix landing on clean main (before PR #166's Business
    // observations exist) must not move a single pixel today — the whole
    // point is it only ever fires once a genuine cross-cabin race exists,
    // which today's real archive does not yet contain. manchester-lahore
    // is checked explicitly since it is the flagship case this fix exists
    // for once PR #166 lands.
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.observation?.cabin).toBe('Economy');
    expect(signal.observation?.price).toBe(628);
  });
});
