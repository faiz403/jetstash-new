import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, type Route } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents, type RouteStatusEvent, type SourceRef } from '@/data/route-status-events';
import { getDealDirectnessLabel, getDealAirlineLabel } from '@/data/deals';
import { isObservationPublishable } from '@/data/fare-observations';
import { BOOK_BY_PRIORITY_ROUTE_SLUGS, computeBookBySnapshot } from '@/lib/booking-intelligence';

/**
 * Route Status V1 final audit §2 — every legacy getDisplayDirectness()
 * public gate (data/deals.ts, data/fare-observations.ts,
 * lib/booking-intelligence.ts, app/routes/page.tsx's directCount) must now
 * defer to getEffectiveRoutePresentation() so a ledger-managed route that
 * has become 'unverified' (pending reverification) or 'service-ended'
 * publishes no direct badge, airline attribution, fare intelligence, or
 * Book-By guidance — even though the legacy, inclusive check alone would
 * still say 'direct'.
 */

const FIXED_TODAY = '2026-07-23';
const SOURCE: SourceRef = { publisher: 'Test Publisher', url: 'https://example.com/source', accessedAt: FIXED_TODAY };

function makeEvent(overrides: Partial<RouteStatusEvent> & Pick<RouteStatusEvent, 'type'>): RouteStatusEvent {
  const base = {
    id: 'fixture-suppression-event',
    routeSlug: 'manchester-lahore',
    serviceId: 'fixture-suppression-service',
    scope: { kind: 'airline' as const, airlineSlug: 'pia' },
    headline: 'Fixture headline',
    explanation: 'Fixture explanation.',
    sources: [SOURCE],
    verifiedAt: FIXED_TODAY,
  };
  return { ...base, ...overrides } as RouteStatusEvent;
}

describe('final audit §2 — the real managed corridors past the transition boundary', () => {
  const POST_BOUNDARY = '2026-09-15';

  it('getDealDirectnessLabel no longer shows "Direct flight" for Manchester–Mumbai/Delhi past the boundary', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const label = getDealDirectnessLabel({ fromAirportSlug: route.airportSlug, toDestinationSlug: route.destinationSlug }, POST_BOUNDARY);
      expect(label, slug).not.toBe('Direct flight');
    }
  });

  it('getDealAirlineLabel no longer confirms IndiGo for Manchester–Mumbai/Delhi past the boundary', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const label = getDealAirlineLabel({ fromAirportSlug: getRouteBySlug(slug)!.airportSlug, toDestinationSlug: getRouteBySlug(slug)!.destinationSlug, airline: 'IndiGo' }, POST_BOUNDARY);
      expect(label, slug).toBe('Verification pending');
    }
  });

  it('isObservationPublishable rejects a date-complete observation on Manchester–Mumbai/Delhi past the boundary', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const observation = {
        id: 'fixture-obs',
        routeSlug: route.slug,
        cabin: 'Economy' as const,
        observedDate: '2026-07-01',
        price: 500,
        priceNote: 'return, per person',
        source: 'IndiGo',
        departureDate: '2026-10-01',
        returnDate: '2026-10-15',
      };
      expect(isObservationPublishable(observation, route, POST_BOUNDARY), slug).toBe(false);
    }
  });

  it('neither real ledger-managed route is currently in the Book-By priority list — documenting there is no live gap today, while the underlying gate (proven below) is fixed', () => {
    expect(BOOK_BY_PRIORITY_ROUTE_SLUGS).not.toContain('manchester-mumbai');
    expect(BOOK_BY_PRIORITY_ROUTE_SLUGS).not.toContain('manchester-delhi');
  });
});

describe('final audit §2 — directCount must use effective status, not the legacy gate alone', () => {
  it('replicating app/routes/page.tsx\'s directCount filter against the real routes array: Manchester–Mumbai/Delhi are excluded once past the transition boundary', () => {
    // Deliberately close to (but past) the ledger boundary, not far past it —
    // most other real routes' OWN unrelated reviewDueDate values (~13 Aug
    // 2026) go stale well before this date too, which would zero out
    // directCount for reasons unconnected to Route Status — this date keeps
    // the check isolated to the ledger's own effect.
    const POST_BOUNDARY = '2026-09-01';
    const directSlugs = routes.filter((r) => getEffectiveRoutePresentation(r, routeStatusEvents, POST_BOUNDARY).status === 'direct').map((r) => r.slug);
    expect(directSlugs).not.toContain('manchester-mumbai');
    expect(directSlugs).not.toContain('manchester-delhi');
  });

  it('at today\'s real date (before the boundary), the same filter still counts both managed corridors as direct — confirms the fix does not over-suppress', () => {
    const directSlugs = routes.filter((r) => getEffectiveRoutePresentation(r, routeStatusEvents, FIXED_TODAY).status === 'direct').map((r) => r.slug);
    expect(directSlugs).toContain('manchester-mumbai');
    expect(directSlugs).toContain('manchester-delhi');
  });
});

describe('final audit §2 — a synthetic service-ended route suppresses deals, fares and the Book-By gate condition end-to-end', () => {
  // manchester-lahore IS one of the 5 real BOOK_BY_PRIORITY_ROUTE_SLUGS
  // routes today (corrected — an earlier version of this test incorrectly
  // claimed it wasn't, which made the computeBookBySnapshot assertion below
  // pass for an undocumented/ambiguous reason). Because it's genuinely
  // Book-By-eligible, computeBookBySnapshot must return non-null BEFORE the
  // synthetic event is added and null AFTER — proving the production gate
  // this round added (`effectiveStatus === 'unverified' || 'service-ended'`
  // in lib/booking-intelligence.ts) is what causes the suppression, not
  // isBookByRoute()'s earlier, unrelated priority-list check.
  it('service-ended suppresses getDealDirectnessLabel, getDealAirlineLabel, isObservationPublishable, and flips computeBookBySnapshot from non-null to null', () => {
    expect(BOOK_BY_PRIORITY_ROUTE_SLUGS).toContain('manchester-lahore');
    const route = getRouteBySlug('manchester-lahore')!;
    expect(route.airlineSlugs).toEqual(['pia']); // sole operator, matches the synthetic event's scope

    const testDate = new Date(`${FIXED_TODAY}T12:00:00Z`);
    // Before the synthetic event: manchester-lahore is genuinely Book-By-eligible today.
    expect(computeBookBySnapshot('manchester-lahore', testDate)).not.toBeNull();

    const ended = makeEvent({
      id: 'fixture-suppression-ended',
      routeSlug: 'manchester-lahore',
      serviceId: 'fixture-suppression-service',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
    });
    const syntheticEvents = [...routeStatusEvents, ended];

    (routeStatusEvents as RouteStatusEvent[]).push(ended);
    try {
      const label = getDealDirectnessLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore' }, FIXED_TODAY);
      expect(label).not.toBe('Direct flight');

      const airlineLabel = getDealAirlineLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore', airline: 'PIA' }, FIXED_TODAY);
      expect(airlineLabel).toBe('Verification pending');

      const observation = {
        id: 'fixture-obs-2',
        routeSlug: 'manchester-lahore',
        cabin: 'Economy' as const,
        observedDate: '2026-07-05',
        price: 450,
        priceNote: 'return, per person',
        source: 'PIA',
        departureDate: '2026-08-01',
        returnDate: '2026-08-15',
      };
      expect(isObservationPublishable(observation, route, FIXED_TODAY)).toBe(false);

      const effectiveStatus = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY).status;
      expect(effectiveStatus).toBe('service-ended');

      // After the synthetic event: the same, otherwise-eligible route now
      // returns null — the production gate itself, not the priority list.
      expect(computeBookBySnapshot('manchester-lahore', testDate)).toBeNull();
    } finally {
      // Restore global ledger state so no other test file is affected.
      const idx = (routeStatusEvents as RouteStatusEvent[]).indexOf(ended);
      if (idx !== -1) (routeStatusEvents as RouteStatusEvent[]).splice(idx, 1);
      expect(routeStatusEvents.length).toBe(syntheticEvents.length - 1);
    }

    // Restored: eligible again, proving the earlier null was caused by the
    // synthetic event and not by a lingering mutation.
    expect(computeBookBySnapshot('manchester-lahore', testDate)).not.toBeNull();
  });
});
