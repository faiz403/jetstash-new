import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { airports, getAirportBySlug } from '@/data/airports';
import { destinations } from '@/data/destinations';
import { getRouteByAirportAndDestination, routes } from '@/data/routes';

/**
 * Trust fix (7 September 2026): London Heathrow's manually maintained
 * `longHaulRoutes` list named Karachi even though JetStash has no canonical
 * LHR-KHI Route record. The airport page renders this list verbatim under
 * "All long-haul routes", so the unqualified entry read as a current route.
 * Earlier Heathrow-Karachi Deal records had already been removed for the
 * same lack of supporting evidence.
 */

const heathrow = getAirportBySlug('london-heathrow')!;
const airportPageSource = readFileSync(join(process.cwd(), 'app/airports/[slug]/page.tsx'), 'utf8');

describe('Heathrow-Karachi airport-list trust fix', () => {
  it('does not present Karachi in Heathrow\'s public long-haul route list', () => {
    expect(airportPageSource).toContain('All long-haul routes');
    expect(airportPageSource).toContain('airport.longHaulRoutes.map');
    expect(heathrow.longHaulRoutes).not.toContain('Karachi');
  });

  it('preserves every other Heathrow long-haul entry and its surrounding airport fields', () => {
    expect(heathrow.longHaulRoutes).toEqual(['Delhi', 'Mumbai', 'Lahore', 'Dubai', 'Doha', 'Jeddah', 'Madinah']);
    expect(heathrow.name).toBe('London Heathrow');
    expect(heathrow.code).toBe('LHR');
    expect(heathrow.city).toBe('London');
    expect(heathrow.shortHaulHighlights).toEqual(['Rome', 'Lisbon', 'Athens']);
    expect(heathrow.hasDirectLongHaul).toBe(true);
  });

  it('does not add or alter route inventory to manufacture LHR-KHI support', () => {
    expect(routes).toHaveLength(88);
    expect(getRouteByAirportAndDestination('london-heathrow', 'karachi')).toBeUndefined();
    expect(getRouteByAirportAndDestination('london-heathrow', 'lahore')?.slug).toBe('london-heathrow-lahore');
    expect(getRouteByAirportAndDestination('london-heathrow', 'jeddah')?.slug).toBe('london-heathrow-jeddah');
  });

  it('does not alter destination inventory', () => {
    expect(destinations).toHaveLength(27);
    expect(destinations.find((destination) => destination.slug === 'karachi')).toMatchObject({
      iataCode: 'KHI',
      city: 'Karachi',
      country: 'Pakistan',
      region: 'pakistan',
    });
  });

  it('does not alter any unrelated airport route list', () => {
    expect(
      airports
        .filter((airport) => airport.slug !== 'london-heathrow')
        .map((airport) => [airport.slug, airport.longHaulRoutes]),
    ).toEqual([
      ['manchester', ['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi']],
      ['birmingham', ['Dubai', 'Sharjah', 'Doha']],
      ['london-gatwick', ['Dubai', 'Doha', 'Amritsar']],
      ['birmingham-east-midlands', ['Dubai (via connection)']],
      ['leeds-bradford', ['Dubai (via connection)', 'Islamabad (via connection)']],
      ['glasgow', ['Dubai']],
      ['bristol', ['Dubai (via connection)']],
      ['liverpool', ['Dubai (via connection)', 'Islamabad (via connection)']],
      ['newcastle', ['Dubai']],
      ['edinburgh', ['Dubai']],
    ]);
  });
});
