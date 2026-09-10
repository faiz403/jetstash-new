import { describe, it, expect } from 'vitest';
import { airports, getAirportBySlug } from '@/data/airports';
import { getRouteBySlug } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Trust fix (6 Sept 2026, flagged during the Manchester airport audit,
 * implemented separately per founder instruction): Gatwick's own
 * `longHaulRoutes` list (data/airports.ts) still named 'Ahmedabad' as an
 * established long-haul destination, even though london-gatwick-ahmedabad
 * became `verification.status: 'unverified'` on 4 September 2026 (Rolling
 * Reverification Batch 4 — Air India's own current surfaces genuinely
 * conflict over which London airport this service uses). This is the
 * identical class of staleness Route Verification Batch 2 (19 Aug 2026)
 * already fixed once for this exact field (removing Manchester's
 * 'Karachi' and Birmingham's 'Islamabad'), but Gatwick's own unverified
 * status postdated that cleanup pass, so it was never caught then.
 *
 * These tests deliberately compare the list against the route's actual
 * effective presentation (getEffectiveRoutePresentation(), the same
 * function the route page itself calls) rather than a hardcoded string,
 * so they keep failing correctly if this route's verification state ever
 * changes again.
 */

const NOW_ISO = '2026-09-06';
const gatwickAirport = getAirportBySlug('london-gatwick')!;
const lgwAmd = getRouteBySlug('london-gatwick-ahmedabad')!;
const presentation = getEffectiveRoutePresentation(lgwAmd, routeStatusEvents, NOW_ISO);

describe('1. Canonical LGW-Ahmedabad state remains unverified', () => {
  it('the route\'s own effective presentation is "Verification pending", not "Direct"', () => {
    expect(presentation.status).toBe('unverified');
    expect(presentation.statusLabel).toBe('Verification pending');
  });
});

describe('2. Gatwick\'s longHaulRoutes no longer lists Ahmedabad as an established route', () => {
  it('Ahmedabad is removed, not replaced with another destination', () => {
    expect(gatwickAirport.longHaulRoutes).not.toContain('Ahmedabad');
    expect(gatwickAirport.longHaulRoutes).toEqual(['Dubai', 'Doha', 'Amritsar']);
  });

  it('Gatwick\'s genuinely current direct destinations are preserved, not collateral damage', () => {
    expect(gatwickAirport.longHaulRoutes).toContain('Dubai');
    expect(gatwickAirport.longHaulRoutes).toContain('Doha');
    expect(gatwickAirport.longHaulRoutes).toContain('Amritsar');
    expect(gatwickAirport.hasDirectLongHaul).toBe(true);
  });
});

describe('3. Gatwick\'s already-correct hedged prose is preserved unchanged', () => {
  it('description and whyThisAirport still correctly hedge Ahmedabad as disputed, untouched by this fix', () => {
    expect(gatwickAirport.description).toContain('currently disputed Ahmedabad service');
    expect(gatwickAirport.whyThisAirport).toMatch(/genuine, unresolved conflict/i);
    expect(gatwickAirport.whyThisAirport).toContain('confirmed direct Amritsar service');
  });
});

describe('4. No route verification data changed — this is an airport-list-only fix', () => {
  it('london-gatwick-ahmedabad route record (isDirect, verification, flightTime, frequency, airlineSlugs) is unchanged', () => {
    expect(lgwAmd.isDirect).toBe(true);
    expect(lgwAmd.verification?.status).toBe('unverified');
    expect(lgwAmd.flightTime).toBe('Unverified — genuinely conflicting sources, see note');
    expect(lgwAmd.airlineSlugs).toEqual(['air-india']);
  });
});

describe('5. No unrelated airport data changed', () => {
  it('preserves the separately verified Manchester and Birmingham route lists', () => {
    const others = airports.filter((a) => a.slug !== 'london-gatwick');
    expect(others).toHaveLength(10);
    const manchester = others.find((a) => a.slug === 'manchester')!;
    const birmingham = others.find((a) => a.slug === 'birmingham')!;
    expect(manchester.longHaulRoutes).toEqual(['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi']);
    expect(birmingham.longHaulRoutes).toEqual(['Dubai', 'Doha']);
  });

  it('Gatwick\'s other fields (name, code, city, servesCommunities, shortHaulHighlights) are unchanged', () => {
    expect(gatwickAirport.name).toBe('London Gatwick');
    expect(gatwickAirport.code).toBe('LGW');
    expect(gatwickAirport.servesCommunities).toEqual(['South London', 'Croydon', 'Surrey', 'Sussex']);
    expect(gatwickAirport.shortHaulHighlights).toEqual(['Barcelona', 'Rome', 'Malaga', 'Antalya', 'Agadir', 'Tangier']);
  });
});
