import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getRoutesByDestination } from '@/data/routes';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getTripComDestinationHandoffUrl } from '@/lib/booking-providers';

const NOW_ISO = '2026-08-12';

describe('destination flight guides', () => {
  it('never turns a destination journey with no exact route into a generic airport-page link', () => {
    for (const destination of destinations) {
      const entries = getDestinationFlightGuideEntries(destination, NOW_ISO);
      for (const entry of entries.filter((item) => item.routeSlug === null)) {
        expect(entry.href).toBeNull();
      }
    }
  });

  it('links every exact airport-to-destination route to its own public route guide', () => {
    for (const destination of destinations) {
      const entries = getDestinationFlightGuideEntries(destination, NOW_ISO);
      for (const route of getRoutesByDestination(destination.slug)) {
        const entry = entries.find((item) => item.routeSlug === route.slug);
        expect(entry?.href).toBe(`/routes/${route.slug}`);
      }
    }
  });

  it('does not hide published route guides when the destination airport list is incomplete', () => {
    const amritsar = getDestinationBySlug('amritsar')!;
    const islamabad = getDestinationBySlug('islamabad')!;
    const madinah = getDestinationBySlug('madinah')!;

    expect(getDestinationFlightGuideEntries(amritsar, NOW_ISO).some((entry) => entry.routeSlug === 'leeds-bradford-amritsar')).toBe(true);
    expect(getDestinationFlightGuideEntries(islamabad, NOW_ISO).some((entry) => entry.routeSlug === 'leeds-bradford-islamabad')).toBe(true);
    expect(getDestinationFlightGuideEntries(madinah, NOW_ISO).some((entry) => entry.routeSlug === 'birmingham-madinah')).toBe(true);
  });

  it('keeps route evidence and fare evidence specific to the exact airport-to-destination pair', () => {
    // birmingham-islamabad was this fixture until COV-001 (21 August 2026)
    // reclassified it verified-connecting and Fare Coverage Batch 1 (22
    // August 2026) then gave it a fresh, genuinely publishable observation
    // — it now legitimately shows fareSignal.state 'current', so it can no
    // longer prove the "route evidence is pair-specific, fare stays
    // suppressed" case. Swapped to Delhi (birmingham-delhi vs manchester-
    // delhi), then swapped again once Connecting Journey Structure +
    // BHX-DEL unlock (22 August 2026) gave birmingham-delhi its own
    // publishable observation too. Swapped to Ahmedabad: manchester-
    // ahmedabad is verified-connecting with a current fare, and birmingham-
    // ahmedabad remains genuinely unverified (one of the five routes still
    // verification-blocked site-wide) with no fare surfacing — a different
    // reason for divergence (route verification, not evidence exclusion),
    // but the same property under test: two routes sharing a destination
    // resolve independently, never conflated.
    const ahmedabad = getDestinationFlightGuideEntries(getDestinationBySlug('ahmedabad')!, NOW_ISO);
    const manchester = ahmedabad.find((entry) => entry.routeSlug === 'manchester-ahmedabad')!;
    const birmingham = ahmedabad.find((entry) => entry.routeSlug === 'birmingham-ahmedabad')!;

    expect(manchester.routeStatus).toBe('connecting');
    expect(manchester.fareSignal?.state).toBe('current');
    expect(birmingham.routeStatus).toBe('unverified');
    expect(birmingham.fareSignal?.state).toBe('none');
  });

  it('keeps destination pages destination-first instead of linking missing route guides to airport pages', () => {
    const source = readFileSync(join(process.cwd(), 'app/destinations/[slug]/page.tsx'), 'utf8');
    expect(source).toContain('<DestinationFlightGuides');
    expect(source).not.toContain('View airport guide');
    expect(source).not.toContain('`/airports/${airport.slug}`');
  });

  it('covers the approved Turkey continuation batch with exact handoffs only', () => {
    const expected: Record<string, string[]> = {
      istanbul: ['manchester', 'birmingham', 'leeds-bradford'],
      dalaman: ['manchester', 'birmingham', 'leeds-bradford', 'bristol', 'glasgow', 'newcastle'],
      bodrum: ['manchester', 'birmingham', 'leeds-bradford', 'glasgow'],
      izmir: ['manchester'],
    };

    for (const [destinationSlug, originSlugs] of Object.entries(expected)) {
      for (const originSlug of originSlugs) {
        const url = getTripComDestinationHandoffUrl(originSlug, destinationSlug);
        expect(url, `${originSlug}-${destinationSlug}`).toMatch(
          /^https:\/\/www\.trip\.com\/flights\/.+\?flighttype=S&dcity=[A-Z]+&acity=[A-Z]+&locale=en-XX&curr=GBP&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206\d+$/,
        );
        expect(url).not.toContain('ddate=');
        expect(url).not.toContain('rdate=');
      }
    }

    for (const destinationSlug of Object.keys(expected)) {
      expect(getTripComDestinationHandoffUrl('london-gatwick', destinationSlug)).toBeNull();
    }
  });

  it('renders continuation handoffs only for missing route guides and fails closed otherwise', () => {
    const source = readFileSync(join(process.cwd(), 'components/destination/destination-flight-guides.tsx'), 'utf8');
    expect(source).toContain('getTripComDestinationHandoffUrl');
    expect(source).toContain('Check live flights on Trip.com');
    expect(source).toContain('<AffiliateLinkDisclosure providerName="Trip.com"');
    expect(source).toContain('entry.href');
    expect(source).toContain('blocked');
    expect(source).not.toContain('`/airports/${entry.airport.slug}`');
  });

  it('covers the approved Morocco continuation batch and keeps unsupported origins blocked', () => {
    const expected: Record<string, string[]> = {
      marrakech: ['manchester', 'bristol'],
      agadir: ['manchester', 'birmingham'],
    };

    for (const [destinationSlug, originSlugs] of Object.entries(expected)) {
      for (const originSlug of originSlugs) {
        const url = getTripComDestinationHandoffUrl(originSlug, destinationSlug);
        expect(url, `${originSlug}-${destinationSlug}`).toMatch(
          /^https:\/\/www\.trip\.com\/flights\/.+\?flighttype=S&dcity=[A-Z]+&acity=[A-Z]+&locale=en-XX&curr=GBP&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602$/,
        );
        expect(url).not.toContain('ddate=');
        expect(url).not.toContain('rdate=');
      }
    }

    expect(getTripComDestinationHandoffUrl('london-gatwick', 'marrakech')).toBeNull();
    expect(getTripComDestinationHandoffUrl('london-gatwick', 'agadir')).toBeNull();
    expect(getTripComDestinationHandoffUrl('london-heathrow', 'casablanca')).toBeNull();
    expect(getTripComDestinationHandoffUrl('london-gatwick', 'tangier')).toBeNull();
  });

  it('keeps the eight Morocco route guides evidence-bounded and preserves their booking boundaries', () => {
    const expected = [
      ['manchester-marrakech', 'manchester', 'marrakech'],
      ['bristol-marrakech', 'bristol', 'marrakech'],
      ['london-gatwick-marrakech', 'london-gatwick', 'marrakech'],
      ['manchester-agadir', 'manchester', 'agadir'],
      ['birmingham-agadir', 'birmingham', 'agadir'],
      ['london-gatwick-agadir', 'london-gatwick', 'agadir'],
      ['london-heathrow-casablanca', 'london-heathrow', 'casablanca'],
      ['london-gatwick-tangier', 'london-gatwick', 'tangier'],
    ] as const;

    for (const [slug, airportSlug, destinationSlug] of expected) {
      const route = getRoutesByDestination(destinationSlug).find((item) => item.slug === slug);
      expect(route, slug).toBeDefined();
      expect(route?.airportSlug).toBe(airportSlug);
      expect(route?.isDirect).toBe(true);
      expect(route?.verification?.status).toBe('verified');
      expect(route?.verification?.sourceUrl).toMatch(/^https:\/\//);
      expect(getDestinationFlightGuideEntries(getDestinationBySlug(destinationSlug)!, NOW_ISO).find((entry) => entry.routeSlug === slug)?.href)
        .toBe(`/routes/${slug}`);
    }

    expect(getTripComDestinationHandoffUrl('manchester', 'marrakech')).toContain('dcity=MAN&acity=RAK');
    expect(getTripComDestinationHandoffUrl('bristol', 'marrakech')).toContain('dcity=BRS&acity=RAK');
    expect(getTripComDestinationHandoffUrl('manchester', 'agadir')).toContain('dcity=MAN&acity=AGA');
    expect(getTripComDestinationHandoffUrl('birmingham', 'agadir')).toContain('dcity=BHX&acity=AGA');
    expect(getTripComDestinationHandoffUrl('london-gatwick', 'marrakech')).toBeNull();
    expect(getTripComDestinationHandoffUrl('london-gatwick', 'agadir')).toBeNull();
    expect(getTripComDestinationHandoffUrl('london-heathrow', 'casablanca')).toBeNull();
    expect(getTripComDestinationHandoffUrl('london-gatwick', 'tangier')).toBeNull();
  });

  it('covers the approved Europe continuation batch and keeps Gatwick origins blocked', () => {
    const expected: Record<string, string[]> = {
      barcelona: ['manchester', 'birmingham', 'bristol', 'leeds-bradford'],
      faro: ['bristol', 'manchester', 'birmingham', 'leeds-bradford'],
      athens: ['manchester', 'birmingham', 'glasgow'],
      rome: ['manchester', 'birmingham', 'bristol'],
    };

    for (const [destinationSlug, originSlugs] of Object.entries(expected)) {
      for (const originSlug of originSlugs) {
        const url = getTripComDestinationHandoffUrl(originSlug, destinationSlug);
        expect(url, `${originSlug}-${destinationSlug}`).toMatch(
          /^https:\/\/www\.trip\.com\/flights\/.+\?flighttype=S&dcity=[A-Z]+&acity=[A-Z]+&locale=en-XX&curr=GBP&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602$/,
        );
        expect(url).not.toContain('ddate=');
        expect(url).not.toContain('rdate=');
      }
    }

    for (const destinationSlug of Object.keys(expected)) {
      expect(getTripComDestinationHandoffUrl('london-gatwick', destinationSlug)).toBeNull();
    }
  });

  it('covers the approved Birmingham continuation batch with exact handoffs only', () => {
    const expected: Record<string, string> = {
      delhi: 'DEL',
      ahmedabad: 'AMD',
      dubai: 'DXB',
      doha: 'DOH',
      jeddah: 'JED',
    };

    for (const [destinationSlug, arrivalCode] of Object.entries(expected)) {
      const url = getTripComDestinationHandoffUrl('birmingham', destinationSlug);
      expect(url, `birmingham-${destinationSlug}`).toMatch(
        new RegExp(`^https://www\\.trip\\.com/flights/Birmingham-to-.+/tickets-BHX-${arrivalCode}\\?flighttype=S&dcity=BHX&acity=${arrivalCode}&locale=en-XX&curr=GBP&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602$`),
      );
      expect(url).not.toContain('ddate=');
      expect(url).not.toContain('rdate=');
    }
  });
});
