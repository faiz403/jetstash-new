import { describe, expect, it } from 'vitest';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getRouteBySlug, getRoutePresentation, routes } from '@/data/routes';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getDestinationBySlug } from '@/data/destinations';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';

const NOW_ISO = '2026-08-12';

const BUILT = [
  'leeds-bradford-antalya',
  'leeds-bradford-dalaman',
  'leeds-bradford-bodrum',
  'glasgow-antalya',
  'glasgow-dalaman',
  'glasgow-bodrum',
  'bristol-antalya',
  'bristol-dalaman',
  'newcastle-dalaman',
  'london-gatwick-istanbul',
  'london-gatwick-antalya',
  'london-gatwick-dalaman',
  'london-gatwick-bodrum',
  'london-gatwick-izmir',
] as const;

describe('remaining Turkey route guides', () => {
  it('adds exactly the fourteen evidence-backed guides, leaving Leeds Bradford-Istanbul unbuilt', () => {
    expect(BUILT.every((slug) => getRouteBySlug(slug))).toBe(true);
    expect(getRouteBySlug('leeds-bradford-istanbul')).toBeUndefined();
    expect(routes.filter((route) => route.destinationSlug === 'istanbul' && route.airportSlug === 'leeds-bradford')).toHaveLength(0);
  });

  it('keeps all fourteen new routes direct and currently verified', () => {
    // Route Intelligence Freshness rolling-review Batch 3 (4 September
    // 2026): london-gatwick-istanbul was reconfirmed and its verifiedDate
    // moved -- the other thirteen were not part of that batch and are
    // unchanged, deliberately no longer sharing one synchronised date.
    // Rolling Reverification Batch 5 (4 September 2026): glasgow-antalya and
    // glasgow-dalaman were both reconfirmed and reclassified STABLE
    // (90-day window) -- the remaining eleven were not part of that batch.
    // Rolling Reverification Batch 6 (4 September 2026): leeds-bradford-
    // antalya, leeds-bradford-bodrum, glasgow-bodrum, bristol-antalya,
    // bristol-dalaman, newcastle-dalaman and london-gatwick-antalya were
    // all reconfirmed -- leeds-bradford-dalaman, london-gatwick-dalaman,
    // london-gatwick-bodrum and london-gatwick-izmir were not part of
    // this batch.
    const reverifiedDates: Partial<Record<(typeof BUILT)[number], string>> = {
      'london-gatwick-istanbul': '2026-09-04',
      'glasgow-antalya': '2026-09-04',
      'glasgow-dalaman': '2026-09-04',
      'leeds-bradford-antalya': '2026-09-04',
      'leeds-bradford-bodrum': '2026-09-04',
      'glasgow-bodrum': '2026-09-04',
      'bristol-antalya': '2026-09-04',
      'bristol-dalaman': '2026-09-04',
      'newcastle-dalaman': '2026-09-04',
      'london-gatwick-antalya': '2026-09-04',
    };
    for (const slug of BUILT) {
      const route = getRouteBySlug(slug)!;
      expect(route.isDirect, slug).toBe(true);
      expect(route.verification?.status, slug).toBe('verified');
      expect(route.verification?.verifiedDate, slug).toBe(reverifiedDates[slug] ?? NOW_ISO);
      expect(getRoutePresentation(route, NOW_ISO).status, slug).toBe('direct');
    }
  });

  it('preserves only the facts supported by each airport source', () => {
    // Rolling Reverification Batch 6 (4 September 2026): leeds-bradford-
    // antalya's page names three operators not previously recorded here --
    // this is a genuine evidence upgrade, not a fabricated fact (see that
    // route's own updated verification note).
    const lba = getRoutePresentation(getRouteBySlug('leeds-bradford-antalya')!, NOW_ISO);
    expect(getAirlinesBySlugs(lba.airlineSlugs).map((airline) => airline.name)).toEqual(['Jet2', 'TUI', 'SunExpress']);
    expect(lba.flightTime).toContain('Published duration not listed');
    expect(lba.frequency).toContain('Jet2, TUI and SunExpress');

    const glasgowDalaman = getRoutePresentation(getRouteBySlug('glasgow-dalaman')!, NOW_ISO);
    expect(getAirlinesBySlugs(glasgowDalaman.airlineSlugs).map((airline) => airline.name)).toEqual(['TUI', 'Jet2', 'easyJet']);
    expect(glasgowDalaman.flightTime).toContain('4h 42m');

    const glasgowBodrum = getRoutePresentation(getRouteBySlug('glasgow-bodrum')!, NOW_ISO);
    expect(glasgowBodrum.flightTime).toContain('4h 33m');
    expect(glasgowBodrum.frequency).toContain('seasonal direct Jet2');

    // Rolling Reverification Batch 6: bristol-antalya's page also named
    // TUI, Jet2.com and SunExpress alongside easyJet -- a genuine evidence
    // upgrade from the prior "operators vary" framing.
    const bristolAntalya = getRoutePresentation(getRouteBySlug('bristol-antalya')!, NOW_ISO);
    expect(getAirlinesBySlugs(bristolAntalya.airlineSlugs).map((airline) => airline.name)).toEqual(['easyJet', 'TUI', 'Jet2', 'SunExpress']);
    expect(bristolAntalya.frequency).toContain('up to 18 times a week');
    expect(bristolAntalya.summary).not.toMatch(/recommended|best|cheapest|leading/i);

    const newcastleDalaman = getRoutePresentation(getRouteBySlug('newcastle-dalaman')!, NOW_ISO);
    expect(getAirlinesBySlugs(newcastleDalaman.airlineSlugs).map((airline) => airline.name)).toEqual(['SunExpress']);
    expect(newcastleDalaman.frequency).toContain('multiple weekly summer');

    const gatwickIstanbul = getRoutePresentation(getRouteBySlug('london-gatwick-istanbul')!, NOW_ISO);
    expect(getAirlinesBySlugs(gatwickIstanbul.airlineSlugs).map((airline) => airline.name)).toEqual(['Pegasus Airlines']);
    expect(gatwickIstanbul.frequency).toContain('daily direct');
    expect(gatwickIstanbul.summary).toContain('Sabiha Gokcen');
  });

  it('keeps exact Trip.com handoffs on non-London routes and fails closed for all new Gatwick routes', () => {
    for (const slug of BUILT.filter((value) => !value.startsWith('london-gatwick-'))) {
      const url = getTripComFlightHandoffUrl(slug);
      expect(url, slug).toContain('locale=en-XX&curr=GBP');
      expect(url, slug).toContain('Allianceid=9804124');
      expect(url, slug).toContain('SID=327450313');
      expect(url, slug).not.toContain('ddate=');
      expect(url, slug).not.toContain('rdate=');
    }

    for (const slug of BUILT.filter((value) => value.startsWith('london-gatwick-'))) {
      expect(getTripComFlightHandoffUrl(slug), slug).toBeNull();
    }
  });

  it('replaces destination continuation with exactly one route-guide journey for each built pair', () => {
    for (const slug of BUILT) {
      const route = getRouteBySlug(slug)!;
      const destination = getDestinationBySlug(route.destinationSlug)!;
      const entries = getDestinationFlightGuideEntries(destination, NOW_ISO).filter((entry) => entry.airport.slug === route.airportSlug);
      expect(entries, slug).toHaveLength(1);
      expect(entries[0].routeSlug, slug).toBe(slug);
      expect(entries[0].href, slug).toBe(`/routes/${slug}`);
    }
  });
});
