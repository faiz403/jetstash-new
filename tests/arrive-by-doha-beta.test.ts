import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { ARRIVE_BY_RELEASED_AIRPORTS } from '@/lib/arrive-by-shared/airport-release';
import { ROAD_CAPABILITY_EVIDENCE, getAirportCapability, resolveAirportProfile } from '@/lib/arrive-by-shared/airport-capability';
import { getArrivalAirportOptions } from '@/lib/arrive-by-journey/airport-options';
import { describeOnwardCoverage } from '@/lib/arrive-by-journey/coverage-copy';
import { getPublicJourneyRoutePairs, isRouteCurrentForArriveBy } from '@/lib/arrive-by-journey/public-route-pairs';
import { resolveJourneyAirports } from '@/lib/arrive-by-journey/airports';
import { mainNav } from '@/lib/site-config';

// Doha-only public beta (founder direction, 21 October 2026). Fixed dates only.
const BUILT = '2026-10-21';
const LAST_RELEASE_DAY = '2026-12-29';
const AFTER_REVIEW = '2026-12-30';
const atDate = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${iso}T12:00:00Z`));
};
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

afterEach(() => { vi.useRealTimers(); });

describe('Doha release entry', () => {
  it('releases only Doha, as a public beta bound to a 90-day evidence review', () => {
    expect(Object.keys(ARRIVE_BY_RELEASED_AIRPORTS)).toEqual(['DOH']);
    expect(ARRIVE_BY_RELEASED_AIRPORTS.DOH.status).toBe('public_beta');
    const evidence = ROAD_CAPABILITY_EVIDENCE.DOH;
    expect(evidence).toMatchObject({ status: 'road_supported', checks: { identityVerified: true, routeProbed: true } });
    const days = (Date.parse(ARRIVE_BY_RELEASED_AIRPORTS.DOH.evidenceReviewDueDate) - Date.parse(evidence.verifiedDate)) / 86_400_000;
    expect(days).toBe(90);
  });

  it('is road-only, airport-level and limited to destinations in Qatar', () => {
    const profile = resolveAirportProfile('DOH')!;
    expect(profile.journeyEngine).toBe('ROAD_PICKUP_FIRST');
    expect(profile.routing.originPrecision).toBe('airport');
    expect(profile.destinationRules.expectedCountryCodes).toEqual(['QA']);
  });

  it('uses Asia/Qatar, a fixed UTC+3 zone with no daylight saving (checked offline)', () => {
    expect(resolveAirportProfile('DOH')!.timeZone).toBe('Asia/Qatar');
    const offset = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', timeZoneName: 'longOffset' })
      .formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName')!.value;
    expect(offset('2026-01-15T12:00:00Z')).toBe('GMT+03:00');
    expect(offset('2026-07-15T12:00:00Z')).toBe('GMT+03:00');
  });

  it('is offered and accepted while released, and refused (fail closed) the day after its review date', () => {
    atDate(LAST_RELEASE_DAY);
    expect(getAirportCapability('DOH')?.journeyEligible).toBe(true);
    expect(getArrivalAirportOptions('public').map((a) => a.code)).toContain('DOH');
    expect(resolveJourneyAirports('LHR', 'DOH', 'public', 'LIVE').ok).toBe(true);

    atDate(AFTER_REVIEW);
    expect(getAirportCapability('DOH')?.journeyEligible).toBe(false);
    expect(getArrivalAirportOptions('public').map((a) => a.code)).not.toContain('DOH');
    expect(resolveJourneyAirports('LHR', 'DOH', 'public', 'LIVE')).toMatchObject({ ok: false, reason: 'AIRPORT_NOT_SUPPORTED' });
  });

  it('releases no other evidenced airport', () => {
    atDate(BUILT);
    for (const code of ['DXB', 'DEL', 'BOM', 'AMD', 'DAC', 'LHR']) expect(getAirportCapability(code)?.journeyEligible, code).toBe(false);
  });
});

describe('route-page entry points follow the route page itself', () => {
  it('shows Arrive By only on routes presented as Direct or Connecting', () => {
    atDate(BUILT);
    const slugs = getPublicJourneyRoutePairs(BUILT).map((p) => p.routeSlug);
    expect(slugs).toEqual(expect.arrayContaining(['london-heathrow-doha', 'manchester-doha', 'birmingham-doha']));
    // Gatwick-Doha is shown as unverified, so it gets no entry point despite both airports being supported.
    expect(slugs).not.toContain('london-gatwick-doha');
    for (const pair of getPublicJourneyRoutePairs(BUILT)) expect(isRouteCurrentForArriveBy(getRouteBySlug(pair.routeSlug)!, BUILT), pair.routeSlug).toBe(true);
  });

  it('never points a service-ended route to Arrive By', () => {
    expect(isRouteCurrentForArriveBy(getRouteBySlug('manchester-delhi')!, BUILT)).toBe(false);
    expect(isRouteCurrentForArriveBy(getRouteBySlug('manchester-mumbai')!, BUILT)).toBe(false);
  });

  it('drops a Doha entry point when the release lapses, even while its route still presents as Direct', () => {
    // Route presentation is pinned to 20 Nov (Birmingham-Doha is Direct then); only the release clock moves.
    const presentationDate = '2026-11-20';
    atDate(LAST_RELEASE_DAY);
    expect(getPublicJourneyRoutePairs(presentationDate).map((p) => p.routeSlug)).toContain('birmingham-doha');
    atDate(AFTER_REVIEW);
    expect(getPublicJourneyRoutePairs(presentationDate).some((p) => p.arrivalAirport === 'DOH')).toBe(false);
  });
});

describe('planner wording', () => {
  it('names supported arrivals from the live options and says which are road-only', () => {
    expect(describeOnwardCoverage([
      { city: 'Manchester', journeyEngine: 'TRANSIT_FIRST' },
      { city: 'Lahore', journeyEngine: 'ROAD_PICKUP_FIRST' },
      { city: 'Doha', journeyEngine: 'ROAD_PICKUP_FIRST' },
      { city: 'Islamabad', journeyEngine: 'ROAD_PICKUP_FIRST' },
    ])).toBe('Onward planning currently supports arrivals at Manchester (public transport, with a driving option); and Doha, Islamabad and Lahore (road only: driving or pickup, no public transport).');
    expect(describeOnwardCoverage([])).toBe('Onward planning is not available for any arrival airport at the moment.');
  });

  it('the shipped planner copy includes Doha while released and is generated, not hardcoded', () => {
    atDate(BUILT);
    expect(describeOnwardCoverage(getArrivalAirportOptions('public'))).toContain('Doha, Islamabad, Karachi and Lahore (road only');
    const planner = read('components', 'arrive-by-full-journey.tsx');
    expect(planner).toContain('describeOnwardCoverage(arrivalAirports)');
    expect(planner).not.toContain('supports Manchester, Islamabad, Lahore and Karachi');
  });
});

describe('discoverability without indexing', () => {
  it('adds Arrive By to the shared desktop and mobile navigation', () => {
    expect(mainNav).toContainEqual({ label: 'Arrive By', href: '/arrive-by' });
    const header = read('components', 'layout', 'header.tsx');
    expect(header.match(/mainNav\.map/g)).toHaveLength(2);
  });

  it('keeps /arrive-by noindex and out of the sitemap', () => {
    expect(read('app', 'arrive-by', 'page.tsx')).toContain('robots: { index: false, follow: true }');
    expect(read('app', 'sitemap.ts')).not.toContain('/arrive-by');
  });
});
