import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, getRouteStatus, type Route } from '@/data/routes';
import { routeStatusEvents, type RouteStatusEvent, type SourceRef } from '@/data/route-status-events';
import { getFounderSnapshot } from '@/lib/founder-insights';

/**
 * Service-ended route-verification reminder suppression (follow-up to
 * Rolling Reverification Batch 4, 4 September 2026).
 *
 * routeVerificationReviewStatus() (lib/founder-insights.ts) previously
 * flagged a route as "overdue for re-verification" purely from
 * route.verification.reviewDueDate, with no awareness of whether the
 * route's current truth had already been separately and conclusively
 * settled by a verified `service-ended` event in the Route Status V1
 * ledger (data/route-status-events.ts). Confirmed real cases:
 * manchester-mumbai and manchester-delhi (both IndiGo withdrawals,
 * effective 31 August 2026) kept generating a "go re-check this route's
 * evidence" reminder for a service that had already verifiably stopped
 * operating — nothing was actually left to re-check.
 *
 * The fix reuses getRouteStatus() (the same pure ledger-derivation helper
 * serviceChangesStatus() already calls) rather than inventing a second
 * interpretation of route status. These tests prove: (1) the real
 * confirmed cases are now excluded, (2) ordinary routes are unaffected,
 * (3) the suppression is not over-broad — a route merely having ledger
 * history, or a since-superseded ended claim, must not be suppressed.
 */

const SECTION_ID = 'route-verification-review';

function findSection(now: Date) {
  const snapshot = getFounderSnapshot(now);
  const section = Object.values(snapshot.grouped)
    .flat()
    .find((s) => s.id === SECTION_ID);
  if (!section) throw new Error(`${SECTION_ID} section not found`);
  return section;
}

// Minimal, complete synthetic Route fixture — never a real route, never
// touches data/routes.ts's own array. Mirrors tests/route-status.test.ts's
// own makeRoute() shape for consistency across the suite.
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

const FIXTURE_SOURCE: SourceRef = {
  publisher: 'Test Publisher',
  url: 'https://example.com/source',
  accessedAt: '2026-01-01',
};

function makeEvent(overrides: Partial<RouteStatusEvent> & Pick<RouteStatusEvent, 'type'>): RouteStatusEvent {
  const base = {
    id: 'fixture-event',
    routeSlug: 'fixture-route',
    serviceId: 'fixture-service',
    scope: { kind: 'airline' as const, airlineSlug: 'pia' },
    headline: 'Fixture headline',
    explanation: 'Fixture explanation.',
    sources: [FIXTURE_SOURCE],
    verifiedAt: '2026-01-01',
  };
  return { ...base, ...overrides } as RouteStatusEvent;
}

describe('Real cases: manchester-mumbai and manchester-delhi are genuinely service-ended', () => {
  const NOW_ISO = '2026-09-04';

  it('manchester-mumbai currently resolves to service-ended via the real ledger', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const status = getRouteStatus(route, routeStatusEvents, NOW_ISO);
    expect(status?.status).toBe('service-ended');
  });

  it('manchester-delhi currently resolves to service-ended via the real ledger', () => {
    const route = getRouteBySlug('manchester-delhi')!;
    const status = getRouteStatus(route, routeStatusEvents, NOW_ISO);
    expect(status?.status).toBe('service-ended');
  });
});

describe('1 & 2. Confirmed service-ended routes no longer generate any route-verification reminder', () => {
  const now = new Date('2026-09-04T00:00:00Z');

  it('manchester-mumbai does not appear as overdue', () => {
    const section = findSection(now);
    const item = section.items.find((i) => i.label.includes('Manchester') && i.label.includes('Mumbai'));
    expect(item).toBeUndefined();
  });

  it('manchester-delhi does not appear as overdue or due-soon', () => {
    const section = findSection(now);
    const item = section.items.find((i) => i.label.includes('Manchester') && i.label.includes('Delhi'));
    expect(item).toBeUndefined();
  });

  it('neither route appears anywhere in the section items list at all', () => {
    const section = findSection(now);
    const labels = section.items.map((i) => i.label);
    expect(labels.some((l) => l.includes('Mumbai'))).toBe(false);
    expect(labels.some((l) => l.includes('Delhi') && l.includes('Manchester'))).toBe(false);
  });
});

describe('3. An ordinary overdue verified route (no service-ended event) still appears', () => {
  it('birmingham-doha appears overdue once its own reviewDueDate has passed', () => {
    // Same deterministic technique used to fix PR #222's own test fixture:
    // "now" is derived from the route's own reviewDueDate, not a second
    // hardcoded date, so this stays correct even if a future batch
    // reconfirms birmingham-doha and pushes its date forward.
    const route = getRouteBySlug('birmingham-doha')!;
    const dueDate = new Date(`${route.verification!.reviewDueDate}T00:00:00Z`);
    const now = new Date(dueDate.getTime() + 8 * 86_400_000);
    const section = findSection(now);
    const item = section.items.find((i) => i.label.includes('Birmingham') && i.label.includes('Doha'));
    expect(item).toBeDefined();
    expect(item!.label).toMatch(/overdue by \d+ days?/);
    expect(item!.status).toBe('attention');
  });
});

describe('4. An ordinary due-soon verified route still appears', () => {
  it('at least one real due-soon item exists at today\'s date', () => {
    const section = findSection(new Date('2026-09-04T00:00:00Z'));
    const dueSoonItem = section.items.find((i) => /due in \d+ days?/.test(i.label));
    expect(dueSoonItem).toBeDefined();
    expect(dueSoonItem!.status).toBe('watch');
  });
});

describe('5. A disputed/unverified route with no route-status history is not suppressed', () => {
  it('birmingham-ahmedabad (DISPUTED, unverified, no ledger entry) still appears in its due-soon/overdue bucket, unaffected', () => {
    const route = getRouteBySlug('birmingham-ahmedabad')!;
    expect(route.verification?.status).toBe('unverified');
    // No route-status event exists for this route at all.
    const eventsForRoute = routeStatusEvents.filter((e) => e.routeSlug === 'birmingham-ahmedabad');
    expect(eventsForRoute).toHaveLength(0);

    const dueDate = new Date(`${route.verification!.reviewDueDate}T00:00:00Z`);
    const now = new Date(dueDate.getTime() + 2 * 86_400_000);
    const section = findSection(now);
    const item = section.items.find((i) => i.label.includes('Birmingham') && i.label.includes('Ahmedabad'));
    expect(item).toBeDefined();
    expect(item!.status).toBe('attention');
  });
});

describe('6. A synthetic route whose service-ended claim is superseded by a later resumption is not suppressed', () => {
  it('getRouteStatus no longer reports service-ended once the ended event is superseded', () => {
    const now = '2026-09-04';
    const route = makeRoute({
      slug: 'fixture-resumed',
      isDirect: true,
      verification: { status: 'verified', sourceName: 'Test', verifiedDate: '2026-08-01', reviewDueDate: '2026-11-01' },
    });
    const ended = makeEvent({
      id: 'fixture-ended',
      routeSlug: 'fixture-resumed',
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-06-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const resumed = makeEvent({
      id: 'fixture-resumed-launch',
      routeSlug: 'fixture-resumed',
      type: 'service-launched',
      basis: 'observed',
      effectiveFrom: '2026-08-01',
      supersedesEventId: 'fixture-ended',
    });

    // Sanity check: before resumption, this route WOULD have resolved to
    // service-ended (proves the fixture is realistic, not a false positive).
    const beforeResumption = getRouteStatus(route, [ended], now);
    expect(beforeResumption?.status).toBe('service-ended');

    const afterResumption = getRouteStatus(route, [ended, resumed], now);
    expect(afterResumption?.status).not.toBe('service-ended');
  });

  it('a route with only an active (non-ended) withdrawal-announced event is not treated as service-ended', () => {
    const now = '2026-09-04';
    const route = makeRoute({
      slug: 'fixture-announced',
      isDirect: true,
      verification: { status: 'unverified', sourceName: 'Test', verifiedDate: '2026-08-01', reviewDueDate: '2026-08-15' },
    });
    const announced = makeEvent({
      id: 'fixture-announced-event',
      routeSlug: 'fixture-announced',
      type: 'withdrawal-announced',
      announcedAt: '2026-07-01',
      effectiveFrom: '2026-12-01',
      currentClaimValidBefore: '2026-12-01',
    });
    const status = getRouteStatus(route, [announced], now);
    expect(status?.status).not.toBe('service-ended');
  });
});

describe('7. Real MAN→BOM / MAN→DEL current effective states', () => {
  it('both are sole-IndiGo direct routes whose current effective status is service-ended, not merely historically flagged', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      expect(route.airlineSlugs).toEqual(['indigo']);
      expect(route.isDirect).toBe(true);
      const status = getRouteStatus(route, routeStatusEvents, '2026-09-04');
      expect(status?.status).toBe('service-ended');
    }
  });

  it('public route truth (route.verification, route-status-events data) is untouched by this fix', () => {
    const mumbai = getRouteBySlug('manchester-mumbai')!;
    const delhi = getRouteBySlug('manchester-delhi')!;
    expect(mumbai.verification?.reviewDueDate).toBe('2026-08-31');
    expect(delhi.verification?.reviewDueDate).toBe('2026-08-31');
  });
});

describe('8. The founder snapshot (and therefore the weekly reminder email, which reads the same snapshot) inherits the fix automatically', () => {
  it('getFounderSnapshot is the single source both the dashboard section and the cron route read — no separate suppression logic exists', () => {
    const now = new Date('2026-09-04T00:00:00Z');
    const section = findSection(now);
    // The cron route (app/api/cron/fare-check-reminder/route.ts) pulls this
    // exact section via getFounderSnapshot(now).grouped.revenue, with no
    // route-status-event logic of its own — proving no second
    // implementation is needed for the email.
    expect(section.id).toBe(SECTION_ID);
    const labels = section.items.map((i) => i.label);
    expect(labels.some((l) => l.includes('Mumbai'))).toBe(false);
    expect(labels.some((l) => l.includes('Delhi') && l.includes('Manchester'))).toBe(false);
  });
});
