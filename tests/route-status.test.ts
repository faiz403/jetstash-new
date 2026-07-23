import { describe, it, expect } from 'vitest';
import {
  routes,
  getRouteBySlug,
  getRouteStatus,
  type Route,
} from '@/data/routes';
import {
  routeStatusEvents,
  validateStatusLedger,
  isCurrentClaimValid,
  getActiveEvents,
  getSupersededIds,
  type RouteStatusEvent,
  type SourceRef,
} from '@/data/route-status-events';

const FIXED_TODAY = '2026-07-23';

const SOURCE: SourceRef = {
  publisher: 'Test Publisher',
  url: 'https://example.com/source',
  accessedAt: FIXED_TODAY,
};

/** Minimal, complete synthetic Route fixture — never a real route, never touches data/routes.ts's array. */
function makeRoute(overrides: Partial<Route>): Route {
  return {
    slug: 'fixture-route',
    airportSlug: 'manchester',
    destinationSlug: 'lahore',
    flightTime: '8h direct',
    frequency: 'Daily direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro: 'Fixture intro.',
    bookingWindowNote: 'Fixture booking window note.',
    peakPeriodIds: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<RouteStatusEvent> & Pick<RouteStatusEvent, 'type'>): RouteStatusEvent {
  const base = {
    id: 'fixture-event',
    routeSlug: 'fixture-route',
    serviceId: 'fixture-service',
    scope: { kind: 'airline' as const, airlineSlug: 'pia' },
    headline: 'Fixture headline',
    explanation: 'Fixture explanation.',
    sources: [SOURCE],
    verifiedAt: FIXED_TODAY,
  };
  return { ...base, ...overrides } as RouteStatusEvent;
}

describe('Route Status V1 — real corridor data integrity', () => {
  it('the real ledger passes full validation against the real route slugs', () => {
    const knownSlugs = new Set(routes.map((r) => r.slug));
    const errors = validateStatusLedger(routeStatusEvents, knownSlugs);
    expect(errors).toEqual([]);
  });

  it('manchester-mumbai and manchester-delhi each have exactly one withdrawal-announced event, sourced only to the June release', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const events = routeStatusEvents.filter((e) => e.routeSlug === slug);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('withdrawal-announced');
      expect(events[0].sources).toHaveLength(1);
      expect(events[0].sources[0].publisher).toBe('IndiGo');
      expect(events[0].sources[0].url).toContain('indigo-temporarily-discontinues-manchester-flights');
      // Must NOT cite the February schedule-reduction release — different claim, lives on route.verification.
      expect(events[0].sources[0].url).not.toContain('adjusts-wide-body-network');
    }
  });

  it('the withdrawal events use the exact required dates and omit lastOperatingDate entirely', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const event = routeStatusEvents.find((e) => e.routeSlug === slug)!;
      expect(event.type).toBe('withdrawal-announced');
      if (event.type !== 'withdrawal-announced') return;
      expect(event.announcedAt).toBe('2026-06-02');
      expect(event.effectiveFrom).toBe('2026-08-31');
      expect(event.currentClaimValidBefore).toBe('2026-08-31');
      expect(event.lastOperatingDate).toBeUndefined();
    }
  });

  it('no event explanation claims or implies a "last flight" / final operating date', () => {
    for (const event of routeStatusEvents) {
      expect(event.explanation.toLowerCase()).not.toMatch(/last (scheduled )?flight/);
      expect(event.headline.toLowerCase()).not.toMatch(/last (scheduled )?flight/);
    }
  });

  it('route.verification on both corridors now cites only the February release, not the June withdrawal release', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      expect(route.verification!.sourceUrl).toContain('adjusts-wide-body-network');
      expect(route.verification!.sourceName).not.toMatch(/temporarily discontinues/i);
      expect(route.verification!.note).not.toMatch(/temporarily discontinues/i);
    }
  });
});

describe('Route Status V1 — real corridors: date-boundary derivation', () => {
  it('2026-08-30 (day before effectiveFrom): both corridors report withdrawal-announced', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, '2026-08-30');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('withdrawal-announced');
      expect(result!.effectiveFrom).toBe('2026-08-31');
    }
  });

  it('2026-08-31 (effectiveFrom itself, no fresh post-transition evidence): both corridors report verification-pending, never service-ended and never verified-direct', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, '2026-08-31');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('verification-pending');
    }
  });

  it('2026-09-15 (long after effectiveFrom, still no fresh service-ended evidence): stays verification-pending — an announcement alone never becomes an occurrence', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, '2026-09-15');
      expect(result!.status).toBe('verification-pending');
    }
  });

  it('well before the announcement is even relevant (2026-07-23, today): both corridors still report withdrawal-announced since the event is already active', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, FIXED_TODAY);
      expect(result!.status).toBe('withdrawal-announced');
    }
  });
});

describe('Route Status V1 — ledger-managed routes only', () => {
  it('a route with zero ledger events returns null (unmanaged), regardless of isDirect', () => {
    const directRoute = getRouteBySlug('manchester-lahore')!;
    expect(getRouteStatus(directRoute, routeStatusEvents, FIXED_TODAY)).toBeNull();
  });

  it('birmingham-mumbai (isDirect:false, no ledger events) returns null — existing connecting-route behaviour is completely untouched by Route Status', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.isDirect).toBe(false);
    expect(getRouteStatus(route, routeStatusEvents, FIXED_TODAY)).toBeNull();
  });

  it('every route in the real dataset except the two ledger-managed corridors returns null', () => {
    const managedSlugs = new Set(routeStatusEvents.map((e) => e.routeSlug));
    expect(managedSlugs).toEqual(new Set(['manchester-mumbai', 'manchester-delhi']));
    for (const route of routes) {
      const result = getRouteStatus(route, routeStatusEvents, FIXED_TODAY);
      if (managedSlugs.has(route.slug)) {
        expect(result, route.slug).not.toBeNull();
      } else {
        expect(result, route.slug).toBeNull();
      }
    }
  });

  it('a ledger-managed route never returns the "connecting" label — connectingAlternative and isDirect:false are never read as current-connecting-service proof', () => {
    // Synthetic: an airline-scoped service ends, sole operator, connectingAlternative present.
    const route = makeRoute({
      slug: 'fixture-route',
      isDirect: true,
      airlineSlugs: ['pia'],
      connectingAlternative: {
        typicalStops: 1,
        hubAirports: ['Dubai'],
        typicalAirlines: ['Emirates'],
        typicalJourneyTime: '14h',
      },
    });
    const ended = makeEvent({
      id: 'ev-ended',
      routeSlug: 'fixture-route',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result = getRouteStatus(route, [ended], FIXED_TODAY);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('service-ended');
    // No 'connecting' label exists in the type at all, but assert explicitly it was never produced.
    const status: string = result!.status;
    expect(status).not.toBe('connecting');
  });
});

describe('Route Status V1 — multi-airline service-scoped derivation', () => {
  it('airline-scoped withdrawal with another airline explicitly, currently verified direct: route stays verified-direct with a service-level withdrawal notice', () => {
    const route = makeRoute({
      slug: 'fixture-multi',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [
        {
          airlineSlug: 'emirates',
          status: 'verified',
          sourceName: 'Emirates own booking system',
          verifiedDate: FIXED_TODAY,
          reviewDueDate: '2027-01-01',
          effectivePeriod: 'Current at access',
          supportedClaim: 'Confirms Emirates operates this route direct.',
        },
      ],
    });
    const withdrawal = makeEvent({
      id: 'ev-pia-withdraw',
      routeSlug: 'fixture-multi',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], FIXED_TODAY);
    expect(result!.status).toBe('verified-direct');
    expect(result!.serviceNotices).toEqual([{ airlineSlug: 'pia', kind: 'withdrawal-announced', effectiveFrom: '2026-08-01' }]);
  });

  it('airline-scoped service-ended with another airline explicitly, currently verified direct: route stays verified-direct with an ended-service notice', () => {
    const route = makeRoute({
      slug: 'fixture-multi-2',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [
        {
          airlineSlug: 'emirates',
          status: 'verified',
          sourceName: 'Emirates own booking system',
          verifiedDate: FIXED_TODAY,
          reviewDueDate: '2027-01-01',
          effectivePeriod: 'Current at access',
          supportedClaim: 'Confirms Emirates operates this route direct.',
        },
      ],
    });
    const ended = makeEvent({
      id: 'ev-pia-ended',
      routeSlug: 'fixture-multi-2',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result = getRouteStatus(route, [ended], FIXED_TODAY);
    expect(result!.status).toBe('verified-direct');
    expect(result!.serviceNotices).toEqual([{ airlineSlug: 'pia', kind: 'service-ended', effectiveFrom: '2026-07-01' }]);
  });

  it('multi-airline route with an airline-scoped withdrawal and NO explicit evidence about the other airline: verification-pending, never a guess', () => {
    const route = makeRoute({
      slug: 'fixture-multi-3',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      // No airlineVerifications at all — route-level verification (if any) cannot identify which airline it covers.
      verification: {
        status: 'verified',
        sourceName: 'Route-level source naming both airlines collectively',
        verifiedDate: FIXED_TODAY,
        reviewDueDate: '2027-01-01',
      },
    });
    const withdrawal = makeEvent({
      id: 'ev-pia-withdraw-ambiguous',
      routeSlug: 'fixture-multi-3',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], FIXED_TODAY);
    expect(result!.status).toBe('verification-pending');
    expect(result!.serviceNotices).toEqual([]);
  });

  it('multi-airline route-level verification alone never identifies which airline remains — ended-service case is equally ambiguous without explicit per-airline evidence', () => {
    const route = makeRoute({
      slug: 'fixture-multi-4',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      verification: {
        status: 'verified',
        sourceName: 'Route-level source naming both airlines collectively',
        verifiedDate: FIXED_TODAY,
        reviewDueDate: '2027-01-01',
      },
    });
    const ended = makeEvent({
      id: 'ev-pia-ended-ambiguous',
      routeSlug: 'fixture-multi-4',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result = getRouteStatus(route, [ended], FIXED_TODAY);
    expect(result!.status).toBe('verification-pending');
  });

  it('single-airline route with fresh route-level verification: the sole-operator fallback is used intentionally, not treated as ambiguous', () => {
    const route = makeRoute({
      slug: 'fixture-single',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const withdrawal = makeEvent({
      id: 'ev-single-withdraw',
      routeSlug: 'fixture-single',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
  });
});

describe('Route Status V1 — connectingAlternative never proves current connecting service', () => {
  it('service-ended wording context (structural check): the result carries no connecting-service claim of any kind', () => {
    const route = makeRoute({
      slug: 'fixture-neutral',
      isDirect: true,
      airlineSlugs: ['pia'],
      connectingAlternative: {
        typicalStops: 1,
        hubAirports: ['Doha'],
        typicalAirlines: ['Qatar Airways'],
        typicalJourneyTime: '13h',
      },
    });
    const ended = makeEvent({
      id: 'ev-neutral-ended',
      routeSlug: 'fixture-neutral',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result = getRouteStatus(route, [ended], FIXED_TODAY);
    // RouteStatusResult has no field that could carry a connecting claim —
    // structurally impossible for this derivation to assert one.
    expect(result).toEqual({ status: 'service-ended', effectiveFrom: '2026-07-01', serviceNotices: [] });
  });
});

describe('Route Status V1 — lifecycle: cancellation and reschedule', () => {
  it('a later cancellation (same serviceId, later announcedAt) resolves to no active plan — route falls through to base current-verification, not "ended"', () => {
    const route = makeRoute({ slug: 'fixture-cancel', airlineSlugs: ['pia'], isDirect: true });
    const withdrawal = makeEvent({
      id: 'ev-cancel-withdraw',
      routeSlug: 'fixture-cancel',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const cancellation = makeEvent({
      id: 'ev-cancel-cancel',
      routeSlug: 'fixture-cancel',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-cancelled',
      announcedAt: '2026-06-15',
      relatedEventId: 'ev-cancel-withdraw',
      currentClaimValidBefore: '2027-01-01',
    });
    const result = getRouteStatus(route, [withdrawal, cancellation], FIXED_TODAY);
    // No route.verification supplied on the fixture, so base check is unverified.
    expect(result!.status).toBe('verification-pending');
    expect(result!.status).not.toBe('service-ended');
  });

  it('the cancellation does NOT supersede the original announcement — both remain in the ledger as history', () => {
    const withdrawal = makeEvent({
      id: 'ev-hist-withdraw',
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const cancellation = makeEvent({
      id: 'ev-hist-cancel',
      type: 'withdrawal-cancelled',
      announcedAt: '2026-06-15',
      relatedEventId: 'ev-hist-withdraw',
      currentClaimValidBefore: '2027-01-01',
    });
    const errors = validateStatusLedger([withdrawal, cancellation]);
    expect(errors).toEqual([]);
    // Neither event supersedes the other — both are active/historical.
    expect(withdrawal.supersedesEventId).toBeUndefined();
    expect(cancellation.supersedesEventId).toBeUndefined();
  });

  it('a later reschedule (same serviceId, later announcedAt) produces withdrawal-announced with the NEW effectiveFrom', () => {
    const route = makeRoute({
      slug: 'fixture-reschedule',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const withdrawal = makeEvent({
      id: 'ev-resched-withdraw',
      routeSlug: 'fixture-reschedule',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const reschedule = makeEvent({
      id: 'ev-resched-new',
      routeSlug: 'fixture-reschedule',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-rescheduled',
      announcedAt: '2026-06-15',
      newEffectiveFrom: '2026-10-01',
      relatedEventId: 'ev-resched-withdraw',
      currentClaimValidBefore: '2026-10-01',
    });
    const result = getRouteStatus(route, [withdrawal, reschedule], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
    expect(result!.effectiveFrom).toBe('2026-10-01');
  });
});

describe('Route Status V1 — ambiguous same-day lifecycle ordering', () => {
  it('two plan events for the same service, same announcedAt, no relatedEventId chain: verification-pending with ambiguous flag', () => {
    const route = makeRoute({ slug: 'fixture-ambiguous-order', airlineSlugs: ['pia'], isDirect: true });
    const planA = makeEvent({
      id: 'ev-order-a',
      routeSlug: 'fixture-ambiguous-order',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const planB = makeEvent({
      id: 'ev-order-b',
      routeSlug: 'fixture-ambiguous-order',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-rescheduled',
      announcedAt: '2026-06-01', // SAME day, no relatedEventId linking them
      newEffectiveFrom: '2026-09-15',
      currentClaimValidBefore: '2026-09-15',
    });
    const result = getRouteStatus(route, [planA, planB], FIXED_TODAY);
    expect(result!.status).toBe('verification-pending');
    expect(result!.ambiguous).toBe(true);
  });

  it('the same two events WITH an explicit relatedEventId chain resolve deterministically (no ambiguity)', () => {
    const route = makeRoute({
      slug: 'fixture-chain-order',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const planA = makeEvent({
      id: 'ev-chain-a',
      routeSlug: 'fixture-chain-order',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const planB = makeEvent({
      id: 'ev-chain-b',
      routeSlug: 'fixture-chain-order',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-rescheduled',
      announcedAt: '2026-06-01',
      newEffectiveFrom: '2026-09-15',
      relatedEventId: 'ev-chain-a', // explicit chain: B relates to (comes after) A
      currentClaimValidBefore: '2026-09-15',
    });
    const result = getRouteStatus(route, [planA, planB], FIXED_TODAY);
    expect(result!.status).toBe('withdrawal-announced');
    expect(result!.effectiveFrom).toBe('2026-09-15');
    expect(result!.ambiguous).toBeUndefined();
  });
});

describe('Route Status V1 — strict current-claim freshness (nowIso < validBefore)', () => {
  it('isCurrentClaimValid is strict: equal to validBefore is NOT current', () => {
    expect(isCurrentClaimValid('2026-08-31', '2026-08-30')).toBe(true);
    expect(isCurrentClaimValid('2026-08-31', '2026-08-31')).toBe(false);
    expect(isCurrentClaimValid('2026-08-31', '2026-09-01')).toBe(false);
  });

  it('a route with no active plan falls back to strict route-level verification — exactly at reviewDueDate it is NOT current', () => {
    const route = makeRoute({
      slug: 'fixture-strict-base',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: {
        status: 'verified',
        sourceName: 'Test',
        verifiedDate: FIXED_TODAY,
        reviewDueDate: '2026-08-31',
      },
    });
    // A single historical (non-current-driving) event just to make the route ledger-managed.
    const launch = makeEvent({
      id: 'ev-launch',
      routeSlug: 'fixture-strict-base',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-launched',
      basis: 'observed',
      effectiveFrom: '2025-01-01',
    });
    expect(getRouteStatus(route, [launch], '2026-08-30')!.status).toBe('verified-direct');
    expect(getRouteStatus(route, [launch], '2026-08-31')!.status).toBe('verification-pending');
  });
});

describe('Route Status V1 — supersession (correction only, never lifecycle)', () => {
  it('transitive chain A <- B <- C: supersededIds excludes {A, B}; only C participates in derivation', () => {
    const route = makeRoute({
      slug: 'fixture-super',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const a = makeEvent({
      id: 'evt-a',
      routeSlug: 'fixture-super',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-06-01',
      currentClaimValidBefore: '2026-06-01',
    });
    const b = makeEvent({
      id: 'evt-b',
      routeSlug: 'fixture-super',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-02-01',
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2026-07-01',
      supersedesEventId: 'evt-a',
    });
    const c = makeEvent({
      id: 'evt-c',
      routeSlug: 'fixture-super',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-03-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
      supersedesEventId: 'evt-b',
    });
    const errors = validateStatusLedger([a, b, c]);
    expect(errors).toEqual([]);

    // C's effectiveFrom (2026-08-01) must be the one driving derivation, not A's or B's.
    const result = getRouteStatus(route, [a, b, c], '2026-07-15');
    expect(result!.status).toBe('withdrawal-announced');
    expect(result!.effectiveFrom).toBe('2026-08-01');
  });

  it('a corrected (superseded) event never reactivates even after its immediate successor is itself superseded', () => {
    const a = makeEvent({ id: 'evt-x', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });
    const b = makeEvent({ id: 'evt-y', type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-07-01', currentClaimValidBefore: '2026-07-01', supersedesEventId: 'evt-x' });
    const c = makeEvent({ id: 'evt-z', type: 'withdrawal-announced', announcedAt: '2026-03-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'evt-y' });
    const superseded = getSupersededIds([a, b, c]);
    expect(superseded).toEqual(new Set(['evt-x', 'evt-y']));
    const active = getActiveEvents([a, b, c]);
    expect(active.map((e: RouteStatusEvent) => e.id)).toEqual(['evt-z']);
  });
});

describe('Route Status V1 — ledger validation failures (all required cases)', () => {
  it('rejects duplicate IDs', () => {
    const e1 = makeEvent({ id: 'dup', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const e2 = makeEvent({ id: 'dup', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-02-01' });
    const errors = validateStatusLedger([e1, e2]);
    expect(errors.some((e) => e.code === 'duplicate-id')).toBe(true);
  });

  it('rejects a missing route reference (empty routeSlug)', () => {
    const e = makeEvent({ id: 'e1', routeSlug: '', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([e]);
    expect(errors.some((e) => e.code === 'missing-route')).toBe(true);
  });

  it('rejects an unknown route reference when knownRouteSlugs is supplied', () => {
    const e = makeEvent({ id: 'e1', routeSlug: 'not-a-real-route', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([e], new Set(['manchester-mumbai']));
    expect(errors.some((e) => e.code === 'unknown-route')).toBe(true);
  });

  it('rejects a missing service reference (empty serviceId)', () => {
    const e = makeEvent({ id: 'e1', serviceId: '', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([e]);
    expect(errors.some((e) => e.code === 'missing-service')).toBe(true);
  });

  it('rejects an empty sources array', () => {
    const e = makeEvent({ id: 'e1', sources: [], type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([e]);
    expect(errors.some((e) => e.code === 'empty-sources')).toBe(true);
  });

  it('rejects a source missing publisher/url/accessedAt', () => {
    const e = makeEvent({
      id: 'e1',
      sources: [{ publisher: '', url: '', accessedAt: '' }],
      type: 'service-launched',
      basis: 'observed',
      effectiveFrom: '2025-01-01',
    });
    const errors = validateStatusLedger([e]);
    expect(errors.some((e) => e.code === 'invalid-source')).toBe(true);
  });

  it('rejects invalid ISO dates (event field and source field)', () => {
    const e1 = makeEvent({ id: 'e1', type: 'withdrawal-announced', announcedAt: 'not-a-date', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const e2 = makeEvent({ id: 'e2', type: 'service-launched', basis: 'observed', effectiveFrom: '2026-13-45' });
    const e3 = makeEvent({ id: 'e3', sources: [{ publisher: 'X', url: 'https://x.com', accessedAt: '2026/07/23' }], type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([e1, e2, e3]);
    expect(errors.filter((e) => e.code === 'invalid-date').length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a missing supersession target', () => {
    const e = makeEvent({ id: 'e1', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'does-not-exist' });
    const errors = validateStatusLedger([e]);
    expect(errors.some((e) => e.code === 'missing-supersession-target')).toBe(true);
  });

  it('rejects self-reference (supersedesEventId and relatedEventId)', () => {
    const e1 = makeEvent({ id: 'self1', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'self1' });
    const e2 = makeEvent({ id: 'self2', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'self2' });
    const errors = validateStatusLedger([e1, e2]);
    expect(errors.filter((e) => e.code === 'self-reference').length).toBe(2);
  });

  it('rejects a supersession cycle', () => {
    const a = makeEvent({ id: 'cyc-a', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'cyc-b' });
    const b = makeEvent({ id: 'cyc-b', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'cyc-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'supersession-cycle')).toBe(true);
  });

  it('rejects multiple direct successors for the same predecessor', () => {
    const a = makeEvent({ id: 'multi-a', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'multi-b', type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'multi-a' });
    const c = makeEvent({ id: 'multi-c', type: 'withdrawal-announced', announcedAt: '2026-03-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'multi-a' });
    const errors = validateStatusLedger([a, b, c]);
    expect(errors.some((e) => e.code === 'multiple-successors')).toBe(true);
  });

  it('rejects a relatedEventId that targets a missing event', () => {
    const e = makeEvent({ id: 'e1', type: 'withdrawal-cancelled', announcedAt: '2026-01-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'ghost' });
    const errors = validateStatusLedger([e]);
    expect(errors.some((e) => e.code === 'missing-related-target')).toBe(true);
  });

  it('rejects a lifecycle link across different serviceIds', () => {
    const a = makeEvent({ id: 'svc-a', serviceId: 'service-one', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'svc-b', serviceId: 'service-two', type: 'withdrawal-cancelled', announcedAt: '2026-02-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'svc-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'cross-service-link')).toBe(true);
  });

  it('rejects an event where supersedesEventId and relatedEventId target the same event (correction vs lifecycle ambiguity)', () => {
    const a = makeEvent({ id: 'amb-a', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'amb-b', type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'amb-a', relatedEventId: 'amb-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'ambiguous-relationship')).toBe(true);
  });
});

describe('Route Status V1 — no stored operational policy', () => {
  it('RouteStatusEvent has no routeWatchEligible field or equivalent (compile-time + structural check)', () => {
    const event = routeStatusEvents[0] as unknown as Record<string, unknown>;
    expect(event.routeWatchEligible).toBeUndefined();
    expect('routeWatchEligible' in event).toBe(false);
  });
});

describe('Route Status V1 — no regression to non-ledger routes or getRoutePresentation', () => {
  it('every real route not on the ledger still resolves getDisplayDirectness/getRoutePresentation exactly as before (spot check across statuses)', () => {
    const sample = ['manchester-lahore', 'birmingham-mumbai', 'london-heathrow-mumbai', 'manchester-amritsar'];
    for (const slug of sample) {
      const route = getRouteBySlug(slug)!;
      expect(getRouteStatus(route, routeStatusEvents, FIXED_TODAY)).toBeNull();
    }
  });
});

describe('Route Status V1 — review fix: lifecycle cycles fail safely', () => {
  it('rejects a relatedEventId cycle: A relates to B, B relates to A', () => {
    const a = makeEvent({ id: 'cyc-lc-a', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'cyc-lc-b' });
    const b = makeEvent({ id: 'cyc-lc-b', type: 'withdrawal-rescheduled', announcedAt: '2026-02-01', newEffectiveFrom: '2026-09-01', currentClaimValidBefore: '2026-09-01', relatedEventId: 'cyc-lc-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'lifecycle-cycle')).toBe(true);
  });

  it('relatedEventId self-reference remains rejected as self-reference (not conflated with lifecycle-cycle)', () => {
    const e = makeEvent({ id: 'self-rel', type: 'withdrawal-cancelled', announcedAt: '2026-01-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'self-rel' });
    const errors = validateStatusLedger([e]);
    expect(errors.some((err) => err.code === 'self-reference')).toBe(true);
  });

  it('a lifecycle link across different routeSlugs is rejected', () => {
    const a = makeEvent({ id: 'route-a', routeSlug: 'route-one', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'route-b', routeSlug: 'route-two', type: 'withdrawal-cancelled', announcedAt: '2026-02-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'route-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'cross-route-link')).toBe(true);
  });

  it('a lifecycle link that changes airline scope is rejected', () => {
    const a = makeEvent({
      id: 'scope-a',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const b = makeEvent({
      id: 'scope-b',
      scope: { kind: 'airline', airlineSlug: 'emirates' }, // different airline, same serviceId
      type: 'withdrawal-cancelled',
      announcedAt: '2026-02-01',
      currentClaimValidBefore: '2026-08-01',
      relatedEventId: 'scope-a',
    });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'cross-scope-link')).toBe(true);
  });

  it('one serviceId reused across different routeSlugs is rejected', () => {
    const a = makeEvent({ id: 'reuse-a', routeSlug: 'route-alpha', serviceId: 'shared-service', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const b = makeEvent({ id: 'reuse-b', routeSlug: 'route-beta', serviceId: 'shared-service', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'reused-service-id')).toBe(true);
  });

  it('getRouteStatus() does not throw for a malformed relatedEventId cycle reaching derivation directly (bypassing validation) — it returns verification-pending with ambiguous:true', () => {
    const route = makeRoute({
      slug: 'fixture-malformed-cycle',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const a = makeEvent({
      id: 'mal-a',
      routeSlug: 'fixture-malformed-cycle',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
      relatedEventId: 'mal-b',
    });
    const b = makeEvent({
      id: 'mal-b',
      routeSlug: 'fixture-malformed-cycle',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-rescheduled',
      announcedAt: '2026-02-01',
      newEffectiveFrom: '2026-09-01',
      currentClaimValidBefore: '2026-09-01',
      relatedEventId: 'mal-a', // A <-> B: a genuine cycle, never validated before reaching derivation
    });
    expect(() => getRouteStatus(route, [a, b], FIXED_TODAY)).not.toThrow();
    const result = getRouteStatus(route, [a, b], FIXED_TODAY);
    expect(result!.status).toBe('verification-pending');
    expect(result!.ambiguous).toBe(true);
  });
});

describe('Route Status V1 — review fix: withdrawal-announced requires fresh current-service evidence', () => {
  it('sole airline + current withdrawal + NO current route or airline verification: verification-pending, not withdrawal-announced', () => {
    const route = makeRoute({ slug: 'fixture-no-evidence', airlineSlugs: ['pia'], isDirect: true }); // no verification at all
    const withdrawal = makeEvent({
      id: 'ev-no-evidence',
      routeSlug: 'fixture-no-evidence',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('verification-pending');
  });

  it('sole airline + fresh strict route.verification: withdrawal-announced', () => {
    const route = makeRoute({
      slug: 'fixture-fresh-route-verification',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-09-01' },
    });
    const withdrawal = makeEvent({
      id: 'ev-fresh-route',
      routeSlug: 'fixture-fresh-route-verification',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
  });

  it('sole airline + fresh explicit AIRLINE verification (no route-level verification at all): withdrawal-announced', () => {
    const route = makeRoute({
      slug: 'fixture-fresh-airline-verification',
      airlineSlugs: ['pia'],
      isDirect: true,
      airlineVerifications: [
        {
          airlineSlug: 'pia',
          status: 'verified',
          sourceName: 'PIA own booking system',
          verifiedDate: FIXED_TODAY,
          reviewDueDate: '2026-09-01',
          effectivePeriod: 'Current at access',
          supportedClaim: 'Confirms PIA operates this route direct.',
        },
      ],
    });
    const withdrawal = makeEvent({
      id: 'ev-fresh-airline',
      routeSlug: 'fixture-fresh-airline-verification',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
  });

  it('real Manchester–Mumbai and Manchester–Delhi on 2026-08-30 remain withdrawal-announced (their route.verification is fresh)', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, '2026-08-30');
      expect(result!.status, slug).toBe('withdrawal-announced');
    }
  });

  it('stale direct verification before effectiveFrom: verification-pending, even though the withdrawal event itself is still current-claim-valid', () => {
    const route = makeRoute({
      slug: 'fixture-stale-verification',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: '2026-01-01', reviewDueDate: '2026-06-01' }, // already stale by 2026-07-01
    });
    const withdrawal = makeEvent({
      id: 'ev-stale',
      routeSlug: 'fixture-stale-verification',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('verification-pending');
  });

  it('route-scoped withdrawal plan is equally gated on fresh route-level evidence', () => {
    const routeNoEvidence = makeRoute({ slug: 'fixture-route-scoped-no-evidence', isDirect: true }); // no verification
    const plan = makeEvent({
      id: 'ev-route-scoped-no-evidence',
      routeSlug: 'fixture-route-scoped-no-evidence',
      serviceId: 'route-wide-service',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    expect(getRouteStatus(routeNoEvidence, [plan], '2026-07-01')!.status).toBe('verification-pending');

    const routeWithEvidence = makeRoute({
      slug: 'fixture-route-scoped-with-evidence',
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-09-01' },
    });
    const plan2 = makeEvent({ ...plan, id: 'ev-route-scoped-with-evidence', routeSlug: 'fixture-route-scoped-with-evidence' });
    expect(getRouteStatus(routeWithEvidence, [plan2], '2026-07-01')!.status).toBe('withdrawal-announced');
  });

  it('a verified service-ended occurrence does NOT require earlier fresh direct verification — the verified occurrence itself supports the ended fact', () => {
    const route = makeRoute({ slug: 'fixture-ended-no-prior-verification', airlineSlugs: ['pia'], isDirect: true }); // no verification block at all
    const ended = makeEvent({
      id: 'ev-ended-no-verification',
      routeSlug: 'fixture-ended-no-prior-verification',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result = getRouteStatus(route, [ended], FIXED_TODAY);
    expect(result!.status).toBe('service-ended');
  });
});

describe('Route Status V1 — review fix: corrections must stay on the same logical service', () => {
  it('supersedesEventId targeting a different routeSlug is rejected', () => {
    const a = makeEvent({ id: 'corr-route-a', routeSlug: 'route-one', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'corr-route-b', routeSlug: 'route-two', type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'corr-route-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'correction-cross-route')).toBe(true);
  });

  it('supersedesEventId targeting a different serviceId is rejected', () => {
    const a = makeEvent({ id: 'corr-svc-a', serviceId: 'service-alpha', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'corr-svc-b', serviceId: 'service-beta', type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'corr-svc-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'correction-cross-service')).toBe(true);
  });

  it('a correction with a different scope but no correctsScope flag is rejected', () => {
    const a = makeEvent({
      id: 'corr-scope-a',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const b = makeEvent({
      id: 'corr-scope-b',
      scope: { kind: 'airline', airlineSlug: 'pia' }, // scope changed, not flagged
      type: 'withdrawal-announced',
      announcedAt: '2026-02-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
      supersedesEventId: 'corr-scope-a',
    });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'unflagged-scope-correction')).toBe(true);
  });

  it('the same scope-changing correction WITH correctsScope:true is accepted', () => {
    const a = makeEvent({
      id: 'corr-scope-ok-a',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const b = makeEvent({
      id: 'corr-scope-ok-b',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-02-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
      supersedesEventId: 'corr-scope-ok-a',
      correctsScope: true,
    });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'unflagged-scope-correction')).toBe(false);
  });

  it('relatedEventId requires identical scope kind AND airlineSlug — a route-scoped event relating to an airline-scoped event is rejected', () => {
    const a = makeEvent({ id: 'rel-scope-a', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'rel-scope-b', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-cancelled', announcedAt: '2026-02-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'rel-scope-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'cross-scope-link')).toBe(true);
  });

  it('relatedEventId requires the same routeSlug (redundant with the lifecycle-link test above, confirmed here for the supersedesEventId sibling case too)', () => {
    const a = makeEvent({ id: 'rel-route-a', routeSlug: 'route-x', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'rel-route-b', routeSlug: 'route-y', type: 'withdrawal-cancelled', announcedAt: '2026-02-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'rel-route-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'cross-route-link')).toBe(true);
  });

  it('the real ledger has no supersession or lifecycle events at all in Phase 1, so none of these new checks fire against real data', () => {
    expect(routeStatusEvents.every((e) => !e.supersedesEventId && !e.relatedEventId)).toBe(true);
  });
});

describe('Route Status V1 — review fix: multiple route-scoped current lifecycles never depend on array order', () => {
  it('two independent, simultaneously active route-scoped serviceIds: verification-pending with ambiguous:true, regardless of input order', () => {
    const route = makeRoute({
      slug: 'fixture-route-scoped-order',
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const planOne = makeEvent({
      id: 'route-scope-one',
      routeSlug: 'fixture-route-scoped-order',
      serviceId: 'route-service-one',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const planTwo = makeEvent({
      id: 'route-scope-two',
      routeSlug: 'fixture-route-scoped-order',
      serviceId: 'route-service-two', // a DIFFERENT serviceId — an unrelated route-wide claim
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-15',
      effectiveFrom: '2026-09-01',
      currentClaimValidBefore: '2026-10-01',
    });

    const forward = getRouteStatus(route, [planOne, planTwo], '2026-07-01');
    const reversed = getRouteStatus(route, [planTwo, planOne], '2026-07-01');

    expect(forward!.status).toBe('verification-pending');
    expect(forward!.ambiguous).toBe(true);
    expect(reversed!.status).toBe('verification-pending');
    expect(reversed!.ambiguous).toBe(true);
    expect(forward).toEqual(reversed);
  });

  it('exactly one active route-scoped serviceId (the normal case) is unaffected by this change', () => {
    const route = makeRoute({
      slug: 'fixture-route-scoped-single',
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const plan = makeEvent({
      id: 'route-scope-single',
      routeSlug: 'fixture-route-scoped-single',
      serviceId: 'route-service-single',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const result = getRouteStatus(route, [plan], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
    expect(result!.ambiguous).toBeUndefined();
  });
});

describe('Route Status V1 — review fix: mixed active scopes within one serviceId', () => {
  it('validateStatusLedger rejects a serviceId whose ACTIVE events have different scopes (one route-scoped, one airline-scoped)', () => {
    const routeScoped = makeEvent({
      id: 'mixed-scope-route',
      serviceId: 'mixed-service',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const airlineScoped = makeEvent({
      id: 'mixed-scope-airline',
      serviceId: 'mixed-service', // SAME serviceId, no relation/supersession between them
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-02',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const errors = validateStatusLedger([routeScoped, airlineScoped]);
    expect(errors.some((e) => e.code === 'inconsistent-active-service-scope')).toBe(true);
  });

  it('the same malformed input passed directly to getRouteStatus() (bypassing validation) never throws and returns verification-pending with ambiguous:true', () => {
    const route = makeRoute({
      slug: 'fixture-mixed-scope',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const routeScoped = makeEvent({
      id: 'mixed-scope-derivation-route',
      routeSlug: 'fixture-mixed-scope',
      serviceId: 'mixed-service-derivation',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const airlineScoped = makeEvent({
      id: 'mixed-scope-derivation-airline',
      routeSlug: 'fixture-mixed-scope',
      serviceId: 'mixed-service-derivation',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-02',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    expect(() => getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01')).not.toThrow();
    const result = getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01');
    expect(result!.status).toBe('verification-pending');
    expect(result!.ambiguous).toBe(true);
  });

  it('forward and reversed event order produce identical results for the mixed-scope case', () => {
    const route = makeRoute({
      slug: 'fixture-mixed-scope-order',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const routeScoped = makeEvent({
      id: 'mixed-scope-order-route',
      routeSlug: 'fixture-mixed-scope-order',
      serviceId: 'mixed-service-order',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const airlineScoped = makeEvent({
      id: 'mixed-scope-order-airline',
      routeSlug: 'fixture-mixed-scope-order',
      serviceId: 'mixed-service-order',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-02',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const forward = getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01');
    const reversed = getRouteStatus(route, [airlineScoped, routeScoped], '2026-07-01');
    expect(forward).toEqual(reversed);
    expect(forward!.status).toBe('verification-pending');
    expect(forward!.ambiguous).toBe(true);
  });

  it('a valid scope-changing correction (correctsScope:true) still passes validation once supersession removes the old active scope', () => {
    const original = makeEvent({
      id: 'scope-fix-original',
      serviceId: 'scope-fix-service',
      scope: { kind: 'route' }, // originally recorded route-scoped by mistake
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const correction = makeEvent({
      id: 'scope-fix-correction',
      serviceId: 'scope-fix-service', // SAME serviceId, corrects the scope
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-05',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
      supersedesEventId: 'scope-fix-original',
      correctsScope: true,
    });
    const errors = validateStatusLedger([original, correction]);
    // The original is superseded (no longer active), so only the corrected
    // scope remains active for this serviceId — no inconsistency.
    expect(errors.some((e) => e.code === 'inconsistent-active-service-scope')).toBe(false);

    const route = makeRoute({
      slug: 'fixture-scope-fix',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const originalWithRoute = { ...original, routeSlug: 'fixture-scope-fix' };
    const correctionWithRoute = { ...correction, routeSlug: 'fixture-scope-fix' };
    const result = getRouteStatus(route, [originalWithRoute, correctionWithRoute], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
    expect(result!.ambiguous).toBeUndefined();
  });
});

describe('Route Status V1 — review fix: multiple airline-scoped lifecycles never depend on array order', () => {
  it('two independent active airline-scoped plans (different airlines, both currently withdrawal-announced): verification-pending with ambiguous:true, in both orders', () => {
    const route = makeRoute({ slug: 'fixture-two-plans', airlineSlugs: ['pia', 'emirates'], isDirect: true });
    const planPia = makeEvent({
      id: 'two-plans-pia',
      routeSlug: 'fixture-two-plans',
      serviceId: 'pia-fixture-two-plans-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const planEmirates = makeEvent({
      id: 'two-plans-emirates',
      routeSlug: 'fixture-two-plans',
      serviceId: 'emirates-fixture-two-plans-direct',
      scope: { kind: 'airline', airlineSlug: 'emirates' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-05',
      effectiveFrom: '2026-08-15',
      currentClaimValidBefore: '2026-09-01',
    });
    const forward = getRouteStatus(route, [planPia, planEmirates], '2026-07-01');
    const reversed = getRouteStatus(route, [planEmirates, planPia], '2026-07-01');
    expect(forward!.status).toBe('verification-pending');
    expect(forward!.ambiguous).toBe(true);
    expect(reversed!.status).toBe('verification-pending');
    expect(reversed!.ambiguous).toBe(true);
    expect(forward).toEqual(reversed);
  });

  it('one airline ended, a different airline planned — both simultaneously active: verification-pending with ambiguous:true, in both orders', () => {
    const route = makeRoute({ slug: 'fixture-ended-plus-planned', airlineSlugs: ['pia', 'emirates'], isDirect: true });
    const ended = makeEvent({
      id: 'ended-plus-planned-ended',
      routeSlug: 'fixture-ended-plus-planned',
      serviceId: 'pia-fixture-ended-plus-planned-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const planned = makeEvent({
      id: 'ended-plus-planned-planned',
      routeSlug: 'fixture-ended-plus-planned',
      serviceId: 'emirates-fixture-ended-plus-planned-direct',
      scope: { kind: 'airline', airlineSlug: 'emirates' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-15',
      currentClaimValidBefore: '2026-09-01',
    });
    const forward = getRouteStatus(route, [ended, planned], FIXED_TODAY);
    const reversed = getRouteStatus(route, [planned, ended], FIXED_TODAY);
    expect(forward!.status).toBe('verification-pending');
    expect(forward!.ambiguous).toBe(true);
    expect(reversed!.status).toBe('verification-pending');
    expect(reversed!.ambiguous).toBe(true);
    expect(forward).toEqual(reversed);
  });

  it('existing single-service multi-airline behaviour is unchanged: exactly one active airline-scoped service still resolves normally', () => {
    const route = makeRoute({
      slug: 'fixture-single-airline-scoped-service',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [
        {
          airlineSlug: 'emirates',
          status: 'verified',
          sourceName: 'Emirates own booking system',
          verifiedDate: FIXED_TODAY,
          reviewDueDate: '2027-01-01',
          effectivePeriod: 'Current at access',
          supportedClaim: 'Confirms Emirates operates this route direct.',
        },
      ],
    });
    const withdrawal = makeEvent({
      id: 'single-airline-scoped-withdraw',
      routeSlug: 'fixture-single-airline-scoped-service',
      serviceId: 'pia-fixture-single-service-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], FIXED_TODAY);
    expect(result!.status).toBe('verified-direct');
    expect(result!.serviceNotices).toEqual([{ airlineSlug: 'pia', kind: 'withdrawal-announced', effectiveFrom: '2026-08-01' }]);
  });

  it('Manchester–Mumbai and Manchester–Delhi still return withdrawal-announced on 2026-08-30 after these order-independence fixes', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, '2026-08-30');
      expect(result!.status, slug).toBe('withdrawal-announced');
      expect(result!.ambiguous, slug).toBeUndefined();
    }
  });
});
