import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { airports, getAirportBySlug } from '@/data/airports';
import { destinations } from '@/data/destinations';
import { getRouteByAirportAndDestination, routes } from '@/data/routes';

/**
 * Trust fix (7 September 2026): Birmingham's manually maintained
 * `longHaulRoutes` list named Sharjah even though JetStash has no canonical
 * BHX-SHJ Route record and current evidence supports connecting itineraries,
 * not a Birmingham-Sharjah nonstop service. The airport page renders this
 * list verbatim under "All long-haul routes", so the unqualified entry read
 * as a current route.
 */

const birmingham = getAirportBySlug('birmingham')!;
const airportPageSource = readFileSync(join(process.cwd(), 'app/airports/[slug]/page.tsx'), 'utf8');

describe('Birmingham-Sharjah airport-list trust fix', () => {
  it('does not expose Sharjah in Birmingham\'s public long-haul route list', () => {
    expect(airportPageSource).toContain('All long-haul routes');
    expect(airportPageSource).toContain('airport.longHaulRoutes.map');
    expect(birmingham.longHaulRoutes).not.toContain('Sharjah');
  });

  it('preserves Birmingham\'s valid Dubai and Doha entries without adding a replacement', () => {
    expect(birmingham.longHaulRoutes).toEqual(['Dubai', 'Doha']);
    expect(birmingham.longHaulRoutes).toContain('Dubai');
    expect(birmingham.longHaulRoutes).toContain('Doha');
  });

  it('preserves Birmingham\'s surrounding airport fields', () => {
    expect(birmingham.name).toBe('Birmingham Airport');
    expect(birmingham.code).toBe('BHX');
    expect(birmingham.city).toBe('Birmingham');
    expect(birmingham.shortHaulHighlights).toEqual(['Malaga', 'Faro', 'Alicante', 'Antalya', 'Bodrum']);
    expect(birmingham.hasDirectLongHaul).toBe(true);
  });

  it('does not add or alter route inventory to manufacture BHX-SHJ support', () => {
    expect(routes).toHaveLength(88);
    expect(getRouteByAirportAndDestination('birmingham', 'sharjah')).toBeUndefined();
    expect(getRouteByAirportAndDestination('birmingham', 'dubai')?.slug).toBe('birmingham-dubai');
    expect(getRouteByAirportAndDestination('birmingham', 'doha')?.slug).toBe('birmingham-doha');
  });

  it('does not alter destination inventory', () => {
    expect(destinations).toHaveLength(27);
    expect(destinations.some((destination) => destination.slug === 'sharjah')).toBe(false);
    expect(destinations.find((destination) => destination.slug === 'dubai')).toMatchObject({ city: 'Dubai', region: 'gulf' });
    expect(destinations.find((destination) => destination.slug === 'doha')).toMatchObject({ city: 'Doha', region: 'gulf' });
  });

  it('does not add, remove, or rename unrelated airport records', () => {
    expect(airports).toHaveLength(11);
    expect(airports.filter((airport) => airport.slug !== 'birmingham').map((airport) => airport.slug)).toEqual([
      'manchester',
      'london-heathrow',
      'london-gatwick',
      'birmingham-east-midlands',
      'leeds-bradford',
      'glasgow',
      'bristol',
      'liverpool',
      'newcastle',
      'edinburgh',
    ]);
    expect(getAirportBySlug('manchester')?.longHaulRoutes).toEqual(['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi']);
    expect(getAirportBySlug('london-gatwick')?.longHaulRoutes).toEqual(['Dubai', 'Doha', 'Amritsar']);
  });
});
