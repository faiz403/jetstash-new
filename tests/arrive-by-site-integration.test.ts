import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPublicJourneyRoutePair, getPublicJourneyRoutePairs } from '@/lib/arrive-by-journey/public-route-pairs';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const page = read('app', 'arrive-by', 'page.tsx');
const fullJourney = read('components', 'arrive-by-full-journey.tsx');
const routePage = read('app', 'routes', '[slug]', 'page.tsx');
const homepage = read('components', 'homepage-v2', 'homepage-sections.tsx');

describe('Arrive By final site integration', () => {
  it('exposes only verified public route pairs for contextual route panels', () => {
    const pairs = getPublicJourneyRoutePairs();
    expect(pairs.length).toBeGreaterThan(0);
    expect(getPublicJourneyRoutePair('MAN', 'ISB')).toMatchObject({ routeSlug: 'manchester-islamabad' });
    expect(getPublicJourneyRoutePair('MAN', 'DXB')).toBeUndefined();
  });

  it('accepts an allowlisted full-journey airport pair without changing the legacy airport-only dispatch', () => {
    expect(page).toContain('initialAirportPair');
    expect(page).toContain('requestedDeparture');
    expect(page).toContain('requestedArrival');
    expect(page).toContain('getShellAirportLookup');
    expect(page).toContain('airport?: string | string[]');
  });

  it('keeps the route continuation internal and exposes an edit path', () => {
    expect(fullJourney).toContain('View {matchedRoute.departureLabel} → {matchedRoute.arrivalLabel} route information');
    expect(fullJourney).toContain('href={`/routes/${matchedRoute.routeSlug}`}');
    expect(fullJourney).toContain('Edit journey details');
    expect(fullJourney).not.toMatch(/Trip\.com|affiliate/i);
  });

  it('limits route panels to public capability-backed pairs and keeps homepage discovery secondary', () => {
    expect(routePage).toContain('getPublicJourneyRoutePair(airport.code, dest.iataCode)');
    expect(routePage).toContain('ArriveByRoutePanel');
    expect(homepage).toContain("title: 'Need to be somewhere by a certain time?'");
    expect(homepage).toContain("href: '/arrive-by'");
  });

  it('retains capability-specific form guidance and an explicit no-flight-lookup boundary', () => {
    expect(fullJourney).toContain('Your journey to the airport');
    expect(fullJourney).toContain('Your flight');
    expect(fullJourney).toContain('After you land');
    expect(fullJourney).toContain('Arrive By does not track a live flight');
    expect(fullJourney).toContain("arrivalEngine === 'TRANSIT_FIRST'");
  });
});
