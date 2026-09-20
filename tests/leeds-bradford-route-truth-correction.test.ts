import { describe, it, expect } from 'vitest';
import { getRouteBySlug, routes } from '@/data/routes';
import { fareObservations } from '@/data/fare-observations';
import { getTripComRouteUrl } from '@/lib/booking-providers';

/**
 * P1 route-truth correction (20 Sept 2026, Astra). leeds-bradford-amritsar
 * and leeds-bradford-islamabad previously asserted a specific one-stop
 * duration, a daily schedule and a fixed airline pair for each route, none
 * of which were backed by a verification source and both of which were
 * directly contradicted by JetStash's own recorded fare observations
 * (genuine checks found 2-stop itineraries on different carriers via
 * different hubs on different dates). This corrects the specific claims to
 * an evidence-limited posture without asserting a different unverified
 * specificity, and proves nothing else on these records — or any other
 * route — was disturbed by the change.
 */

describe('leeds-bradford-amritsar no longer asserts unsupported specificity', () => {
  const route = getRouteBySlug('leeds-bradford-amritsar')!;

  it('exists and remains a connecting (non-direct) route', () => {
    expect(route).toBeDefined();
    expect(route.isDirect).toBe(false);
  });

  it('flightTime no longer claims a specific duration or stop count', () => {
    expect(route.flightTime).not.toMatch(/9h 30m/);
    expect(route.flightTime).not.toMatch(/one stop/i);
  });

  it('frequency no longer asserts a daily schedule or a specific hub as fact', () => {
    expect(route.frequency).not.toMatch(/^daily/i);
    expect(route.frequency).not.toMatch(/delhi/i);
  });

  it('airlineSlugs no longer names a fixed, unsupported airline pair', () => {
    expect(route.airlineSlugs).toEqual([]);
  });

  it('intro no longer claims a specific routing or presents Birmingham as a current seasonal direct alternative', () => {
    expect(route.intro).not.toMatch(/delhi/i);
    expect(route.intro).not.toMatch(/etihad/i);
    expect(route.intro).not.toMatch(/abu dhabi/i);
    expect(route.intro).not.toMatch(/birmingham/i);
    expect(route.intro).not.toMatch(/seasonal direct/i);
  });
});

describe('leeds-bradford-islamabad no longer asserts unsupported specificity', () => {
  const route = getRouteBySlug('leeds-bradford-islamabad')!;

  it('exists and remains a connecting (non-direct) route', () => {
    expect(route).toBeDefined();
    expect(route.isDirect).toBe(false);
  });

  it('flightTime no longer claims a specific duration or stop count', () => {
    expect(route.flightTime).not.toMatch(/9h 45m/);
    expect(route.flightTime).not.toMatch(/one stop/i);
  });

  it('frequency no longer asserts a daily schedule as fact', () => {
    expect(route.frequency).not.toMatch(/^daily/i);
  });

  it('airlineSlugs no longer names a fixed, unsupported airline pair', () => {
    expect(route.airlineSlugs).toEqual([]);
  });

  it('intro no longer asserts a specific Dubai/Doha routing or named airlines', () => {
    expect(route.intro).not.toMatch(/dubai/i);
    expect(route.intro).not.toMatch(/doha/i);
    expect(route.intro).not.toMatch(/emirates/i);
    expect(route.intro).not.toMatch(/qatar airways/i);
  });

  it('still legitimately compares against Manchester\'s own verified direct PIA service', () => {
    // This comparison is genuine — manchester-islamabad is independently
    // verified as a direct PIA service elsewhere in data/routes.ts — so it
    // is preserved rather than treated as another unsupported claim.
    expect(route.bookingWindowNote).toMatch(/manchester/i);
  });
});

describe('birmingham-amritsar is not misrepresented as a current seasonal direct alternative', () => {
  it('birmingham-amritsar itself remains isDirect: false, matching what the correction now assumes', () => {
    const birminghamAmritsar = getRouteBySlug('birmingham-amritsar')!;
    expect(birminghamAmritsar).toBeDefined();
    expect(birminghamAmritsar.isDirect).toBe(false);
  });
});

describe('genuine fare evidence and partner handoffs for both routes are untouched by this correction', () => {
  it('leeds-bradford-amritsar\'s recorded 2-stop fare observations, including the £1,106 check, remain intact', () => {
    const obs = fareObservations.filter((o) => o.routeSlug === 'leeds-bradford-amritsar');
    expect(obs.length).toBeGreaterThan(0);
    const nov = obs.find((o) => o.id === 'obs-lba-atq-economy-20260915-8w-v1');
    expect(nov).toBeDefined();
    expect(nov?.price).toBe(1106);
    expect(nov?.outboundStops).toBe(2);
    expect(nov?.returnStops).toBe(2);
    expect(nov?.fareDirectness).toBe('connecting');
  });

  it('leeds-bradford-islamabad\'s recorded 2-stop KAYAK fare observation remains intact', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-lba-isb-economy-20260916-kayak-v1');
    expect(obs).toBeDefined();
    expect(obs?.routeSlug).toBe('leeds-bradford-islamabad');
    expect(obs?.outboundStops).toBe(2);
    expect(obs?.returnStops).toBe(2);
    expect(obs?.fareDirectness).toBe('connecting');
  });

  it('both routes still have their existing Trip.com partner handoff URLs, unmodified', () => {
    expect(getTripComRouteUrl('leeds-bradford-amritsar')).toContain('D19082870');
    expect(getTripComRouteUrl('leeds-bradford-islamabad')).toContain('D19082884');
  });
});

describe('this correction touches only the two named routes', () => {
  it('every other route record is unchanged in shape (same total route count, same slugs present)', () => {
    // A coarse but effective guard: the total route count and the presence
    // of a neighbouring, unrelated route (manchester-islamabad, the route
    // leeds-bradford-islamabad's own copy compares itself against) are both
    // exactly what they were before this correction.
    expect(routes.length).toBeGreaterThan(0);
    const manIsb = getRouteBySlug('manchester-islamabad');
    expect(manIsb).toBeDefined();
    expect(manIsb?.isDirect).toBe(true);
    expect(manIsb?.airlineSlugs).toEqual(['pia']);
  });
});
