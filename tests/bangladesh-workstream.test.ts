import { describe, it, expect } from 'vitest';
import {
  getRouteBySlug,
  getRouteByAirportAndDestination,
  getRoutesByAirport,
  getRoutesByDestination,
  getDisplayDirectness,
  getRoutePresentation,
} from '@/data/routes';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { getAirlinesBySlugs } from '@/data/airlines';
import { fareObservations } from '@/data/fare-observations';
import { deals } from '@/data/deals';
import { hasVerifiedDeepLink, getRouteBookingUrl } from '@/lib/booking-providers';
import { evaluateTravelReadiness, TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { getRule } from '@/data/travel-ready-rules';
import { getVisaLinkForCountry } from '@/lib/visa-links';
import { regionGroups } from '@/lib/site-config';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import { JourneyDeskHome } from '@/components/homepage-v2/journey-desk-home';
import { JourneyCheckForm } from '@/components/homepage-v2/journey-check-form';
import sitemap from '@/app/sitemap';
import RoutePage from '@/app/routes/[slug]/page';
import DestinationPage from '@/app/destinations/[slug]/page';
import { isValidElement } from 'react';

const FIXED_TODAY = '2026-07-30';
const NOW = new Date('2026-07-30T12:00:00Z');

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { for (const child of node) collectStrings(child, out); return out; }
  if (isValidElement(node)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

/**
 * Finds the first element of the given component type within a tree built
 * by calling a server component directly (same constraint as
 * collectElementTypes elsewhere in this suite: only descends into
 * props.children, so it can locate a child component element itself, but
 * never renders what that child component would itself produce).
 */
function findElementOfType(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementOfType(child, type);
      if (found) return found;
    }
    return null;
  }
  if (isValidElement(node)) {
    if (node.type === type) return node as unknown as { props: Record<string, unknown> };
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) return findElementOfType(children, type);
  }
  return null;
}

describe('BD-001 — Dhaka and Sylhet destination records', () => {
  it('both exist with the expected core fields', () => {
    const dhaka = getDestinationBySlug('dhaka');
    const sylhet = getDestinationBySlug('sylhet');
    expect(dhaka).toBeDefined();
    expect(dhaka!.city).toBe('Dhaka');
    expect(dhaka!.country).toBe('Bangladesh');
    expect(dhaka!.region).toBe('bangladesh');
    expect(dhaka!.iataCode).toBe('DAC');
    expect(sylhet).toBeDefined();
    expect(sylhet!.city).toBe('Sylhet');
    expect(sylhet!.country).toBe('Bangladesh');
    expect(sylhet!.region).toBe('bangladesh');
    expect(sylhet!.iataCode).toBe('ZYL');
  });

  it('destinations.ts contains exactly one entry each, not duplicated', () => {
    expect(destinations.filter((d) => d.slug === 'dhaka')).toHaveLength(1);
    expect(destinations.filter((d) => d.slug === 'sylhet')).toHaveLength(1);
  });

  it('ukAirports reflects exactly the routes actually added — both destinations now have Heathrow and Manchester', () => {
    const dhaka = getDestinationBySlug('dhaka')!;
    const sylhet = getDestinationBySlug('sylhet')!;
    expect(dhaka.ukAirports.slice().sort()).toEqual(['london-heathrow', 'manchester'].sort());
    expect(sylhet.ukAirports.slice().sort()).toEqual(['london-heathrow', 'manchester'].sort());
  });

  it('a new "bangladesh" region group exists and contains both destinations', () => {
    expect(regionGroups.bangladesh).toBeDefined();
    expect(regionGroups.bangladesh.destinationSlugs.slice().sort()).toEqual(['dhaka', 'sylhet'].sort());
  });

  it('the existing Pakistan and India region groups are completely unchanged', () => {
    expect(regionGroups.pakistan.destinationSlugs).toEqual(['lahore', 'islamabad', 'karachi']);
    expect(regionGroups.india.destinationSlugs).toEqual(
      expect.arrayContaining(['delhi', 'mumbai', 'ahmedabad', 'amritsar', 'bengaluru'])
    );
  });
});

const ALL_BANGLADESH_ROUTE_SLUGS = ['london-heathrow-dhaka', 'london-heathrow-sylhet', 'manchester-dhaka', 'manchester-sylhet'];

describe('BD-001 — all four routes added, at the expected slugs (amendment: Heathrow-Sylhet added, correcting the original rejection)', () => {
  it('london-heathrow-dhaka, london-heathrow-sylhet, manchester-dhaka and manchester-sylhet all exist', () => {
    for (const slug of ALL_BANGLADESH_ROUTE_SLUGS) {
      expect(getRouteBySlug(slug)).toBeDefined();
    }
  });

  it('london-heathrow-sylhet resolves via getRouteByAirportAndDestination', () => {
    expect(getRouteByAirportAndDestination('london-heathrow', 'sylhet')?.slug).toBe('london-heathrow-sylhet');
  });

  it('every added route resolves via getRouteByAirportAndDestination, matching getRouteBySlug', () => {
    for (const slug of ALL_BANGLADESH_ROUTE_SLUGS) {
      const bySlug = getRouteBySlug(slug)!;
      const byPair = getRouteByAirportAndDestination(bySlug.airportSlug, bySlug.destinationSlug);
      expect(byPair?.slug).toBe(slug);
    }
  });

  it('getRoutesByDestination returns exactly the expected routes for each destination — nothing extra was added', () => {
    const dhakaRoutes = getRoutesByDestination('dhaka').map((r) => r.slug).sort();
    const sylhetRoutes = getRoutesByDestination('sylhet').map((r) => r.slug).sort();
    expect(dhakaRoutes).toEqual(['london-heathrow-dhaka', 'manchester-dhaka'].sort());
    expect(sylhetRoutes).toEqual(['london-heathrow-sylhet', 'manchester-sylhet'].sort());
  });

  it('getRoutesByAirport includes the new routes for Heathrow and Manchester', () => {
    expect(getRoutesByAirport('london-heathrow').some((r) => r.slug === 'london-heathrow-dhaka')).toBe(true);
    expect(getRoutesByAirport('london-heathrow').some((r) => r.slug === 'london-heathrow-sylhet')).toBe(true);
    expect(getRoutesByAirport('manchester').some((r) => r.slug === 'manchester-dhaka')).toBe(true);
    expect(getRoutesByAirport('manchester').some((r) => r.slug === 'manchester-sylhet')).toBe(true);
  });

  it('no unsupported Birmingham, Glasgow, Leeds Bradford or Newcastle route to Dhaka or Sylhet exists', () => {
    for (const airportSlug of ['birmingham', 'glasgow', 'leeds-bradford', 'newcastle']) {
      expect(getRouteByAirportAndDestination(airportSlug, 'dhaka')).toBeUndefined();
      expect(getRouteByAirportAndDestination(airportSlug, 'sylhet')).toBeUndefined();
    }
  });

  it('Biman Bangladesh Airlines exists in the airline registry and is the only airline named on every Bangladesh route', () => {
    const airline = getAirlinesBySlugs(['biman-bangladesh']);
    expect(airline).toHaveLength(1);
    expect(airline[0].iataCode).toBe('BG');
    for (const slug of ALL_BANGLADESH_ROUTE_SLUGS) {
      const route = getRouteBySlug(slug)!;
      expect(route.airlineSlugs).toEqual(['biman-bangladesh']);
    }
  });
});

describe('BD-001 — Manchester to Dhaka: Connecting, never claimed nonstop', () => {
  it('isDirect is false and getDisplayDirectness returns connecting', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    expect(route.isDirect).toBe(false);
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('connecting');
  });

  it('verification is present and confirms the connecting/one-stop shape specifically, not a direct claim', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    expect(route.verification).toBeDefined();
    expect(route.verification!.status).toBe('verified');
    expect(route.verification!.sourceUrl).toContain('mediacentre.manchesterairport.co.uk');
  });

  it('no field claims a nonstop/direct service as a positive fact — "never nonstop" is stated explicitly instead', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency, route.verification!.note].join(' ').toLowerCase();
    expect(allCopy).toMatch(/never nonstop|never been a nonstop/);
    expect(allCopy).toMatch(/sylhet/);
    // "nonstop" only ever appears negated ("never nonstop"), never as a bare positive claim.
    expect(allCopy).not.toMatch(/(?<!never )\bis nonstop\b/);
  });

  it('the stop is described as a scheduled stop on the same Biman aircraft, not a separate connecting airline', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    const allCopy = [route.intro, route.verification!.note].join(' ').toLowerCase();
    expect(allCopy).toMatch(/same aircraft|same biman/);
  });

  it('the twice-weekly frequency is attributed to current news reporting, not claimed as Biman\'s own confirmed schedule', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    expect(route.frequency.toLowerCase()).toMatch(/attributed to|current bangladeshi news|not yet reconfirmed/);
    expect(route.frequency.toLowerCase()).toMatch(/two weekly|twice weekly/);
  });

  it('getRoutePresentation reports status "connecting"', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('connecting');
  });

  it('no invented terminal, baggage or transfer-time claim appears anywhere in the route\'s copy', () => {
    const route = getRouteBySlug('manchester-dhaka')!;
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency].join(' ').toLowerCase();
    expect(allCopy).not.toMatch(/terminal \d/);
    expect(allCopy).not.toMatch(/kg baggage|checked bag/);
    expect(allCopy).not.toMatch(/\d+\s*min(ute)?s? transfer/);
  });
});

const PENDING_BANGLADESH_SLUGS = ['manchester-sylhet', 'london-heathrow-dhaka', 'london-heathrow-sylhet'];

describe('BD-001 — Manchester-Sylhet, Heathrow-Dhaka and Heathrow-Sylhet: Verification Pending, no facts leaked', () => {
  it('all three are isDirect:true with no current verification — render as Verification Pending', () => {
    for (const slug of PENDING_BANGLADESH_SLUGS) {
      const route = getRouteBySlug(slug)!;
      expect(route.isDirect).toBe(true);
      expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('unverified');
      expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('unverified');
    }
  });

  it('the pending presentation suppresses flightTime, frequency and airlines publicly — same fail-closed behaviour every other pending route already has', () => {
    for (const slug of PENDING_BANGLADESH_SLUGS) {
      const route = getRouteBySlug(slug)!;
      const p = getRoutePresentation(route, FIXED_TODAY);
      expect(p.flightTime).toBeNull();
      expect(p.frequency).toBeNull();
      expect(p.airlineSlugs).toEqual([]);
      expect(p.canShowBookingGuidance).toBe(false);
    }
  });

  it('each still carries a real, dated verification.note internally documenting exactly what was and wasn\'t found — not fabricated, not empty', () => {
    for (const slug of PENDING_BANGLADESH_SLUGS) {
      const route = getRouteBySlug(slug)!;
      expect(route.verification?.note?.length).toBeGreaterThan(50);
      expect(route.verification?.status).toBe('unverified');
    }
  });

  it('the Heathrow-Dhaka note documents the rechecked live flight-tracking evidence (BG201/BG202) without claiming a confirmed stop pattern', () => {
    const route = getRouteBySlug('london-heathrow-dhaka')!;
    expect(route.verification!.note!).toMatch(/BG201|BG202/);
    expect(route.verification!.note!.toLowerCase()).toMatch(/could not|unconfirmed|kept unverified/);
  });

  it('the Heathrow-Sylhet note explicitly corrects the earlier "zero evidence" rejection rather than silently changing it', () => {
    const route = getRouteBySlug('london-heathrow-sylhet')!;
    expect(route.verification!.note!.toLowerCase()).toMatch(/zero evidence.*inaccurate|founder-directed correction/);
  });

  it('the manchester-sylhet note documents the directly-fetched Manchester Airport "not flying" contradiction', () => {
    const route = getRouteBySlug('manchester-sylhet')!;
    expect(route.verification!.note!.toLowerCase()).toMatch(/not flying to this location/);
  });
});

describe('BD-001 — no fare invented, no unrelated destination or route added', () => {
  it('no fare observation exists for any Bangladesh route — none could be honestly logged this session', () => {
    for (const slug of ALL_BANGLADESH_ROUTE_SLUGS) {
      expect(fareObservations.filter((o) => o.routeSlug === slug)).toHaveLength(0);
    }
  });

  it('no deal card exists for any Bangladesh route', () => {
    expect(deals.filter((d) => d.toDestinationSlug === 'dhaka' || d.toDestinationSlug === 'sylhet')).toHaveLength(0);
  });

  it('no other country was added — Muscat/Oman, Hyderabad, Riyadh and Colombo are all absent', () => {
    const slugs = destinations.map((d) => d.slug);
    for (const unrelated of ['muscat', 'hyderabad', 'riyadh', 'colombo']) {
      expect(slugs).not.toContain(unrelated);
    }
  });
});

describe('BD-001 — affiliate link falls back safely for both destinations, no unverified deep link claimed', () => {
  it('hasVerifiedDeepLink returns false for both dhaka and sylhet — travelup.com returned 403 on every attempt this session', () => {
    expect(hasVerifiedDeepLink('dhaka')).toBe(false);
    expect(hasVerifiedDeepLink('sylhet')).toBe(false);
  });

  it('getRouteBookingUrl still resolves to a real, tracked TravelUp URL with correct route context for every added route, never crashing or pointing at the wrong destination', () => {
    const heathrow = getAirportBySlug('london-heathrow')!;
    const manchester = getAirportBySlug('manchester')!;
    const dhaka = getDestinationBySlug('dhaka')!;
    const sylhet = getDestinationBySlug('sylhet')!;

    const lhrDac = getRouteBookingUrl(heathrow, dhaka);
    expect(lhrDac).toContain('kqzyfj.com/click-101818709-15363607');
    expect(decodeURIComponent(lhrDac)).toMatch(/sid=route-london-heathrow-dhaka/);
    expect(lhrDac).not.toMatch(/[?&]url=/);

    const manDac = getRouteBookingUrl(manchester, dhaka);
    expect(decodeURIComponent(manDac)).toMatch(/sid=route-manchester-dhaka/);
    expect(manDac).not.toMatch(/[?&]url=/);

    const manSyl = getRouteBookingUrl(manchester, sylhet);
    expect(decodeURIComponent(manSyl)).toMatch(/sid=route-manchester-sylhet/);
    expect(manSyl).not.toMatch(/[?&]url=/);

    const lhrSyl = getRouteBookingUrl(heathrow, sylhet);
    expect(decodeURIComponent(lhrSyl)).toMatch(/sid=route-london-heathrow-sylhet/);
    expect(lhrSyl).not.toMatch(/[?&]url=/);
  });
});

describe('BD-001 — Travel Ready Check: Bangladesh rules, NVR exemption, no duplication, no regression', () => {
  it('Bangladesh is in the Travel Ready supported-countries list', () => {
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).toContain('Bangladesh');
  });

  it('exactly three Bangladesh rules exist — passport validity, visa requirement, and the NVR exemption — no per-city duplication', () => {
    const passport = getRule('Bangladesh', 'british-passport', 'passport-validity');
    const visa = getRule('Bangladesh', 'british-passport', 'visa-requirement');
    const nvr = getRule('Bangladesh', 'nvr-holder', 'document-exemption');
    expect(passport).toBeDefined();
    expect(visa).toBeDefined();
    expect(nvr).toBeDefined();
  });

  it('the NVR rule is sourced to the Bangladesh High Commission, London, not a guessed or generic source', () => {
    const nvr = getRule('Bangladesh', 'nvr-holder', 'document-exemption')!;
    expect(nvr.officialSource.url).toBe('https://bhclondon.org.uk/no-visa-required');
  });

  it('British passport, Dhaka, no NVR, no visa held — needs a visa', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'dhaka', isBritishPassport: true, exemptionDocument: 'none', departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' },
      NOW
    );
    expect(['visa-or-entry-permission-needed', 'document-timing-may-affect-booking']).toContain(result.verdict);
    expect(result.verdict).not.toBe('not-enough-information');
  });

  it('British passport, Sylhet, NVR endorsement held — ready to continue, NVR exemption handling is correct', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'sylhet', isBritishPassport: true, exemptionDocument: 'nvr', departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('NVR exemption only applies to Bangladesh — selecting it for India (a stale leftover selection) does not grant a false exemption', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'delhi', isBritishPassport: true, exemptionDocument: 'nvr', departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' },
      NOW
    );
    expect(result.verdict).not.toBe('ready-to-continue');
  });

  it('selecting Dhaka or Sylhet never falls back to not-enough-information — no missing-rule or generic-country failure was introduced', () => {
    for (const slug of ['dhaka', 'sylhet']) {
      const result = evaluateTravelReadiness(
        { destinationSlug: slug, isBritishPassport: true, exemptionDocument: 'none', departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' },
        NOW
      );
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.verdict).not.toBe('not-enough-information');
    }
  });

  it('existing Pakistan and India destinations are completely unaffected — Lahore (NICOP) and Delhi (OCI) still resolve exactly as before', () => {
    const lahore = evaluateTravelReadiness(
      { destinationSlug: 'lahore', isBritishPassport: true, exemptionDocument: 'nicop-poc', departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' },
      NOW
    );
    const delhi = evaluateTravelReadiness(
      { destinationSlug: 'delhi', isBritishPassport: true, exemptionDocument: 'oci', departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' },
      NOW
    );
    expect(lahore.verdict).toBe('ready-to-continue');
    expect(delhi.verdict).toBe('ready-to-continue');
  });

  it('a real official visa-links entry exists for Bangladesh, correctly typed as info (no confirmed application portal, unlike Pakistan/India)', () => {
    const link = getVisaLinkForCountry('Bangladesh');
    expect(link).toBeDefined();
    expect(link!.linkType).toBe('info');
    expect(link!.href).toBe('https://www.gov.uk/foreign-travel-advice/bangladesh/entry-requirements');
  });
});

describe('BD-001 — Interactive Route Atlas integration', () => {
  it('the Manchester network includes a bangladesh country group with both Dhaka and Sylhet points', () => {
    const airports = buildAtlasAirports();
    const manchester = airports.find((a) => a.airportSlug === 'manchester')!;
    const bangladesh = manchester.countries.find((c) => c.slug === 'bangladesh');
    expect(bangladesh).toBeDefined();
    const slugs = bangladesh!.destinations.map((d) => d.slug).sort();
    expect(slugs).toEqual(['dhaka', 'sylhet']);
    expect(bangladesh!.destinations.every((d) => d.networkMembership === 'supported')).toBe(true);
  });

  it('the Heathrow network now includes a bangladesh country group with both Dhaka and Sylhet points (amendment: Sylhet added, correcting the earlier "zero evidence" exclusion)', () => {
    const airports = buildAtlasAirports();
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow')!;
    const bangladesh = heathrow.countries.find((c) => c.slug === 'bangladesh');
    expect(bangladesh).toBeDefined();
    expect(bangladesh!.destinations.map((d) => d.slug).sort()).toEqual(['dhaka', 'sylhet'].sort());
  });

  it('Dhaka and Sylhet sit further east than every India point on the map (larger x), matching real geography', () => {
    const airports = buildAtlasAirports();
    const manchester = airports.find((a) => a.airportSlug === 'manchester')!;
    const india = manchester.countries.find((c) => c.slug === 'india')!;
    const bangladesh = manchester.countries.find((c) => c.slug === 'bangladesh')!;
    const maxIndiaX = Math.max(...india.destinations.map((d) => d.x));
    for (const point of bangladesh.destinations) {
      expect(point.x).toBeGreaterThan(maxIndiaX);
    }
  });

  it('the existing Pakistan and India points on the Manchester network are still present and unchanged', () => {
    const airports = buildAtlasAirports();
    const manchester = airports.find((a) => a.airportSlug === 'manchester')!;
    const pakistan = manchester.countries.find((c) => c.slug === 'pakistan')!;
    expect(pakistan.destinations.map((d) => d.slug).sort()).toEqual(['islamabad', 'karachi', 'lahore'].sort());
  });
});

describe('BD-001 — sitemap and static generation', () => {
  it('both destination pages and all four route pages appear in the sitemap', () => {
    const entries = sitemap().map((e) => e.url);
    expect(entries.some((u) => u.endsWith('/destinations/dhaka'))).toBe(true);
    expect(entries.some((u) => u.endsWith('/destinations/sylhet'))).toBe(true);
    expect(entries.some((u) => u.endsWith('/routes/london-heathrow-dhaka'))).toBe(true);
    expect(entries.some((u) => u.endsWith('/routes/london-heathrow-sylhet'))).toBe(true);
    expect(entries.some((u) => u.endsWith('/routes/manchester-dhaka'))).toBe(true);
    expect(entries.some((u) => u.endsWith('/routes/manchester-sylhet'))).toBe(true);
  });
});

describe('BD-001 — Journey Check selector', () => {
  it('the homepage Journey Desk passes Dhaka and Sylhet into JourneyCheckForm as selectable destinations, derived purely from routes.ts', () => {
    const element = JourneyDeskHome();
    const form = findElementOfType(element, JourneyCheckForm);
    expect(form).not.toBeNull();
    const destinationLabels = (form!.props.destinations as { slug: string; label: string }[]).map((d) => d.label);
    expect(destinationLabels).toContain('Dhaka, Bangladesh');
    expect(destinationLabels).toContain('Sylhet, Bangladesh');
  });

  it('every existing India/Pakistan destination label is still present alongside the new Bangladesh ones', () => {
    const element = JourneyDeskHome();
    const form = findElementOfType(element, JourneyCheckForm)!;
    const destinationLabels = (form.props.destinations as { slug: string; label: string }[]).map((d) => d.label);
    expect(destinationLabels).toContain('Lahore, Pakistan');
    expect(destinationLabels).toContain('Delhi, India');
  });

  it('the routeIndex maps each Bangladesh origin/destination pair to the correct route slug', () => {
    const element = JourneyDeskHome();
    const form = findElementOfType(element, JourneyCheckForm)!;
    const routeIndex = form.props.routeIndex as Record<string, string>;
    expect(routeIndex['manchester|dhaka']).toBe('manchester-dhaka');
    expect(routeIndex['manchester|sylhet']).toBe('manchester-sylhet');
    expect(routeIndex['london-heathrow|dhaka']).toBe('london-heathrow-dhaka');
    expect(routeIndex['london-heathrow|sylhet']).toBe('london-heathrow-sylhet');
  });
});

describe('BD-001 — pages render end-to-end without crashing', () => {
  it('all four route pages render', async () => {
    for (const slug of ALL_BANGLADESH_ROUTE_SLUGS) {
      const element = await RoutePage({ params: Promise.resolve({ slug }) });
      expect(element).toBeTruthy();
    }
  });

  it('both destination pages render', async () => {
    for (const slug of ['dhaka', 'sylhet']) {
      const element = await DestinationPage({ params: Promise.resolve({ slug }) });
      expect(element).toBeTruthy();
    }
  });
});
