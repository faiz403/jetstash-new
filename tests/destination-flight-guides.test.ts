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
    const islamabad = getDestinationFlightGuideEntries(getDestinationBySlug('islamabad')!, NOW_ISO);
    const manchester = islamabad.find((entry) => entry.routeSlug === 'manchester-islamabad')!;
    const birmingham = islamabad.find((entry) => entry.routeSlug === 'birmingham-islamabad')!;

    expect(manchester.routeStatus).toBe('direct');
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
    expect(source).toContain('Partner link, opens Trip.com in a new tab.');
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
