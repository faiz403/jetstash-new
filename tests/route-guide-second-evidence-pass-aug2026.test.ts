import { describe, expect, it } from 'vitest';
import { getRouteBySlug, getRoutePresentation, getDisplayDirectness } from '@/data/routes';
import { getTripComRouteUrl, getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { computeRouteIntelligenceLevel, buildAtlasAirports } from '@/lib/atlas-network-data';

/**
 * Final Route-Guide Completion — second evidence pass (13 August 2026).
 *
 * The first pass wrongly treated a 403 from direct WebFetch as an evidence
 * blocker for several routes whose own official pages are reachable via
 * search-indexed content even when direct fetch is blocked. Re-opened per
 * founder instruction; six of the ten previously-blocked pairs were built:
 * birmingham-dubai, birmingham-doha, birmingham-jeddah,
 * london-heathrow-dubai, birmingham-delhi and birmingham-ahmedabad (both
 * genuine, deliberately preserved evidence conflicts). This suite is the
 * regression guard for the patterns specific to this batch — general Route
 * Intelligence wiring is already covered by
 * atlas-route-intelligence-completion-aug2026.test.ts and
 * site-wide-route-intelligence-completion-aug2026.test.ts.
 *
 * FINAL AMEND (13 August 2026, founder review): birmingham-ahmedabad was
 * originally built as a settled `isDirect: false` connecting route on the
 * assumption that Air India's own current page was a clean, unconflicted
 * "0 direct flights" confirmation. The founder independently found that
 * page is internally self-contradictory — its marketing copy references a
 * direct flight while its own structured route information/FAQ says 0
 * direct flights — so it was corrected to the same `isDirect: true` +
 * `verification.status: 'unverified'` treatment already used for
 * birmingham-delhi, per the standing "genuine dispute stays isDirect: true"
 * rule (matches the Manchester–Sylhet precedent). The same amendment added
 * Birmingham Airport's current Delhi destination page (Air India, direct,
 * ~7h55) to birmingham-delhi's evidence record, without resolving that
 * conflict either.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);
const SECOND_PASS_SLUGS = ['birmingham-dubai', 'birmingham-doha', 'birmingham-jeddah', 'london-heathrow-dubai', 'birmingham-delhi', 'birmingham-ahmedabad'];

describe('All six second-pass routes exist with the correct evidence-driven shape', () => {
  it('birmingham-dubai, birmingham-doha, birmingham-jeddah, london-heathrow-dubai are verified direct', () => {
    for (const slug of ['birmingham-dubai', 'birmingham-doha', 'birmingham-jeddah', 'london-heathrow-dubai']) {
      const route = getRouteBySlug(slug)!;
      expect(route, slug).toBeDefined();
      expect(route.isDirect, slug).toBe(true);
      expect(route.verification?.status, slug).toBe('verified');
    }
  });

  it('every second-pass route slug resolves through data/routes.ts (not silently missing)', () => {
    for (const slug of SECOND_PASS_SLUGS) {
      expect(getRouteBySlug(slug), slug).toBeDefined();
    }
  });
});

describe('birmingham-delhi preserves the genuine Air India evidence conflict — never silently resolved', () => {
  const route = getRouteBySlug('birmingham-delhi')!;

  it('is marked unverified, not verified either way', () => {
    expect(route.verification?.status).toBe('unverified');
    expect(route.isDirect).toBe(true); // standing "genuine dispute stays isDirect: true" rule
  });

  it('getDisplayDirectness() correctly reports this as unverified, never a resolved direct claim', () => {
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('unverified');
  });

  it('the intro states both conflicting claims explicitly, never picking one silently', () => {
    const introLower = route.intro.toLowerCase();
    expect(introLower).toContain('0 direct flights');
    expect(introLower).toMatch(/ai114|nonstop/);
    expect(introLower).toMatch(/contradiction|conflict|disagree/);
  });

  it('the verification note documents Birmingham Airport\'s historical claim, its current Delhi destination page, and Air India\'s own current live page, without resolving them', () => {
    const note = route.verification?.note ?? '';
    expect(note).toContain('2019');
    expect(note.toLowerCase()).toContain('0 direct flights');
    expect(note.toLowerCase()).toMatch(/7 hours 55 minutes|7h55/);
    expect(note.toLowerCase()).toContain('current delhi destination page');
  });

  it('Route Intelligence still grades it (Useful) — an unverified route never silently drops out of the system', () => {
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });
});

describe('birmingham-ahmedabad preserves the genuine, internal Air India evidence conflict — never silently resolved (corrected 13 August 2026 founder amendment)', () => {
  const route = getRouteBySlug('birmingham-ahmedabad')!;

  it('is marked unverified, not a settled connecting claim', () => {
    expect(route.verification?.status).toBe('unverified');
    expect(route.isDirect).toBe(true); // standing "genuine dispute stays isDirect: true" rule
  });

  it('getDisplayDirectness() correctly reports this as unverified, never a resolved direct or connecting claim', () => {
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('unverified');
  });

  it('the intro states the internal self-contradiction explicitly, never silently picking a side', () => {
    const introLower = route.intro.toLowerCase();
    expect(introLower).toContain('0 direct flights');
    expect(introLower).toMatch(/direct flight/);
    expect(introLower).toMatch(/contradiction|conflict|disagree|inconsisten/);
  });

  it('names no specific connecting hub — no authoritative evidence confirmed one', () => {
    expect(route.connectingAlternative).toBeUndefined();
    for (const hub of ['Delhi', 'Mumbai', 'via Delhi', 'via Mumbai']) {
      expect(route.intro.toLowerCase(), hub).not.toContain(hub.toLowerCase());
    }
  });

  it('the verification note documents the marketing-copy-vs-structured-data contradiction on a single Air India page, without resolving it', () => {
    const note = route.verification?.note ?? '';
    expect(note.toLowerCase()).toContain('0 direct flights');
    expect(note.toLowerCase()).toMatch(/marketing copy/);
    expect(note.toLowerCase()).toMatch(/faq/);
  });

  it('Route Intelligence still grades it (Useful) — an unverified route never silently drops out of the system', () => {
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });
});

describe('No invented Trip.com links for any of the six second-pass routes', () => {
  it('none of the six has a NEW route-level TRIPCOM_ROUTE_URLS entry — no dashboard-generated link was fabricated for this batch', () => {
    for (const slug of SECOND_PASS_SLUGS) {
      expect(getTripComRouteUrl(slug), slug).toBeNull();
    }
  });

  it('london-heathrow-dubai (London-origin) correctly has no Trip.com handoff at all — no LON fallback', () => {
    const route = getRouteBySlug('london-heathrow-dubai')!;
    expect(getTripComFlightHandoffUrl(route.slug, route.airportSlug, route.destinationSlug)).toBeNull();
  });

  it('the five Birmingham routes correctly surface their real, PRE-EXISTING TRIPCOM_DESTINATION_URLS handoff (genuine dashboard-generated links that already existed for these exact pairs before this batch, previously only reachable via the destination-page Trip.com fallback) — not a new or invented link', () => {
    for (const slug of ['birmingham-dubai', 'birmingham-doha', 'birmingham-jeddah', 'birmingham-delhi', 'birmingham-ahmedabad']) {
      const route = getRouteBySlug(slug)!;
      const handoff = getTripComFlightHandoffUrl(route.slug, route.airportSlug, route.destinationSlug);
      expect(handoff, slug).not.toBeNull();
      expect(handoff, slug).toContain('trip.com/flights/Birmingham-to-');
      expect(handoff, slug).toContain('Allianceid=9804124');
    }
  });
});

describe('Route Intelligence is wired for every second-pass route on the Atlas', () => {
  const airports = buildAtlasAirports();
  const trackedBySlug = new Map<string, { routeHref: string | null }>();
  for (const airport of airports) {
    for (const country of airport.countries) {
      for (const dest of country.destinations) {
        trackedBySlug.set(`${airport.airportSlug}-${dest.slug}`, { routeHref: dest.routeHref });
      }
    }
  }

  it('every second-pass route has a tracked (non-null routeHref) Atlas point', () => {
    for (const slug of SECOND_PASS_SLUGS) {
      expect(trackedBySlug.get(slug)?.routeHref, slug).toBe(`/routes/${slug}`);
    }
  });

  it('Birmingham\'s Atlas network now includes UAE and Qatar country groups (previously absent)', () => {
    const birmingham = airports.find((a) => a.airportSlug === 'birmingham')!;
    const countrySlugs = birmingham.countries.map((c) => c.slug);
    expect(countrySlugs).toContain('uae');
    expect(countrySlugs).toContain('qatar');
  });
});

describe('The London Heathrow/Gatwick metadata-title collision is fixed for Dubai, without affecting non-colliding London routes', () => {
  it('london-heathrow-dubai and london-gatwick-dubai have different metadata titles', () => {
    const heathrow = getRoutePresentation(getRouteBySlug('london-heathrow-dubai')!, NOW_ISO);
    const gatwick = getRoutePresentation(getRouteBySlug('london-gatwick-dubai')!, NOW_ISO);
    expect(heathrow.metadataTitle).not.toBe(gatwick.metadataTitle);
    expect(heathrow.metadataTitle).toContain('London Heathrow');
    expect(gatwick.metadataTitle).toContain('London Gatwick');
  });

  it('a non-colliding London route (e.g. london-heathrow-lahore, the only London route to Lahore) still uses the plain "London" origin, not the longer disambiguated form', () => {
    const presentation = getRoutePresentation(getRouteBySlug('london-heathrow-lahore')!, NOW_ISO);
    expect(presentation.metadataTitle).toContain('London to Lahore');
    expect(presentation.metadataTitle).not.toContain('London Heathrow to Lahore');
  });

  it('the visible H1/breadcrumb pair (not the <title>) is unaffected — still the plain city name for both Dubai routes', () => {
    // getRoutePresentation's `summary`/other visible fields are untouched by the
    // title-disambiguation fix; the fix is scoped to metadataTitle only, and the
    // route page itself builds its H1 directly from airport.city, not from this
    // presentation object's metadataTitle.
    const heathrow = getRoutePresentation(getRouteBySlug('london-heathrow-dubai')!, NOW_ISO);
    const gatwick = getRoutePresentation(getRouteBySlug('london-gatwick-dubai')!, NOW_ISO);
    expect(heathrow.shareText).not.toContain('London Heathrow to Dubai');
    expect(gatwick.shareText).not.toContain('London Gatwick to Dubai');
  });
});
