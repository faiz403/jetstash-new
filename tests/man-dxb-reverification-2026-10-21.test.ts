import { describe, expect, it } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

// Manchester-Dubai re-verification (21 Oct 2026) against Emirates' own route
// page: corrected flight time, unchanged frequency, STABLE 90-day window.
const route = getRouteBySlug('manchester-dubai')!;

describe('Manchester-Dubai re-verification, 21 October 2026', () => {
  it('records the fresh check on the STABLE 90-day window', () => {
    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.verifiedDate).toBe('2026-10-21');
    expect(route.verification?.reviewDueDate).toBe('2027-01-19');
    const days = (Date.parse('2027-01-19') - Date.parse('2026-10-21')) / 86_400_000;
    expect(days).toBe(90);
  });

  it('replaces the outdated 8h claim without presenting the return as under eight hours', () => {
    expect(route.flightTime).not.toContain('8h direct (Emirates route page)');
    expect(route.flightTime).toContain('7–8h direct to Dubai');
    expect(route.flightTime).toContain('up to 8h 10m back');
    expect(route.frequency).toBe('21 flights per week (Emirates; seasonal variation possible)');
  });

  it('stays Direct through its review date and fails closed the day after', () => {
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2027-01-19').status).toBe('direct');
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2027-01-20').status).toBe('unverified');
  });

  it('has no route-status event that would make it RECENT/CHANGING', () => {
    expect(routeStatusEvents.some((e) => e.routeSlug === 'manchester-dubai')).toBe(false);
  });
});
