import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getRoutesByDestination } from '@/data/routes';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';

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
});
