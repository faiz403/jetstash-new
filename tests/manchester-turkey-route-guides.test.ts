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
    // other four Turkey routes were not part of that batch, and were then
    // refreshed together in the Route Verification Refresh, 12 September
    // due-soon batch (7 September 2026), landing on a shared date because
    // they were reverified together in that batch, not because of any
    // synchronisation rule.
    expect(routes.map((route) => route?.verification?.verifiedDate)).toEqual(['2026-09-03', '2026-09-07', '2026-09-07', '2026-09-07', '2026-09-07']);
    expect(routes.map((route) => route?.verification?.reviewDueDate)).toEqual(['2026-12-02', '2026-10-07', '2026-10-07', '2026-10-07', '2026-10-07']);
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
    // B1 route re-verification Batch 2 (19 Oct 2026, founder-approved corrections): easyJet and Jet2 added from Manchester Airport's
    // 19 Oct 2026 departures board; SunExpress wording made seasonal and dated
    // (no SunExpress winter 2026/27 Dalaman service).
    // The record now names three operators, but none has its own airline-level
    // verification, so the public presentation shows no airline (fail-closed:
    // a newly observed operator is never displayed as verified).
    expect(route.airlineSlugs).toEqual(['sunexpress', 'easyjet', 'jet2']);
    expect(presentation.airlineSlugs).toEqual([]);
    expect(presentation.frequency).toContain('up to 15 weekly overnight flights in summer 2026');
    expect(presentation.frequency).toContain('no winter 2026/27 service');
    expect(presentation.summary).toContain('Check the exact dates, airline and schedule before booking.');
  });

  it('keeps Bodrum seasonal and preserves conflicting published timings', () => {
    const route = getRouteBySlug('manchester-bodrum')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    // B1 route re-verification Batch 2 (19 Oct 2026, founder-approved corrections): SunExpress lists Bodrum in neither its winter
    // 2026/27 timetable nor its Summer 2027 UK schedule, so it is no longer a
    // current operator; the summer 2026 service is kept as dated history.
    expect(presentation.airlineSlugs).toEqual([]);
    expect(presentation.frequency).toContain('SunExpress flew twice weekly in summer 2026');
    expect(presentation.frequency).toContain('current operators are not confirmed');
    expect(presentation.summary).toContain('Manchester Airport says flights are summer-only');
    expect(presentation.flightTime).toContain('Published timings vary by source');
    expect(presentation.summary).not.toMatch(/4h\s*\d*m/);
  });

  it('keeps Antalya direct, seasonal and duration-qualified', () => {
    const route = getRouteBySlug('manchester-antalya')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    // B1 route re-verification Batch 2 (19 Oct 2026, founder-approved corrections): easyJet added from Manchester Airport's 19 Oct
    // 2026 board; SunExpress winter 2026/27 Thursday/Sunday listing recorded
    // without claiming nonstop operation or exact-date availability.
    // easyJet is named on the record but has no airline-level verification, so
    // the public presentation still shows only the three previously verified airlines.
    expect(route.airlineSlugs).toEqual(['sunexpress', 'jet2', 'corendon', 'easyjet']);
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['SunExpress', 'Jet2', 'Corendon']);
    expect(presentation.frequency).toContain('lists Manchester–Antalya on Thursdays and Sundays (subject to change)');
    expect(presentation.frequency).toContain('winter schedules not confirmed');
    expect(presentation.flightTime).toContain('Published timings vary by source');
    expect(presentation.flightTime).not.toMatch(/\b4h\s*\d+m\b/);
    expect(presentation.summary).toContain('Operating days, airlines and timings vary');
    expect(presentation.summary.toLowerCase()).not.toContain('year-round');
    expect(presentation.summary.toLowerCase()).not.toContain('nonstop');
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
    for (const slug of ['manchester-istanbul', 'manchester-dalaman', 'manchester-bodrum', 'manchester-antalya']) {
      const url = getTripComFlightHandoffUrl(slug);
      expect(url, slug).toContain('Allianceid=9804124');
      expect(url, slug).toContain('SID=327450313');
      expect(url, slug).toContain('locale=en-XX');
      expect(url, slug).toContain('curr=GBP');
      expect(url, slug).not.toContain('ddate=');
      expect(url, slug).not.toContain('rdate=');
    }
    expect(getTripComFlightHandoffUrl('manchester-izmir')).toBeNull();
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
