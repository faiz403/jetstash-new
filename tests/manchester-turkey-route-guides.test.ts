import { describe, expect, it } from 'vitest';
import { getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';

const NOW_ISO = '2026-08-12';

describe('Manchester Turkey route guides', () => {
  it('adds only the three approved Manchester route guides with current verification', () => {
    const routes = ['manchester-istanbul', 'manchester-dalaman', 'manchester-bodrum'].map((slug) => getRouteBySlug(slug));

    expect(routes.every(Boolean)).toBe(true);
    expect(routes.map((route) => route?.airportSlug)).toEqual(['manchester', 'manchester', 'manchester']);
    expect(routes.map((route) => route?.verification?.status)).toEqual(['verified', 'verified', 'verified']);
    expect(routes.map((route) => route?.verification?.verifiedDate)).toEqual(['2026-08-12', '2026-08-12', '2026-08-12']);
    expect(routes.map((route) => route?.verification?.reviewDueDate)).toEqual(['2026-09-12', '2026-09-12', '2026-09-12']);
  });

  it('keeps Istanbul wording specific to Turkish Airlines rather than total route frequency', () => {
    const route = getRouteBySlug('manchester-istanbul')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(presentation.frequency).toContain('Turkish Airlines: two direct flights daily');
    expect(presentation.summary).toContain('Istanbul Airport (IST)');
    expect(presentation.summary).toContain('Manchester Airport lists a scheduled flight time of 4h30m');
    expect(presentation.summary.toLowerCase()).not.toContain('two daily flights from manchester');
  });

  it('publishes the evidenced SunExpress Dalaman service with an exact-date caveat', () => {
    const route = getRouteBySlug('manchester-dalaman')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['SunExpress']);
    expect(presentation.frequency).toContain('daily direct overnight service from 19 May 2026');
    expect(presentation.summary).toContain('Check the exact dates, schedule and baggage terms before booking.');
  });

  it('keeps Bodrum seasonal and preserves conflicting published timings', () => {
    const route = getRouteBySlug('manchester-bodrum')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(presentation.frequency).toContain('twice-weekly direct service in the summer 2026 programme');
    expect(presentation.summary).toContain('Manchester Airport says flights are summer-only');
    expect(presentation.flightTime).toContain('Published timings vary by source');
    expect(presentation.summary).not.toMatch(/4h\s*\d*m/);
  });

  it('keeps the existing exact Trip.com handoff on each new route', () => {
    for (const slug of ['manchester-istanbul', 'manchester-dalaman', 'manchester-bodrum']) {
      const url = getTripComFlightHandoffUrl(slug);
      expect(url, slug).toContain('Allianceid=9804124');
      expect(url, slug).toContain('SID=327450313');
      expect(url, slug).toContain('locale=en-XX');
      expect(url, slug).toContain('curr=GBP');
      expect(url, slug).not.toContain('ddate=');
      expect(url, slug).not.toContain('rdate=');
    }
  });
});
