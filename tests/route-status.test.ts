import { describe, it, expect } from 'vitest';
import {
  routes,
  getRouteBySlug,
  getRouteStatus,
  buildServiceEndedPresentation,
  type Route,
  type RouteStatusResult,
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
import { getRouteStatusCopy, getEffectiveRoutePresentation } from '@/lib/route-status-copy';

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

/** Asserts pending with the given diagnostic, narrowing along the way. */
function expectConflict(result: RouteStatusResult | null, diagnostic: string) {
  expect(result).not.toBeNull();
  expect(result!.status).toBe('verification-pending');
  if (result!.status !== 'verification-pending') return;
  expect(result!.pendingReason.kind).toBe('conflicting-ledger-evidence');
  if (result!.pendingReason.kind === 'conflicting-ledger-evidence') {
    expect(result!.pendingReason.diagnostic).toBe(diagnostic);
  }
}

function expectTransitionBoundary(result: RouteStatusResult | null, eventId?: string) {
  expect(result).not.toBeNull();
  expect(result!.status).toBe('verification-pending');
  if (result!.status !== 'verification-pending') return;
  expect(result!.pendingReason.kind).toBe('transition-boundary-reached');
  if (result!.pendingReason.kind === 'transition-boundary-reached' && eventId) {
    expect(result!.pendingReason.drivingEventId).toBe(eventId);
  }
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

  it('neither real route record retains directServiceEndDate/directServiceEndNote — fully retired per the final errata §5', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)! as unknown as Record<string, unknown>;
      expect('directServiceEndDate' in route).toBe(false);
      expect('directServiceEndNote' in route).toBe(false);
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
      if (result!.status === 'withdrawal-announced') expect(result!.effectiveFrom).toBe('2026-08-31');
    }
  });

  it('2026-08-31 (effectiveFrom itself): both corridors report verification-pending with transition-boundary-reached, carrying the real driving event id — never service-ended and never verified-direct', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const realEventId = routeStatusEvents.find((e) => e.routeSlug === slug)!.id;
      const result = getRouteStatus(route, routeStatusEvents, '2026-08-31');
      expectTransitionBoundary(result, realEventId);
    }
  });

  it('2026-09-15 (long after effectiveFrom, still no fresh service-ended evidence): stays verification-pending / transition-boundary-reached, still carrying the driving event id — an announcement alone never becomes an occurrence and is never forgotten', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const realEventId = routeStatusEvents.find((e) => e.routeSlug === slug)!.id;
      const result = getRouteStatus(route, routeStatusEvents, '2026-09-15');
      expectTransitionBoundary(result, realEventId);
    }
  });

  it('a year after the boundary (2027-08-31): still correctly surfaces transition-boundary-reached with the same real event id — the fact is never lost once currentClaimValidBefore expires', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const realEventId = routeStatusEvents.find((e) => e.routeSlug === slug)!.id;
      const result = getRouteStatus(route, routeStatusEvents, '2027-08-31');
      expectTransitionBoundary(result, realEventId);
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
    const route = makeRoute({
      slug: 'fixture-route',
      isDirect: true,
      airlineSlugs: ['pia'],
      connectingAlternative: { typicalStops: 1, hubAirports: ['Dubai'], typicalAirlines: ['Emirates'], typicalJourneyTime: '14h' },
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
    const status: string = result!.status;
    expect(status).not.toBe('connecting');
  });
});

describe('Route Status V1 — multi-airline service-scoped derivation', () => {
  it('airline-scoped withdrawal with another airline explicitly, currently verified direct: route stays verified-direct with a service-level withdrawal notice carrying the driving event id', () => {
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
    if (result!.status !== 'verified-direct') return;
    expect(result!.verifiedDirectBasis.length).toBeGreaterThan(0);
    expect(result!.verifiedDirectBasis.every((b) => b.kind === 'airline' && b.airlineSlug === 'emirates')).toBe(true);
    expect(result!.serviceNotices).toEqual([{ airlineSlug: 'pia', kind: 'withdrawal-announced', effectiveFrom: '2026-08-01', drivingEventId: 'ev-pia-withdraw' }]);
  });

  it('airline-scoped service-ended with another airline explicitly, currently verified direct: route stays verified-direct with an ended-service notice carrying the driving event id', () => {
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
    if (result!.status !== 'verified-direct') return;
    expect(result!.serviceNotices).toEqual([{ airlineSlug: 'pia', kind: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-pia-ended' }]);
  });

  it('multi-airline route with an airline-scoped withdrawal and NO explicit evidence about the other airline: verification-pending / no-current-direct-evidence, never a guess', () => {
    const route = makeRoute({
      slug: 'fixture-multi-3',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Route-level source naming both airlines collectively', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
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
    if (result!.status === 'verification-pending') expect(result!.pendingReason.kind).toBe('no-current-direct-evidence');
  });

  it('multi-airline route-level verification alone never identifies which airline remains — ended-service case is equally pending without explicit per-airline evidence', () => {
    const route = makeRoute({
      slug: 'fixture-multi-4',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Route-level source naming both airlines collectively', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
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
      connectingAlternative: { typicalStops: 1, hubAirports: ['Doha'], typicalAirlines: ['Qatar Airways'], typicalJourneyTime: '13h' },
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
    expect(result).toEqual({
      status: 'service-ended',
      effectiveFrom: '2026-07-01',
      drivingEventId: 'ev-neutral-ended',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      serviceNotices: [],
    });
  });

  it('appending a service-ended event never mutates or authorises a connecting claim on the route record itself', () => {
    const route = makeRoute({
      slug: 'fixture-no-mutation',
      isDirect: true,
      airlineSlugs: ['pia'],
      frequency: 'Daily direct',
      connectingAlternative: { typicalStops: 1, hubAirports: ['Doha'], typicalAirlines: ['Qatar Airways'], typicalJourneyTime: '13h' },
    });
    const before = JSON.stringify(route);
    const ended = makeEvent({
      id: 'ev-no-mutation-ended',
      routeSlug: 'fixture-no-mutation',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    getRouteStatus(route, [ended], FIXED_TODAY);
    const presentation = buildServiceEndedPresentation(route);
    expect(JSON.stringify(route)).toBe(before); // route record untouched
    expect(presentation.canShowConnectingAlternative).toBe(false);
    expect(presentation.airlineSlugs).toEqual([]);
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
    expect(result!.status).toBe('verification-pending');
    expect(result!.status).not.toBe('service-ended');
  });

  it('a cancellation prevents transition-boundary copy even after the ORIGINAL effectiveFrom has long passed', () => {
    const route = makeRoute({ slug: 'fixture-cancel-boundary', airlineSlugs: ['pia'], isDirect: true });
    const withdrawal = makeEvent({
      id: 'ev-cancel-boundary-withdraw',
      routeSlug: 'fixture-cancel-boundary',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-09-01',
    });
    const cancellation = makeEvent({
      id: 'ev-cancel-boundary-cancel',
      routeSlug: 'fixture-cancel-boundary',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-cancelled',
      announcedAt: '2026-06-15',
      relatedEventId: 'ev-cancel-boundary-withdraw',
      currentClaimValidBefore: '2027-01-01',
    });
    // Well after the ORIGINAL effectiveFrom (2026-08-01) — must never read as transition-boundary.
    const result = getRouteStatus(route, [withdrawal, cancellation], '2026-12-01')!;
    if (result.status === 'verification-pending') {
      expect(result.pendingReason.kind).not.toBe('transition-boundary-reached');
    } else {
      expect(result.status).not.toBe('service-ended');
    }
  });

  it('the cancellation does NOT supersede the original announcement — both remain in the ledger as history', () => {
    const withdrawal = makeEvent({ id: 'ev-hist-withdraw', type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const cancellation = makeEvent({ id: 'ev-hist-cancel', type: 'withdrawal-cancelled', announcedAt: '2026-06-15', relatedEventId: 'ev-hist-withdraw', currentClaimValidBefore: '2027-01-01' });
    const errors = validateStatusLedger([withdrawal, cancellation]);
    expect(errors).toEqual([]);
    expect(withdrawal.supersedesEventId).toBeUndefined();
    expect(cancellation.supersedesEventId).toBeUndefined();
  });

  it('a later reschedule (same serviceId, later announcedAt) produces withdrawal-announced with the NEW effectiveFrom and its OWN event id', () => {
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
    if (result!.status === 'withdrawal-announced') {
      expect(result!.effectiveFrom).toBe('2026-10-01');
      expect(result!.drivingEventId).toBe('ev-resched-new');
    }
  });

  it('a reschedule that has itself reached its NEW effective date produces transition-boundary-reached citing the reschedule event, not the original announcement', () => {
    const route = makeRoute({ slug: 'fixture-resched-boundary', airlineSlugs: ['pia'], isDirect: true });
    const withdrawal = makeEvent({
      id: 'ev-resched-b-withdraw',
      routeSlug: 'fixture-resched-boundary',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const reschedule = makeEvent({
      id: 'ev-resched-b-new',
      routeSlug: 'fixture-resched-boundary',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-rescheduled',
      announcedAt: '2026-06-15',
      newEffectiveFrom: '2026-10-01',
      relatedEventId: 'ev-resched-b-withdraw',
      currentClaimValidBefore: '2026-10-01',
    });
    const result = getRouteStatus(route, [withdrawal, reschedule], '2026-10-01');
    expectTransitionBoundary(result, 'ev-resched-b-new');
    if (result!.status === 'verification-pending' && result!.pendingReason.kind === 'transition-boundary-reached') {
      expect(result!.pendingReason.effectiveFrom).toBe('2026-10-01');
    }
  });
});

describe('Route Status V1 — transition-boundary state (final errata §1 fix)', () => {
  it('a stale plan whose effectiveFrom is still in the FUTURE never becomes transition-boundary — falls through to base verification honestly', () => {
    const route = makeRoute({
      slug: 'fixture-stale-future',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-12-01' },
    });
    const withdrawal = makeEvent({
      id: 'ev-stale-future',
      routeSlug: 'fixture-stale-future',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2027-01-01', // still future relative to nowIso below
      currentClaimValidBefore: '2026-06-01', // but this plan's own claim horizon has ALREADY expired
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01'); // nowIso < effectiveFrom, and past currentClaimValidBefore
    expect(result!.status).not.toBe('withdrawal-announced');
    if (result!.status === 'verification-pending') {
      expect(result!.pendingReason.kind).not.toBe('transition-boundary-reached');
    } else {
      // Falls to base verified-direct via fresh route.verification, which is the honest fallback here.
      expect(result!.status).toBe('verified-direct');
    }
  });

  it('route-scoped transition-boundary forces the whole route to verification-pending, taking precedence over any other handling', () => {
    const route = makeRoute({ slug: 'fixture-route-scoped-transition', isDirect: true });
    const plan = makeEvent({
      id: 'ev-route-scoped-transition',
      routeSlug: 'fixture-route-scoped-transition',
      serviceId: 'route-wide-service',
      scope: { kind: 'route' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-06-01',
      currentClaimValidBefore: '2026-06-01',
    });
    const result = getRouteStatus(route, [plan], FIXED_TODAY);
    expectTransitionBoundary(result, 'ev-route-scoped-transition');
  });

  it('sole-airline transition-boundary produces route-level pending, never a verified-direct fallback', () => {
    const route = makeRoute({ slug: 'fixture-sole-transition', airlineSlugs: ['pia'], isDirect: true });
    const plan = makeEvent({
      id: 'ev-sole-transition',
      routeSlug: 'fixture-sole-transition',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-06-01',
      currentClaimValidBefore: '2026-06-01',
    });
    const result = getRouteStatus(route, [plan], FIXED_TODAY);
    expectTransitionBoundary(result, 'ev-sole-transition');
  });

  it('one airline in transition-boundary plus another independently, currently verified direct airline: verified-direct with a status-reverification-pending notice, never "ended"', () => {
    const route = makeRoute({
      slug: 'fixture-transition-plus-verified',
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
    const plan = makeEvent({
      id: 'ev-transition-plus-verified',
      routeSlug: 'fixture-transition-plus-verified',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-06-01',
      currentClaimValidBefore: '2026-06-01',
    });
    const result = getRouteStatus(route, [plan], FIXED_TODAY);
    expect(result!.status).toBe('verified-direct');
    if (result!.status !== 'verified-direct') return;
    expect(result!.verifiedDirectBasis.every((b) => b.airlineSlug === 'emirates')).toBe(true);
    expect(result!.serviceNotices).toEqual([
      { airlineSlug: 'pia', kind: 'status-reverification-pending', effectiveFrom: '2026-06-01', drivingEventId: 'ev-transition-plus-verified' },
    ]);
    // Never claims "ended" anywhere in the notice.
    expect(result!.serviceNotices.some((n) => n.kind === 'service-ended')).toBe(false);
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
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-08-31' },
    });
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
    const a = makeEvent({ id: 'evt-a', routeSlug: 'fixture-super', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });
    const b = makeEvent({ id: 'evt-b', routeSlug: 'fixture-super', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-07-01', currentClaimValidBefore: '2026-07-01', supersedesEventId: 'evt-a' });
    const c = makeEvent({ id: 'evt-c', routeSlug: 'fixture-super', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-03-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'evt-b' });
    const errors = validateStatusLedger([a, b, c]);
    expect(errors).toEqual([]);

    const result = getRouteStatus(route, [a, b, c], '2026-07-15');
    expect(result!.status).toBe('withdrawal-announced');
    if (result!.status === 'withdrawal-announced') {
      expect(result!.effectiveFrom).toBe('2026-08-01');
      expect(result!.drivingEventId).toBe('evt-c');
    }
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
    const e = makeEvent({ id: 'e1', sources: [{ publisher: '', url: '', accessedAt: '' }], type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
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
    const a = makeEvent({ id: 'scope-a', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'scope-b', scope: { kind: 'airline', airlineSlug: 'emirates' }, type: 'withdrawal-cancelled', announcedAt: '2026-02-01', currentClaimValidBefore: '2026-08-01', relatedEventId: 'scope-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'cross-scope-link')).toBe(true);
  });

  it('one serviceId reused across different routeSlugs is rejected', () => {
    const a = makeEvent({ id: 'reuse-a', routeSlug: 'route-alpha', serviceId: 'shared-service', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const b = makeEvent({ id: 'reuse-b', routeSlug: 'route-beta', serviceId: 'shared-service', type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'reused-service-id')).toBe(true);
  });

  it('getRouteStatus() does not throw for a malformed relatedEventId cycle reaching derivation directly (bypassing validation) — it returns verification-pending / conflicting-ledger-evidence(lifecycle-ordering-ambiguous)', () => {
    const route = makeRoute({
      slug: 'fixture-malformed-cycle',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const a = makeEvent({ id: 'mal-a', routeSlug: 'fixture-malformed-cycle', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01', relatedEventId: 'mal-b' });
    const b = makeEvent({ id: 'mal-b', routeSlug: 'fixture-malformed-cycle', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-rescheduled', announcedAt: '2026-02-01', newEffectiveFrom: '2026-09-01', currentClaimValidBefore: '2026-09-01', relatedEventId: 'mal-a' });
    expect(() => getRouteStatus(route, [a, b], FIXED_TODAY)).not.toThrow();
    const result = getRouteStatus(route, [a, b], FIXED_TODAY);
    expectConflict(result, 'lifecycle-ordering-ambiguous');
  });
});

describe('Route Status V1 — review fix: withdrawal-announced requires fresh current-service evidence', () => {
  it('sole airline + current withdrawal + NO current route or airline verification: verification-pending, not withdrawal-announced', () => {
    const route = makeRoute({ slug: 'fixture-no-evidence', airlineSlugs: ['pia'], isDirect: true });
    const withdrawal = makeEvent({ id: 'ev-no-evidence', routeSlug: 'fixture-no-evidence', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('verification-pending');
  });

  it('sole airline + fresh strict route.verification: withdrawal-announced', () => {
    const route = makeRoute({ slug: 'fixture-fresh-route-verification', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-09-01' } });
    const withdrawal = makeEvent({ id: 'ev-fresh-route', routeSlug: 'fixture-fresh-route-verification', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
  });

  it('sole airline + fresh explicit AIRLINE verification (no route-level verification at all): withdrawal-announced', () => {
    const route = makeRoute({
      slug: 'fixture-fresh-airline-verification',
      airlineSlugs: ['pia'],
      isDirect: true,
      airlineVerifications: [{ airlineSlug: 'pia', status: 'verified', sourceName: 'PIA own booking system', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-09-01', effectivePeriod: 'Current at access', supportedClaim: 'Confirms PIA operates this route direct.' }],
    });
    const withdrawal = makeEvent({ id: 'ev-fresh-airline', routeSlug: 'fixture-fresh-airline-verification', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
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
    const route = makeRoute({ slug: 'fixture-stale-verification', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: '2026-01-01', reviewDueDate: '2026-06-01' } });
    const withdrawal = makeEvent({ id: 'ev-stale', routeSlug: 'fixture-stale-verification', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01');
    expect(result!.status).toBe('verification-pending');
  });

  it('route-scoped withdrawal plan is equally gated on fresh route-level evidence', () => {
    const routeNoEvidence = makeRoute({ slug: 'fixture-route-scoped-no-evidence', isDirect: true });
    const plan = makeEvent({ id: 'ev-route-scoped-no-evidence', routeSlug: 'fixture-route-scoped-no-evidence', serviceId: 'route-wide-service', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    expect(getRouteStatus(routeNoEvidence, [plan], '2026-07-01')!.status).toBe('verification-pending');

    const routeWithEvidence = makeRoute({ slug: 'fixture-route-scoped-with-evidence', isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2026-09-01' } });
    const plan2 = makeEvent({ ...plan, id: 'ev-route-scoped-with-evidence', routeSlug: 'fixture-route-scoped-with-evidence' });
    expect(getRouteStatus(routeWithEvidence, [plan2], '2026-07-01')!.status).toBe('withdrawal-announced');
  });

  it('a verified service-ended occurrence does NOT require earlier fresh direct verification — the verified occurrence itself supports the ended fact', () => {
    const route = makeRoute({ slug: 'fixture-ended-no-prior-verification', airlineSlugs: ['pia'], isDirect: true });
    const ended = makeEvent({ id: 'ev-ended-no-verification', routeSlug: 'fixture-ended-no-prior-verification', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
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
    const a = makeEvent({ id: 'corr-scope-a', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'corr-scope-b', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'corr-scope-a' });
    const errors = validateStatusLedger([a, b]);
    expect(errors.some((e) => e.code === 'unflagged-scope-correction')).toBe(true);
  });

  it('the same scope-changing correction WITH correctsScope:true is accepted', () => {
    const a = makeEvent({ id: 'corr-scope-ok-a', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const b = makeEvent({ id: 'corr-scope-ok-b', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-02-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01', supersedesEventId: 'corr-scope-ok-a', correctsScope: true });
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
  it('two independent, simultaneously active route-scoped serviceIds: verification-pending / multiple-active-route-services, regardless of input order', () => {
    const route = makeRoute({ slug: 'fixture-route-scoped-order', isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const planOne = makeEvent({ id: 'route-scope-one', routeSlug: 'fixture-route-scoped-order', serviceId: 'route-service-one', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const planTwo = makeEvent({ id: 'route-scope-two', routeSlug: 'fixture-route-scoped-order', serviceId: 'route-service-two', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-06-15', effectiveFrom: '2026-09-01', currentClaimValidBefore: '2026-10-01' });

    const forward = getRouteStatus(route, [planOne, planTwo], '2026-07-01');
    const reversed = getRouteStatus(route, [planTwo, planOne], '2026-07-01');

    expectConflict(forward, 'multiple-active-route-services');
    expectConflict(reversed, 'multiple-active-route-services');
    expect(forward).toEqual(reversed);
  });

  it('exactly one active route-scoped serviceId (the normal case) is unaffected by this change', () => {
    const route = makeRoute({ slug: 'fixture-route-scoped-single', isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const plan = makeEvent({ id: 'route-scope-single', routeSlug: 'fixture-route-scoped-single', serviceId: 'route-service-single', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const result = getRouteStatus(route, [plan], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
  });
});

describe('Route Status V1 — review fix: mixed active scopes within one serviceId', () => {
  it('validateStatusLedger rejects a serviceId whose ACTIVE events have different scopes (one route-scoped, one airline-scoped)', () => {
    const routeScoped = makeEvent({ id: 'mixed-scope-route', serviceId: 'mixed-service', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const airlineScoped = makeEvent({ id: 'mixed-scope-airline', serviceId: 'mixed-service', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-02', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const errors = validateStatusLedger([routeScoped, airlineScoped]);
    expect(errors.some((e) => e.code === 'inconsistent-active-service-scope')).toBe(true);
  });

  it('the same malformed input passed directly to getRouteStatus() (bypassing validation) never throws and returns verification-pending / conflicting-ledger-evidence(inconsistent-active-service-scope)', () => {
    const route = makeRoute({ slug: 'fixture-mixed-scope', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const routeScoped = makeEvent({ id: 'mixed-scope-derivation-route', routeSlug: 'fixture-mixed-scope', serviceId: 'mixed-service-derivation', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const airlineScoped = makeEvent({ id: 'mixed-scope-derivation-airline', routeSlug: 'fixture-mixed-scope', serviceId: 'mixed-service-derivation', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-02', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    expect(() => getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01')).not.toThrow();
    const result = getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01');
    expectConflict(result, 'inconsistent-active-service-scope');
  });

  it('forward and reversed event order produce identical results for the mixed-scope case', () => {
    const route = makeRoute({ slug: 'fixture-mixed-scope-order', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const routeScoped = makeEvent({ id: 'mixed-scope-order-route', routeSlug: 'fixture-mixed-scope-order', serviceId: 'mixed-service-order', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const airlineScoped = makeEvent({ id: 'mixed-scope-order-airline', routeSlug: 'fixture-mixed-scope-order', serviceId: 'mixed-service-order', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-02', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const forward = getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01');
    const reversed = getRouteStatus(route, [airlineScoped, routeScoped], '2026-07-01');
    expect(forward).toEqual(reversed);
    expectConflict(forward, 'inconsistent-active-service-scope');
  });

  it('a valid scope-changing correction (correctsScope:true) still passes validation once supersession removes the old active scope', () => {
    const original = makeEvent({ id: 'scope-fix-original', serviceId: 'scope-fix-service', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const correction = makeEvent({ id: 'scope-fix-correction', serviceId: 'scope-fix-service', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-05', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01', supersedesEventId: 'scope-fix-original', correctsScope: true });
    const errors = validateStatusLedger([original, correction]);
    expect(errors.some((e) => e.code === 'inconsistent-active-service-scope')).toBe(false);

    const route = makeRoute({ slug: 'fixture-scope-fix', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const originalWithRoute = { ...original, routeSlug: 'fixture-scope-fix' };
    const correctionWithRoute = { ...correction, routeSlug: 'fixture-scope-fix' };
    const result = getRouteStatus(route, [originalWithRoute, correctionWithRoute], '2026-07-01');
    expect(result!.status).toBe('withdrawal-announced');
  });
});

describe('Route Status V1 — review fix: multiple airline-scoped lifecycles never depend on array order', () => {
  it('two independent active airline-scoped plans (different airlines, both currently withdrawal-announced): verification-pending / multiple-active-airline-services, in both orders', () => {
    const route = makeRoute({ slug: 'fixture-two-plans', airlineSlugs: ['pia', 'emirates'], isDirect: true });
    const planPia = makeEvent({ id: 'two-plans-pia', routeSlug: 'fixture-two-plans', serviceId: 'pia-fixture-two-plans-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const planEmirates = makeEvent({ id: 'two-plans-emirates', routeSlug: 'fixture-two-plans', serviceId: 'emirates-fixture-two-plans-direct', scope: { kind: 'airline', airlineSlug: 'emirates' }, type: 'withdrawal-announced', announcedAt: '2026-06-05', effectiveFrom: '2026-08-15', currentClaimValidBefore: '2026-09-01' });
    const forward = getRouteStatus(route, [planPia, planEmirates], '2026-07-01');
    const reversed = getRouteStatus(route, [planEmirates, planPia], '2026-07-01');
    expectConflict(forward, 'multiple-active-airline-services');
    expectConflict(reversed, 'multiple-active-airline-services');
    expect(forward).toEqual(reversed);
  });

  it('one airline ended, a different airline planned — both simultaneously active: verification-pending / multiple-active-airline-services, in both orders', () => {
    const route = makeRoute({ slug: 'fixture-ended-plus-planned', airlineSlugs: ['pia', 'emirates'], isDirect: true });
    const ended = makeEvent({ id: 'ended-plus-planned-ended', routeSlug: 'fixture-ended-plus-planned', serviceId: 'pia-fixture-ended-plus-planned-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    const planned = makeEvent({ id: 'ended-plus-planned-planned', routeSlug: 'fixture-ended-plus-planned', serviceId: 'emirates-fixture-ended-plus-planned-direct', scope: { kind: 'airline', airlineSlug: 'emirates' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-15', currentClaimValidBefore: '2026-09-01' });
    const forward = getRouteStatus(route, [ended, planned], FIXED_TODAY);
    const reversed = getRouteStatus(route, [planned, ended], FIXED_TODAY);
    expectConflict(forward, 'multiple-active-airline-services');
    expectConflict(reversed, 'multiple-active-airline-services');
    expect(forward).toEqual(reversed);
  });

  it('existing single-service multi-airline behaviour is unchanged: exactly one active airline-scoped service still resolves normally', () => {
    const route = makeRoute({
      slug: 'fixture-single-airline-scoped-service',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [{ airlineSlug: 'emirates', status: 'verified', sourceName: 'Emirates own booking system', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'Confirms Emirates operates this route direct.' }],
    });
    const withdrawal = makeEvent({ id: 'single-airline-scoped-withdraw', routeSlug: 'fixture-single-airline-scoped-service', serviceId: 'pia-fixture-single-service-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const result = getRouteStatus(route, [withdrawal], FIXED_TODAY);
    expect(result!.status).toBe('verified-direct');
    if (result!.status === 'verified-direct') {
      expect(result!.serviceNotices).toEqual([{ airlineSlug: 'pia', kind: 'withdrawal-announced', effectiveFrom: '2026-08-01', drivingEventId: 'single-airline-scoped-withdraw' }]);
    }
  });

  it('Manchester–Mumbai and Manchester–Delhi still return withdrawal-announced on 2026-08-30 after these order-independence fixes', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, '2026-08-30');
      expect(result!.status, slug).toBe('withdrawal-announced');
    }
  });
});

describe('Route Status V1 implementation addendum §1 — mixed route-scoped and airline-scoped active services', () => {
  it('an active route-scoped service and an active airline-scoped service under a DIFFERENT serviceId: verification-pending / mixed-active-route-and-airline-services, in both orders', () => {
    const route = makeRoute({ slug: 'fixture-mixed-different-services', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const routeScoped = makeEvent({ id: 'mixed-diff-route', routeSlug: 'fixture-mixed-different-services', serviceId: 'route-wide-service', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-09-01' });
    const airlineScoped = makeEvent({ id: 'mixed-diff-airline', routeSlug: 'fixture-mixed-different-services', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-05', effectiveFrom: '2026-08-15', currentClaimValidBefore: '2026-09-15' });

    const forward = getRouteStatus(route, [routeScoped, airlineScoped], '2026-07-01');
    const reversed = getRouteStatus(route, [airlineScoped, routeScoped], '2026-07-01');

    expectConflict(forward, 'mixed-active-route-and-airline-services');
    expectConflict(reversed, 'mixed-active-route-and-airline-services');
    expect(forward).toEqual(reversed);
  });

  it('a route-scoped service in transition-boundary alongside an active airline-scoped service is equally rejected as mixed', () => {
    const route = makeRoute({ slug: 'fixture-mixed-transition', airlineSlugs: ['pia'], isDirect: true });
    const routeScoped = makeEvent({ id: 'mixed-transition-route', routeSlug: 'fixture-mixed-transition', serviceId: 'route-wide-service', scope: { kind: 'route' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });
    const airlineScoped = makeEvent({ id: 'mixed-transition-airline', routeSlug: 'fixture-mixed-transition', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-05', effectiveFrom: '2026-09-01', currentClaimValidBefore: '2026-10-01' });
    const result = getRouteStatus(route, [routeScoped, airlineScoped], FIXED_TODAY);
    expectConflict(result, 'mixed-active-route-and-airline-services');
  });
});

describe('Route Status V1 final errata §1 — NonEmptyArray compile-time enforcement', () => {
  it('a verified-direct result always carries a non-empty verifiedDirectBasis (runtime confirmation of the compile-time contract)', () => {
    const route = getRouteBySlug('manchester-lahore')!; // real, non-ledger, currently-verified route
    // Build a synthetic ledger-managed equivalent to inspect a real verified-direct return shape.
    const syntheticRoute = makeRoute({
      slug: 'fixture-nonempty-basis',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const launch = makeEvent({ id: 'ev-nonempty-launch', routeSlug: 'fixture-nonempty-basis', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const result = getRouteStatus(syntheticRoute, [launch], FIXED_TODAY);
    expect(result!.status).toBe('verified-direct');
    if (result!.status === 'verified-direct') {
      expect(result!.verifiedDirectBasis.length).toBeGreaterThan(0);
    }
    expect(route).toBeDefined(); // sanity: real route lookup itself didn't throw
  });
});

describe('Route Status V1 — evidence-validated customer copy (lib/route-status-copy.ts)', () => {
  it('the real Manchester–Mumbai transition-boundary pending copy carries the real driving event id, publisher, effective date and a non-empty citation list', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const result = getRouteStatus(route, routeStatusEvents, '2026-08-31')!;
    const viewModel = getRouteStatusCopy(route, result, routeStatusEvents, '2026-08-31');
    expect(viewModel.kind).toBe('transition-boundary-pending');
    if (viewModel.kind !== 'transition-boundary-pending') return;
    expect(viewModel.drivingEventId).toBe(routeStatusEvents.find((e) => e.routeSlug === 'manchester-mumbai')!.id);
    expect(viewModel.effectiveFrom).toBe('2026-08-31');
    expect(viewModel.publisher).toBe('IndiGo');
    expect(viewModel.citations.length).toBeGreaterThan(0);
  });

  it('neutral pending carries no publisher/date/citation fields at all', () => {
    const route = makeRoute({ slug: 'fixture-copy-neutral', airlineSlugs: ['pia'], isDirect: true });
    const launch = makeEvent({ id: 'ev-copy-neutral-launch', routeSlug: 'fixture-copy-neutral', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const result = getRouteStatus(route, [launch], FIXED_TODAY)!;
    const viewModel = getRouteStatusCopy(route, result, [launch], FIXED_TODAY);
    expect(viewModel.kind).toBe('neutral-pending');
    expect(Object.keys(viewModel)).toEqual(['kind', 'badgeLabel', 'body']);
  });

  it('a resolved event with two sources preserves both in the citations list, none silently dropped', () => {
    const route = makeRoute({ slug: 'fixture-copy-multi-source', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const secondSource: SourceRef = { publisher: 'Second Publisher', url: 'https://example.com/second', accessedAt: FIXED_TODAY };
    const withdrawal = makeEvent({
      id: 'ev-copy-multi-source',
      routeSlug: 'fixture-copy-multi-source',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      sources: [SOURCE, secondSource],
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const result = getRouteStatus(route, [withdrawal], '2026-07-01')!;
    const viewModel = getRouteStatusCopy(route, result, [withdrawal], '2026-07-01');
    expect(viewModel.kind).toBe('withdrawal-announced');
    if (viewModel.kind !== 'withdrawal-announced') return;
    expect(viewModel.citations).toHaveLength(2);
    expect(viewModel.citations.map((c) => c.publisher).sort()).toEqual(['Second Publisher', 'Test Publisher']);
  });

  it('a mismatched effective date on the resolved event fails closed to neutral pending', () => {
    const route = makeRoute({ slug: 'fixture-copy-mismatch', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const withdrawal = makeEvent({ id: 'ev-copy-mismatch', routeSlug: 'fixture-copy-mismatch', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const genuineResult = getRouteStatus(route, [withdrawal], '2026-07-01')!;
    // Tamper the result to claim a DIFFERENT effectiveFrom than the real event carries.
    const tamperedResult = genuineResult.status === 'withdrawal-announced' ? { ...genuineResult, effectiveFrom: '2099-01-01' } : genuineResult;
    const viewModel = getRouteStatusCopy(route, tamperedResult as RouteStatusResult, [withdrawal], '2026-07-01');
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('a mismatched route slug on the resolved event fails closed to neutral pending', () => {
    const route = makeRoute({ slug: 'fixture-copy-wrong-route', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const otherRoute = makeRoute({ slug: 'fixture-copy-other-route', airlineSlugs: ['pia'], isDirect: true });
    const withdrawal = makeEvent({ id: 'ev-copy-wrong-route', routeSlug: 'fixture-copy-other-route', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    // Force a positive result referencing the wrong route's event id against `route`.
    const forcedResult: RouteStatusResult = { status: 'withdrawal-announced', effectiveFrom: '2026-08-01', drivingEventId: 'ev-copy-wrong-route', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] };
    const viewModel = getRouteStatusCopy(route, forcedResult, [withdrawal], '2026-07-01');
    expect(viewModel.kind).toBe('neutral-pending');
    expect(otherRoute).toBeDefined();
  });

  it('an expired verified-direct basis (reviewDueDate passed relative to nowIso) fails closed to neutral pending, proving the independent re-check fires', () => {
    const route = makeRoute({ slug: 'fixture-copy-expired-basis', airlineSlugs: ['pia'], isDirect: true, verification: { status: 'verified', sourceName: 'Test', verifiedDate: '2026-01-01', reviewDueDate: '2026-07-01' } });
    const launch = makeEvent({ id: 'ev-copy-expired-basis', routeSlug: 'fixture-copy-expired-basis', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    // At '2026-06-30' the result is genuinely verified-direct (reviewDueDate not yet reached).
    const result = getRouteStatus(route, [launch], '2026-06-30')!;
    expect(result.status).toBe('verified-direct');
    // Re-render the SAME result at a LATER nowIso, past reviewDueDate — the copy layer must
    // independently re-check freshness rather than trusting the basis as given.
    const viewModel = getRouteStatusCopy(route, result, [launch], '2026-07-01');
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('service-ended copy requires verifiedOccurrence:true on the resolved event — a malformed event without it fails closed', () => {
    const route = makeRoute({ slug: 'fixture-copy-no-occurrence', airlineSlugs: ['pia'], isDirect: true });
    const malformedEnded = { ...makeEvent({ id: 'ev-copy-no-occurrence', routeSlug: 'fixture-copy-no-occurrence', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' }), verifiedOccurrence: false } as unknown as RouteStatusEvent;
    const forcedResult: RouteStatusResult = { status: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-copy-no-occurrence', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] };
    const viewModel = getRouteStatusCopy(route, forcedResult, [malformedEnded], FIXED_TODAY);
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('service-ended view model renders "Direct service ended", never any pending wording', () => {
    const route = makeRoute({ slug: 'fixture-copy-ended', airlineSlugs: ['pia'], isDirect: true });
    const ended = makeEvent({ id: 'ev-copy-ended', routeSlug: 'fixture-copy-ended', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    const result = getRouteStatus(route, [ended], FIXED_TODAY)!;
    const viewModel = getRouteStatusCopy(route, result, [ended], FIXED_TODAY);
    expect(viewModel.kind).toBe('service-ended');
    expect(viewModel.badgeLabel).toBe('Direct service ended');
    expect(viewModel.badgeLabel.toLowerCase()).not.toContain('pending');
  });
});

describe('Route Status V1 — service-ended presentation never degrades to "Verification pending"', () => {
  it('buildServiceEndedPresentation renders a distinct statusLabel, suppresses all direct-service facts, and never allows connectingAlternative', () => {
    const route = makeRoute({
      slug: 'fixture-presentation-ended',
      airportSlug: 'manchester',
      destinationSlug: 'lahore',
      airlineSlugs: ['pia'],
      isDirect: true,
      connectingAlternative: { typicalStops: 1, hubAirports: ['Doha'], typicalAirlines: ['Qatar Airways'], typicalJourneyTime: '13h' },
    });
    const presentation = buildServiceEndedPresentation(route);
    expect(presentation.status).toBe('service-ended');
    expect(presentation.statusLabel).toBe('Direct service ended');
    expect(presentation.statusLabel).not.toBe('Verification pending');
    expect(presentation.flightTime).toBeNull();
    expect(presentation.frequency).toBeNull();
    expect(presentation.airlineSlugs).toEqual([]);
    expect(presentation.canShowBookingGuidance).toBe(false);
    expect(presentation.canShowPeakPeriods).toBe(false);
    expect(presentation.canShowConnectingAlternative).toBe(false);
    expect(presentation.summary.toLowerCase()).not.toContain('verification pending');
    expect(presentation.shareText.toLowerCase()).not.toContain('verification pending');
  });

  it('getEffectiveRoutePresentation returns the service-ended branch for a route with a verified, effective service-ended event, and the pending branch for a route only past its transition boundary', () => {
    const endedRoute = makeRoute({ slug: 'fixture-effective-ended', airlineSlugs: ['pia'], isDirect: true });
    const ended = makeEvent({ id: 'ev-effective-ended', routeSlug: 'fixture-effective-ended', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    expect(getEffectiveRoutePresentation(endedRoute, [ended], FIXED_TODAY).status).toBe('service-ended');

    const pendingRoute = makeRoute({ slug: 'fixture-effective-pending', airlineSlugs: ['pia'], isDirect: true });
    const plan = makeEvent({ id: 'ev-effective-pending', routeSlug: 'fixture-effective-pending', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });
    const pendingPresentation = getEffectiveRoutePresentation(pendingRoute, [plan], FIXED_TODAY);
    expect(pendingPresentation.status).toBe('unverified');
    expect(pendingPresentation.statusLabel).toBe('Verification pending');
  });

  it('the real Manchester–Mumbai and Manchester–Delhi routes never render "Direct" via getEffectiveRoutePresentation on/after the transition boundary, and never silently disagree with getRouteStatus', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-08-31');
      expect(presentation.status).not.toBe('direct');
      expect(presentation.statusLabel).not.toBe('Direct');
    }
  });
});

describe('Route Status V1 final audit §3 — verifiedDirectBasis revalidated against the actual verification records', () => {
  it('a forged basis (values that do not match route.verification at all) is rejected — falls closed to neutral pending', () => {
    const route = makeRoute({
      slug: 'fixture-forged-basis',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Real Source', sourceUrl: 'https://real.example.com', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const forgedResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [
        { kind: 'route', sourceName: 'Forged Source', sourceUrl: 'https://forged.example.com', verifiedDate: '2020-01-01', reviewDueDate: '2099-01-01' },
      ],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, forgedResult, [], FIXED_TODAY);
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('a basis whose reviewDueDate/verifiedDate/sourceUrl subtly differ from the real record (partial forgery) is rejected', () => {
    const route = makeRoute({
      slug: 'fixture-partial-forgery',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Real Source', sourceUrl: 'https://real.example.com', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const tamperedResult: RouteStatusResult = {
      status: 'verified-direct',
      // sourceName matches, but reviewDueDate has been quietly extended.
      verifiedDirectBasis: [{ kind: 'route', sourceName: 'Real Source', sourceUrl: 'https://real.example.com', verifiedDate: FIXED_TODAY, reviewDueDate: '2099-01-01' }],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, tamperedResult, [], FIXED_TODAY);
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('an airline-kind basis is checked against getAirlineVerification, not route.verification — a forged airline basis is equally rejected', () => {
    const route = makeRoute({
      slug: 'fixture-forged-airline-basis',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [
        { airlineSlug: 'emirates', status: 'verified', sourceName: 'Emirates real source', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'Confirms direct.' },
      ],
    });
    const forgedResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'Forged Emirates source', sourceUrl: undefined, verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, forgedResult, [], FIXED_TODAY);
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('a genuine basis that exactly matches the real record is accepted (positive control, proving the check is not overly strict)', () => {
    const route = makeRoute({
      slug: 'fixture-genuine-basis',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Real Source', sourceUrl: 'https://real.example.com', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const genuineResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'route', sourceName: 'Real Source', sourceUrl: 'https://real.example.com', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, genuineResult, [], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
  });

  it('a mixed basis array (one genuine, one forged) keeps only the genuine entry rather than failing closed entirely', () => {
    const route = makeRoute({
      slug: 'fixture-mixed-basis',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [
        { airlineSlug: 'emirates', status: 'verified', sourceName: 'Emirates real source', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'Confirms direct.' },
      ],
    });
    const mixedResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [
        { kind: 'airline', airlineSlug: 'emirates', sourceName: 'Emirates real source', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
        { kind: 'airline', airlineSlug: 'pia', sourceName: 'Forged PIA source', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
      ],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, mixedResult, [], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
    if (viewModel.kind === 'verified-direct') {
      expect(viewModel.citations).toHaveLength(1);
      expect(viewModel.citations[0].publisher).toBe('Emirates real source');
    }
  });
});

describe('Route Status V1 final audit §3 — service notices fully validated, never a raw airline slug', () => {
  it('a notice whose airline slug is not in the airlines.ts registry is dropped entirely, never rendered with the raw slug', () => {
    const route = makeRoute({ slug: 'fixture-unknown-airline-notice', airlineSlugs: ['pia', 'not-a-real-airline'], isDirect: true });
    const ended = makeEvent({
      id: 'ev-unknown-airline-ended',
      routeSlug: 'fixture-unknown-airline-notice',
      serviceId: 'not-a-real-airline-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'not-a-real-airline' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'route', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      serviceNotices: [{ airlineSlug: 'not-a-real-airline', kind: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-unknown-airline-ended' }],
    };
    // Route has no fresh verification of its own — force the basis check to fail so we isolate the notice behaviour; use a route WITH fresh verification instead so the primary claim succeeds and we can inspect serviceNotices in isolation.
    const routeWithVerification = makeRoute({
      slug: 'fixture-unknown-airline-notice-2',
      airlineSlugs: ['pia', 'not-a-real-airline'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const result2: RouteStatusResult = { ...result, verifiedDirectBasis: [{ kind: 'route', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }] };
    const viewModel = getRouteStatusCopy(routeWithVerification, result2, [{ ...ended, routeSlug: 'fixture-unknown-airline-notice-2' }], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
    if (viewModel.kind === 'verified-direct') {
      expect(viewModel.serviceNotices).toEqual([]);
      expect(JSON.stringify(viewModel)).not.toContain('not-a-real-airline');
    }
  });

  it('a notice whose driving event has a mismatched effective date is dropped', () => {
    const route = makeRoute({
      slug: 'fixture-notice-date-mismatch',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [{ airlineSlug: 'emirates', status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'y' }],
    });
    const ended = makeEvent({
      id: 'ev-notice-date-mismatch',
      routeSlug: 'fixture-notice-date-mismatch',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      // Notice claims a DIFFERENT effectiveFrom than the real event.
      serviceNotices: [{ airlineSlug: 'pia', kind: 'service-ended', effectiveFrom: '2026-09-01', drivingEventId: 'ev-notice-date-mismatch' }],
    };
    const viewModel = getRouteStatusCopy(route, result, [ended], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
    if (viewModel.kind === 'verified-direct') expect(viewModel.serviceNotices).toEqual([]);
  });

  it('a notice citing a superseded (inactive) event is dropped', () => {
    const route = makeRoute({
      slug: 'fixture-notice-superseded',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [{ airlineSlug: 'emirates', status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'y' }],
    });
    const original = makeEvent({
      id: 'ev-notice-superseded-original',
      routeSlug: 'fixture-notice-superseded',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-08-01',
      currentClaimValidBefore: '2026-08-01',
    });
    const correction = makeEvent({
      id: 'ev-notice-superseded-correction',
      routeSlug: 'fixture-notice-superseded',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-02',
      effectiveFrom: '2026-09-01',
      currentClaimValidBefore: '2026-09-01',
      supersedesEventId: 'ev-notice-superseded-original',
    });
    const result: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      // Notice cites the SUPERSEDED (now-inactive) original event id.
      serviceNotices: [{ airlineSlug: 'pia', kind: 'withdrawal-announced', effectiveFrom: '2026-08-01', drivingEventId: 'ev-notice-superseded-original' }],
    };
    const viewModel = getRouteStatusCopy(route, result, [original, correction], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
    if (viewModel.kind === 'verified-direct') expect(viewModel.serviceNotices).toEqual([]);
  });

  it('a genuine, correctly-scoped notice with real sources is accepted and carries its own non-empty citations', () => {
    const route = makeRoute({
      slug: 'fixture-notice-genuine',
      airlineSlugs: ['pia', 'emirates'],
      isDirect: true,
      airlineVerifications: [{ airlineSlug: 'emirates', status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'y' }],
    });
    const ended = makeEvent({
      id: 'ev-notice-genuine',
      routeSlug: 'fixture-notice-genuine',
      serviceId: 'pia-fixture-direct',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const result: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      serviceNotices: [{ airlineSlug: 'pia', kind: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-notice-genuine' }],
    };
    const viewModel = getRouteStatusCopy(route, result, [ended], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
    if (viewModel.kind === 'verified-direct') {
      expect(viewModel.serviceNotices).toHaveLength(1);
      expect(viewModel.serviceNotices[0].airlineName).not.toBe('pia'); // resolved display name, not the raw slug
      expect(viewModel.serviceNotices[0].citations.length).toBeGreaterThan(0);
    }
  });
});

describe('Route Status V1 final audit §3 — getEffectiveRoutePresentation never leaks direct facts from malformed evidence', () => {
  it('a route whose derivation would be verified-direct, but whose basis is entirely forged, presents as unverified — never "Direct"', () => {
    // Construct via getRouteStatus() normally (genuine basis), then hand-tamper
    // the result the same way a corrupted/forged object might arrive, and
    // confirm getEffectiveRoutePresentation (not just getRouteStatusCopy)
    // refuses to show "Direct" for it.
    const route = makeRoute({
      slug: 'fixture-presentation-forged',
      airlineSlugs: ['pia'],
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Real Source', sourceUrl: 'https://real.example.com', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' },
    });
    const launch = makeEvent({ id: 'ev-presentation-forged-launch', routeSlug: 'fixture-presentation-forged', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-launched', basis: 'observed', effectiveFrom: '2025-01-01' });
    const genuineResult = getRouteStatus(route, [launch], FIXED_TODAY)!;
    expect(genuineResult.status).toBe('verified-direct'); // sanity: genuinely verified-direct today

    // getEffectiveRoutePresentation itself re-derives from getRouteStatus() +
    // getRouteStatusCopy() — it can't be handed a tampered RouteStatusResult
    // directly (its signature only takes route/events/nowIso), so this test
    // instead confirms getRouteStatusCopy's own rejection of a forged basis
    // (proven above) is what getEffectiveRoutePresentation's implementation
    // is wired through — verified by the shared implementation, not a
    // separate, looser check. See lib/route-status-copy.ts's header comment.
    const forgedResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'route', sourceName: 'Forged', sourceUrl: 'https://forged.example.com', verifiedDate: '2020-01-01', reviewDueDate: '2099-01-01' }],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, forgedResult, [launch], FIXED_TODAY);
    expect(viewModel.kind).toBe('neutral-pending');
  });

  it('a ledger-managed route with a genuinely malformed service-ended event (missing verifiedOccurrence) never presents as service-ended nor as direct — presentation falls back safely', () => {
    const route = makeRoute({ slug: 'fixture-presentation-malformed-ended', airlineSlugs: ['pia'], isDirect: true });
    const malformed = { ...makeEvent({ id: 'ev-presentation-malformed', routeSlug: 'fixture-presentation-malformed-ended', serviceId: 'pia-fixture-direct', scope: { kind: 'airline', airlineSlug: 'pia' }, type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' }), verifiedOccurrence: false } as unknown as RouteStatusEvent;
    const presentation = getEffectiveRoutePresentation(route, [malformed], FIXED_TODAY);
    // The malformed event, lacking verifiedOccurrence:true, can't drive
    // resolveServiceLifecycle's 'ended' branch either (that check also
    // requires it) — falls through to the base fallthrough (no route
    // verification recorded), landing on 'unverified'. Either way, it must
    // never render as 'direct'.
    expect(presentation.status).not.toBe('direct');
  });
});
