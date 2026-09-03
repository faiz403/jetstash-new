import { describe, expect, it } from 'vitest';
import { getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';

const NOW_ISO = '2026-08-12';

describe('Manchester Turkey route guides', () => {
  it('adds the five approved Manchester Turkey route guides with current verification', () => {
    const routes = ['manchester-istanbul', 'manchester-dalaman', 'manchester-bodrum', 'manchester-antalya', 'manchester-izmir'].map((slug) => getRouteBySlug(slug));

    expect(routes.every(Boolean)).toBe(true);
    expect(routes.map((route) => route?.airportSlug)).toEqual(['manchester', 'manchester', 'manchester', 'manchester', 'manchester']);
    expect(routes.map((route) => route?.verification?.status)).toEqual(['verified', 'verified', 'verified', 'verified', 'verified']);
    // Route Intelligence Freshness rolling-review Batch 1 (3 September 2026):
    // manchester-istanbul was reconfirmed and moved to the STABLE 90-day
    // window on fresh evidence (Turkish Airlines' own page now states "no
    // changes occur in the number of flights throughout the year") -- the
    // other four Turkey routes were not part of that batch and are
    // unchanged, deliberately no longer sharing one synchronised date.
    expect(routes.map((route) => route?.verification?.verifiedDate)).toEqual(['2026-09-03', '2026-08-12', '2026-08-12', '2026-08-12', '2026-08-12']);
    expect(routes.map((route) => route?.verification?.reviewDueDate)).toEqual(['2026-12-02', '2026-09-12', '2026-09-12', '2026-09-12', '2026-09-12']);
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

  it('keeps Antalya direct, seasonal and duration-qualified', () => {
    const route = getRouteBySlug('manchester-antalya')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['SunExpress', 'Jet2', 'Corendon']);
    expect(presentation.frequency).toContain('Seasonal direct service');
    expect(presentation.flightTime).toContain('Published timings vary by source');
    expect(presentation.flightTime).not.toMatch(/\b4h\s*\d+m\b/);
    expect(presentation.summary).toContain('Published timings differ by source');
    expect(presentation.summary.toLowerCase()).not.toContain('year-round');
  });

  it('keeps Izmir seasonal with a planning duration and no fixed frequency', () => {
    const route = getRouteBySlug('manchester-izmir')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['SunExpress']);
    expect(presentation.frequency).toContain('April–October 2026 programme');
    expect(presentation.frequency).not.toMatch(/\b\d+ weekly\b/);
    expect(presentation.flightTime).toContain('4h 20m from Manchester Airport');
    expect(presentation.flightTime).toContain('planning figure');
    expect(presentation.summary).not.toContain('via Istanbul outside the summer schedule');
  });

  it('keeps the existing exact Trip.com handoff on each new route', () => {
    for (const slug of ['manchester-istanbul', 'manchester-dalaman', 'manchester-bodrum', 'manchester-antalya', 'manchester-izmir']) {
      const url = getTripComFlightHandoffUrl(slug);
      expect(url, slug).toContain('Allianceid=9804124');
      expect(url, slug).toContain('SID=327450313');
      expect(url, slug).toContain('locale=en-XX');
      expect(url, slug).toContain('curr=GBP');
      expect(url, slug).not.toContain('ddate=');
      expect(url, slug).not.toContain('rdate=');
    }
  });

  it('replaces the destination-page continuation with the exact route guide', () => {
    for (const [destinationSlug, routeSlug] of [
      ['antalya', 'manchester-antalya'],
      ['izmir', 'manchester-izmir'],
    ] as const) {
      const destination = getDestinationBySlug(destinationSlug)!;
      const entry = getDestinationFlightGuideEntries(destination, NOW_ISO).find((item) => item.airport.slug === 'manchester');

      expect(entry?.routeSlug).toBe(routeSlug);
      expect(entry?.href).toBe(`/routes/${routeSlug}`);
      expect(getDestinationFlightGuideEntries(destination, NOW_ISO).filter((item) => item.airport.slug === 'manchester' && item.href)).toHaveLength(1);
    }
  });
});
