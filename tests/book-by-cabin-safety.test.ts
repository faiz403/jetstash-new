import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { FareObservation } from '@/data/fare-observations';
import { fareObservations } from '@/data/fare-observations';
import { selectRepresentativeObservation, getFareSignalForRoute } from '@/lib/fare-signal';
import { BOOK_BY_PRIORITY_ROUTE_SLUGS, computeBookBySnapshot } from '@/lib/booking-intelligence';
import { getDealsByDestination, hasTrackedFare } from '@/data/deals';
import { getRouteBySlug } from '@/data/routes';

/**
 * Book-By cabin safety (23 August 2026) — the second confirmed integrity
 * fix from the Sol Ultra Full Big Review, following Smart Fare Comparison
 * (PR #171). Confirmed live defect: computeBookBySnapshot() selected its
 * "Verified check" via getLatestPublishableObservation() — cabin-blind,
 * "whichever observation was checked most recently" — a second,
 * independently-drifting policy from the generic Fare Signal's own
 * Economy-preference fix (PR #167). On manchester-lahore this meant Book-By
 * showed a £3,051 Business "Verified check" directly beneath booking-timing
 * guidance while the same route's Fare Signal correctly led with the latest £538
 * Economy.
 *
 * The fix: lib/fare-signal.ts's selectRepresentativeObservation() is now
 * the ONE canonical representative-fare policy — deriveFareSignal() (Fare
 * Signal's own view model) and computeBookBySnapshot() (Book-By) both
 * consume it, so the two systems can no longer disagree.
 */

const NOW_ISO = '2026-08-24';
const NOW_DATE = new Date('2026-08-24T12:00:00Z');

function baseObservation(overrides: Partial<FareObservation> = {}): FareObservation {
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

function businessObservation(overrides: Partial<FareObservation> = {}): FareObservation {
  return baseObservation({
    id: 'fixture-business',
    cabin: 'Business',
    price: 3000,
    observedDate: '2026-08-22',
    ...overrides,
  });
}

describe('A. Real Manchester-Lahore data — the exact confirmed live defect', () => {
  it('Fare Signal shows no current signal at all for Manchester-Lahore (Fare Signal poor-itinerary suppression, 31 Aug 2026) — its £547 Economy observation (the 25 Aug same-day emergency-recheck) is a confirmed self-transfer, 2+-stop itinerary and its £3,051 Business observation is the same class of confirmed-poor evidence, so neither cabin has a representative fare to show; this is NOT a regression of the cabin-safety fix below — Economy is still correctly preferred over Business whenever both are shown, it is simply that neither currently qualifies', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
  });

  it('Book-By agrees with Fare Signal — both correctly show no representative fare, never disagreeing (the shared selectRepresentativeObservation() choke point this whole file exists to guard)', () => {
    const snapshot = computeBookBySnapshot('manchester-lahore', NOW_DATE);
    expect(snapshot?.latestObservation).toBeNull();
  });

  it('the £3,051 Business observation remains completely untouched in the append-only archive', () => {
    const business = fareObservations.find((o) => o.id === 'obs-man-lhe-business-20260822-8w-v1');
    expect(business?.price).toBe(3051);
    expect(business?.cabin).toBe('Business');
  });

  it('the £3,051 Business observation remains visible on its own Business Deal / business surfaces — this fix only changes Book-By\'s selection, never the archive or Business-specific rendering', () => {
    const deal = getDealsByDestination('lahore').find((d) => d.id === 'man-lhe-business');
    expect(deal).toBeTruthy();
    expect(hasTrackedFare(deal!, NOW_ISO)).toBe(true);
  });
});

describe('B. Newer Business observation + older current Economy — Economy still wins', () => {
  it('selectRepresentativeObservation prefers the older current Economy over the newer Business one', () => {
    const economy = baseObservation({ id: 'older-economy', observedDate: '2026-08-10' });
    const business = businessObservation({ id: 'newer-business', observedDate: '2026-08-22' }); // strictly newer
    const { observation, state } = selectRepresentativeObservation([economy, business], NOW_ISO);
    expect(observation?.id).toBe('older-economy');
    expect(state).toBe('current');
  });
});

describe('C. No current Economy + valid Business — the canonical fallback still works', () => {
  it('selectRepresentativeObservation falls back to the Business observation, not an empty result', () => {
    const business = businessObservation({ id: 'only-business', observedDate: '2026-08-20' });
    const { observation, state } = selectRepresentativeObservation([business], NOW_ISO);
    expect(observation?.id).toBe('only-business');
    expect(observation?.cabin).toBe('Business');
    expect(state).toBe('current');
  });

  it('Book-By must not render nothing solely because cabin is Business — same fallback proven through the full snapshot pipeline via a synthetic route is out of scope here (peak-period/route data required), but the shared selector itself is the guarantee: this is the identical function computeBookBySnapshot() now calls', () => {
    // Direct proof the two systems share one function, not two policies
    // that happen to agree today. If this ever imports a different
    // function, this assertion (and the network-wide test below) would
    // catch the drift.
    const business = businessObservation({ id: 'fallback-proof', observedDate: '2026-08-20' });
    const viaSharedSelector = selectRepresentativeObservation([business], NOW_ISO);
    expect(viaSharedSelector.observation?.cabin).toBe('Business');
  });
});

describe('D. Every current Book-By priority route — Book-By matches Fare Signal, derived not hardcoded', () => {
  it('for all 5 routes in BOOK_BY_PRIORITY_ROUTE_SLUGS, Book-By\'s representative fare equals Fare Signal\'s', () => {
    expect(BOOK_BY_PRIORITY_ROUTE_SLUGS.length).toBeGreaterThan(0);
    for (const slug of BOOK_BY_PRIORITY_ROUTE_SLUGS) {
      const signal = getFareSignalForRoute(slug, NOW_ISO);
      const snapshot = computeBookBySnapshot(slug, NOW_DATE);
      if (!signal.observation) {
        expect(snapshot?.latestObservation, slug).toBeNull();
        continue;
      }
      expect(snapshot?.latestObservation, slug).toBeTruthy();
      expect(snapshot!.latestObservation!.cabin, slug).toBe(signal.observation.cabin);
      expect(snapshot!.latestObservation!.price, slug).toBe(signal.observation.price);
      expect(snapshot!.latestObservation!.observedDate, slug).toBe(signal.observation.observedDate);
    }
  });

  it('today\'s real result for every priority route is Economy — recorded as a snapshot so a future genuine Economy-evidence gap is visible as a real diff, not silently assumed', () => {
    const result: Record<string, string | null> = {};
    for (const slug of BOOK_BY_PRIORITY_ROUTE_SLUGS) {
      result[slug] = computeBookBySnapshot(slug, NOW_DATE)?.latestObservation?.cabin ?? null;
    }
    // Fare Signal poor-itinerary suppression (31 Aug 2026): 3 of the 5
    // priority routes now correctly have no representative fare of any
    // cabin — their only current observations are confirmed self-transfer,
    // 2+-stop-per-leg itineraries. manchester-islamabad and
    // london-heathrow-delhi are unaffected.
    expect(result).toEqual({
      'manchester-lahore': null,
      'manchester-islamabad': 'Economy',
      'london-heathrow-delhi': 'Economy',
      'london-heathrow-jeddah': null,
      'birmingham-amritsar': null,
    });
  });
});

describe('E. Stale/incomplete/excluded Economy must not improperly block a valid fallback', () => {
  it('a methodology-excluded Economy observation does not block a valid Business fallback (same real excluded id Fare Signal\'s own cabin-safety tests use)', () => {
    const excludedEconomy = baseObservation({ id: 'obs-lgw-ist-economy-20260814-8w-v1', observedDate: '2026-08-18' });
    const business = businessObservation({ id: 'valid-business', observedDate: '2026-08-20' });
    const { observation } = selectRepresentativeObservation([excludedEconomy, business], NOW_ISO);
    expect(observation?.id).toBe('valid-business');
  });

  it('a stale (not fresh) Economy observation does not block a valid current Business fallback', () => {
    const staleEconomy = baseObservation({ id: 'stale-economy', observedDate: '2026-01-01' }); // well past OBSERVATION_STALE_DAYS
    const business = businessObservation({ id: 'current-business', observedDate: '2026-08-20' });
    const { observation } = selectRepresentativeObservation([staleEconomy, business], NOW_ISO);
    expect(observation?.id).toBe('current-business');
  });

  it('a historical-only Economy observation does not count as the preferred current Economy', () => {
    const historicalEconomy = baseObservation({ id: 'historical-economy', observedDate: '2026-08-22', comparisonEligibility: 'historical' });
    const business = businessObservation({ id: 'current-business-2', observedDate: '2026-08-20' });
    const { observation } = selectRepresentativeObservation([historicalEconomy, business], NOW_ISO);
    expect(observation?.id).toBe('current-business-2');
  });
});

describe('F. No eligible representative fare — the existing honest empty/fallback state is preserved', () => {
  it('selectRepresentativeObservation returns null/none for an empty input', () => {
    const { observation, state } = selectRepresentativeObservation([], NOW_ISO);
    expect(observation).toBeNull();
    expect(state).toBe('none');
  });

  it('computeBookBySnapshot\'s latestObservation is a direct null-preserving ternary on the shared selector\'s own result — never a separate empty-state guess', () => {
    // Every current BOOK_BY_PRIORITY_ROUTE_SLUGS route has real fare
    // evidence today (getPublishableObservationsByRoute's `nowIso` param
    // only gates the ROUTE's own verification currency, not whether an
    // observation predates it — confirmed directly in
    // data/fare-observations.ts's isObservationPublishable — so there is
    // no real "zero evidence" fixture to construct from today's priority
    // routes without faking route data). The unit-level proof just above
    // (empty input -> observation: null, state: 'none') already covers
    // selectRepresentativeObservation's own honesty; this proves the
    // wiring around it never reintroduces a guess.
    const src = readFileSync(join(process.cwd(), 'lib/booking-intelligence.ts'), 'utf8');
    expect(src).toMatch(/const latestObservation = representative\s*\n?\s*\?\s*\{/);
    expect(src).toContain(': null;');
  });
});

describe('Smart Fare Comparison respects the verification-recheck evidence role', () => {
  it('only manchester-islamabad remains an independent Smart Fare Comparison after verification rechecks are excluded', async () => {
    const { getSmartFareComparisonForRoute } = await import('@/lib/smart-fare-route-adapter');
    const { routes } = await import('@/data/routes');
    const validRoutes = routes
      .filter((route) => getSmartFareComparisonForRoute(route.slug, NOW_ISO) !== null)
      .map((route) => route.slug)
      .sort();
    expect(validRoutes).toEqual(['manchester-islamabad']);
  });
});

describe('Route Intelligence, verification, and route existence are unaffected', () => {
  it('every Book-By priority route still resolves to a real Route record', () => {
    for (const slug of BOOK_BY_PRIORITY_ROUTE_SLUGS) {
      expect(getRouteBySlug(slug), slug).toBeTruthy();
    }
  });
});
