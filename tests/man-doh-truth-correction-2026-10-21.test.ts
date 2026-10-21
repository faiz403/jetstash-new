import { describe, expect, it } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

// Manchester-Doha truth correction (21 Oct 2026) against Manchester Airport's
// own Qatar Airways operator page: direct service kept, unsupported duration,
// frequency and comparison claims removed, STABLE 90-day window.
const route = getRouteBySlug('manchester-doha')!;
const claims = () => [route.flightTime, route.frequency, route.intro, route.bookingWindowNote].join(' ');

describe('Manchester-Doha truth correction, 21 October 2026', () => {
  it('records the fresh airport-sourced check on the STABLE 90-day window', () => {
    expect(route.verification).toMatchObject({
      status: 'verified',
      sourceUrl: 'https://www.manchesterairport.co.uk/flight-operators/qatar-airways/',
      verifiedDate: '2026-10-21',
      reviewDueDate: '2027-01-19',
    });
    const days = (Date.parse(route.verification!.reviewDueDate) - Date.parse(route.verification!.verifiedDate)) / 86_400_000;
    expect(days).toBe(90);
    expect(routeStatusEvents.some((e) => e.routeSlug === 'manchester-doha')).toBe(false);
  });

  it('keeps the confirmed direct service', () => {
    expect(route.isDirect).toBe(true);
    expect(route.airlineSlugs).toEqual(['qatar-airways']);
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2027-01-19').status).toBe('direct');
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2027-01-20').status).not.toBe('direct');
  });

  it('claims no journey time, frequency or comparison the source does not give', () => {
    expect(claims()).not.toMatch(/\d+\s*h|hours?\b|minutes?\b/i);
    expect(claims()).not.toMatch(/regular|high frequency|daily|weekly|per week|less pressured|South Asia/i);
    expect(route.flightTime).toBe('Direct service listed by Manchester Airport; check the exact flight for duration');
  });

  it('makes no route-specific pricing or demand claim', () => {
    expect(route.peakPeriodIds).toEqual([]);
    expect(route.bookingWindowNote).not.toMatch(/premium|peak|school holiday|demand|cheaper|pressured/i);
  });
});
