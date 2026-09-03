import { describe, expect, it } from 'vitest';
import {
  getRouteBySlug,
  getDisplayDirectness,
  getDealAirlineDisplayStatus,
  isVerificationCurrent,
} from '@/data/routes';
import { getActiveEvents, getEventsForRoute, routeStatusEvents } from '@/data/route-status-events';

/**
 * LHR-Jeddah operator correction (TR-010, Round 4 -- 3 September 2026).
 *
 * Converging evidence (Reuters and The Independent, 9 Apr 2026; a
 * reproduced British Airways trade notice announcing a permanent Jeddah
 * suspension from 24 April 2026; Heathrow's own airlines-and-routes table
 * listing BA for Riyadh only, not Jeddah) established that British Airways
 * no longer operates this route. This is an airline-level correction, not a
 * route-level one -- the route itself remains direct via Saudia's own,
 * independently verified, current evidence (its own live booking page).
 * These tests protect the six invariants this correction must hold.
 */

const ROUTE_SLUG = 'london-heathrow-jeddah';
const NOW_ISO = '2026-09-03';

describe('LHR-Jeddah British Airways correction', () => {
  it('1. the route remains direct', () => {
    const route = getRouteBySlug(ROUTE_SLUG)!;
    expect(route.isDirect).toBe(true);
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('direct');
  });

  it('2. Saudia remains the active, supported operator', () => {
    const route = getRouteBySlug(ROUTE_SLUG)!;
    expect(route.airlineSlugs).toEqual(['saudia']);
    expect(getDealAirlineDisplayStatus(route, 'saudia', NOW_ISO)).toBe('verified');
  });

  it('3. British Airways is not presented as a current operator', () => {
    const route = getRouteBySlug(ROUTE_SLUG)!;
    expect(route.airlineSlugs).not.toContain('british-airways');
    expect(route.airlineVerifications ?? []).toHaveLength(0);
    expect(getDealAirlineDisplayStatus(route, 'british-airways', NOW_ISO)).toBe('unverified');
    expect(route.intro).not.toMatch(/British Airways and Saudia both/i);
    expect(route.intro.toLowerCase()).toContain('ended its heathrow-jeddah service');
  });

  it('4. no route-level service-ended event was introduced -- this is an airline-level correction, the route has not ended', () => {
    const routeEvents = getEventsForRoute(ROUTE_SLUG, routeStatusEvents);
    const events = getActiveEvents(routeEvents);
    expect(events.filter((e) => e.type === 'service-ended')).toHaveLength(0);
    expect(routeEvents).toHaveLength(0);
  });

  it('5. the new verification is genuinely dated and fails closed once its own review window passes', () => {
    const route = getRouteBySlug(ROUTE_SLUG)!;
    expect(route.verification?.verifiedDate).toBe('2026-09-03');
    expect(route.verification?.reviewDueDate).toBe('2026-10-03');
    // Within the window: current.
    expect(isVerificationCurrent(route.verification, '2026-10-02')).toBe(true);
    // Past the window: fails closed, exactly like every other route's cadence.
    expect(isVerificationCurrent(route.verification, '2026-10-04')).toBe(false);
    expect(getDealAirlineDisplayStatus(route, 'saudia', '2026-10-04')).toBe('unverified');
  });

  it('6. no other route was changed by this correction', () => {
    // Spot-check two routes untouched by this fix and known to have their
    // own independent Saudia/British-Airways evidence, proving this
    // correction did not bleed into unrelated records.
    const jeddahAdjacent = getRouteBySlug('london-heathrow-mumbai')!;
    expect(jeddahAdjacent.airlineSlugs).toContain('british-airways');
    expect(jeddahAdjacent.airlineSlugs).toContain('air-india');
    const manIsb = getRouteBySlug('manchester-islamabad')!;
    expect(manIsb.airlineSlugs).not.toContain('saudia');
    const manLhe = getRouteBySlug('manchester-lahore')!;
    expect(manLhe.airlineSlugs).toEqual(['pia']);
  });
});
