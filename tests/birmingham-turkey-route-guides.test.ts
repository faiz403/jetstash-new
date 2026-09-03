import { describe, expect, it } from 'vitest';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';

const NOW_ISO = '2026-08-12';
const ROUTES = ['birmingham-istanbul', 'birmingham-antalya', 'birmingham-dalaman', 'birmingham-bodrum'] as const;

describe('Birmingham Turkey route guides', () => {
  it('adds all four approved guides with current verification', () => {
    const routes = ROUTES.map((slug) => getRouteBySlug(slug));

    expect(routes.every(Boolean)).toBe(true);
    expect(routes.map((route) => route?.airportSlug)).toEqual(['birmingham', 'birmingham', 'birmingham', 'birmingham']);
    expect(routes.map((route) => route?.verification?.status)).toEqual(['verified', 'verified', 'verified', 'verified']);
    // Route Intelligence Freshness rolling-review Batch 2 (3 September 2026):
    // birmingham-istanbul was reconfirmed and moved to the STABLE 90-day
    // window on fresh evidence (Birmingham Airport's current destination
    // page names both operators and matches exactly) -- the other three
    // Birmingham Turkey routes were not part of that batch and are
    // unchanged, deliberately no longer sharing one synchronised date.
    expect(routes.map((route) => route?.verification?.verifiedDate)).toEqual(['2026-09-03', '2026-08-12', '2026-08-12', '2026-08-12']);
  });

  it('publishes the Istanbul airport distinction without inventing frequency', () => {
    const route = getRouteBySlug('birmingham-istanbul')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['Turkish Airlines', 'Pegasus Airlines']);
    expect(presentation.flightTime).toContain('4h 05m');
    expect(presentation.summary).toContain('Istanbul Airport (IST)');
    expect(presentation.summary).toContain('Sabiha Gökçen (SAW)');
    expect(presentation.summary.toLowerCase()).not.toContain('daily');
  });

  it('publishes direct Antalya service with the approximate Birmingham Airport timing', () => {
    const route = getRouteBySlug('birmingham-antalya')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['Corendon', 'easyJet', 'Jet2', 'TUI', 'SunExpress']);
    expect(presentation.flightTime).toContain('4h 20m');
    expect(presentation.summary).toContain('Airline availability and schedules vary by date');
    expect(presentation.summary.toLowerCase()).not.toContain('year-round');
  });

  it('publishes direct Dalaman service without turning the approximate time into a guarantee', () => {
    const route = getRouteBySlug('birmingham-dalaman')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['Jet2', 'TUI', 'easyJet']);
    expect(presentation.flightTime).toContain('4h 05m');
    expect(presentation.summary).toContain('individual scheduled flights can differ');
    expect(presentation.summary.toLowerCase()).not.toContain('summer-only');
  });

  it('keeps Bodrum seasonal and date-dependent', () => {
    const route = getRouteBySlug('birmingham-bodrum')!;
    const presentation = getRoutePresentation(route, NOW_ISO);

    expect(presentation.status).toBe('direct');
    expect(presentation.frequency).toContain('Seasonal direct service');
    expect(getAirlinesBySlugs(presentation.airlineSlugs).map((airline) => airline.name)).toEqual(['Jet2', 'TUI']);
    expect(presentation.flightTime).toContain('4h 15m');
    expect(presentation.summary).toContain('summer programme');
    expect(presentation.summary.toLowerCase()).not.toContain('fixed');
  });

  it('preserves the exact dateless GBP Trip.com handoff on every new route', () => {
    for (const slug of ROUTES) {
      const url = getTripComFlightHandoffUrl(slug);
      expect(url, slug).toContain('dcity=BHX');
      expect(url, slug).toContain('locale=en-XX&curr=GBP');
      expect(url, slug).toContain('Allianceid=9804124');
      expect(url, slug).toContain('SID=327450313');
      expect(url, slug).not.toContain('ddate=');
      expect(url, slug).not.toContain('rdate=');
    }
  });

  it('replaces the Birmingham destination continuation with one route-guide journey per destination', () => {
    for (const destinationSlug of ['istanbul', 'antalya', 'dalaman', 'bodrum'] as const) {
      const destination = getDestinationBySlug(destinationSlug)!;
      const entries = getDestinationFlightGuideEntries(destination, NOW_ISO);
      const birminghamEntries = entries.filter((entry) => entry.airport.slug === 'birmingham');

      expect(birminghamEntries).toHaveLength(1);
      expect(birminghamEntries[0].routeSlug).toBe(`birmingham-${destinationSlug}`);
      expect(birminghamEntries[0].href).toBe(`/routes/birmingham-${destinationSlug}`);
    }
  });
});
