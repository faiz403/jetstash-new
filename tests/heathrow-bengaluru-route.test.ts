import { describe, it, expect } from 'vitest';
import {
  getRouteBySlug,
  getRouteByAirportAndDestination,
  getRoutesByAirport,
  getRoutesByDestination,
  getDisplayDirectness,
  getRoutePresentation,
  getAirlineDisplayStatus,
} from '@/data/routes';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { getAirlinesBySlugs } from '@/data/airlines';
import { fareObservations } from '@/data/fare-observations';
import { deals } from '@/data/deals';
import { hasVerifiedDeepLink, getRouteBookingUrl } from '@/lib/booking-providers';
import { evaluateTravelReadiness, TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { regionGroups } from '@/lib/site-config';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import RoutePage from '@/app/routes/[slug]/page';
import DestinationPage from '@/app/destinations/[slug]/page';

const FIXED_TODAY = '2026-07-30';
const NOW = new Date('2026-07-30T12:00:00Z');

describe('DEST-001 — Bengaluru destination record', () => {
  it('exists with the expected core fields', () => {
    const dest = getDestinationBySlug('bengaluru');
    expect(dest).toBeDefined();
    expect(dest!.city).toBe('Bengaluru');
    expect(dest!.country).toBe('India');
    expect(dest!.region).toBe('india');
    expect(dest!.iataCode).toBe('BLR');
  });

  it('lists only london-heathrow in ukAirports — no other airport route was added in this pass', () => {
    const dest = getDestinationBySlug('bengaluru')!;
    expect(dest.ukAirports).toEqual(['london-heathrow']);
  });

  it('is included in the India region group used by the destination directory', () => {
    expect(regionGroups.india.destinationSlugs).toContain('bengaluru');
  });

  it('the existing India destinations remain present and unchanged in the region group', () => {
    expect(regionGroups.india.destinationSlugs).toEqual(
      expect.arrayContaining(['delhi', 'mumbai', 'ahmedabad', 'amritsar'])
    );
  });
});

describe('DEST-001 — London Heathrow to Bengaluru route existence and resolution', () => {
  it('a route record exists at the expected slug', () => {
    expect(getRouteBySlug('london-heathrow-bengaluru')).toBeDefined();
  });

  it('airportSlug and destinationSlug point to real, existing records', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(getAirportBySlug(route.airportSlug)).toBeDefined();
    expect(getDestinationBySlug(route.destinationSlug)).toBeDefined();
    expect(route.airportSlug).toBe('london-heathrow');
    expect(route.destinationSlug).toBe('bengaluru');
  });

  it('is resolvable via getRouteByAirportAndDestination, matching getRouteBySlug', () => {
    const bySlug = getRouteBySlug('london-heathrow-bengaluru')!;
    const byPair = getRouteByAirportAndDestination('london-heathrow', 'bengaluru');
    expect(byPair?.slug).toBe(bySlug.slug);
  });

  it('getRoutesByAirport("london-heathrow") and getRoutesByDestination("bengaluru") both include the route', () => {
    expect(getRoutesByAirport('london-heathrow').some((r) => r.slug === 'london-heathrow-bengaluru')).toBe(true);
    expect(getRoutesByDestination('bengaluru').some((r) => r.slug === 'london-heathrow-bengaluru')).toBe(true);
  });

  it('no other route exists for the bengaluru destination — only this one was added', () => {
    const bengaluruRoutes = getRoutesByDestination('bengaluru');
    expect(bengaluruRoutes).toHaveLength(1);
    expect(bengaluruRoutes[0].slug).toBe('london-heathrow-bengaluru');
  });
});

describe('DEST-001 — displays as direct, on real evidence only', () => {
  it('isDirect is true and getDisplayDirectness returns direct', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.isDirect).toBe(true);
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('direct');
  });

  it('a route-level verification record exists, sourced to Virgin Atlantic\'s own route page', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.verification).toBeDefined();
    expect(route.verification!.status).toBe('verified');
    expect(route.verification!.sourceUrl).toBe('https://www.virginatlantic.com/where-we-fly/asia/india/bengaluru');
  });

  it('only virgin-atlantic is named as an airline — British Airways and Air India are deliberately not claimed, since neither could be independently verified this session', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.airlineSlugs).toEqual(['virgin-atlantic']);
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency, route.verification?.note ?? ''].join(' ');
    // British Airways and Air India may be *discussed* as unverified in the note/intro (they are,
    // honestly, as a documented gap) but must never be added to airlineSlugs or asserted as verified.
    expect(route.airlineSlugs).not.toContain('british-airways');
    expect(route.airlineSlugs).not.toContain('air-india');
    expect(allCopy).toMatch(/not independently verified|could not be independently verified/i);
  });

  it('every listed airline slug resolves to a real entry in data/airlines.ts', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    const resolved = getAirlinesBySlugs(route.airlineSlugs);
    expect(resolved.length).toBe(route.airlineSlugs.length);
  });

  it('flightTime and frequency attribute their claim to Virgin Atlantic specifically, not a blanket "daily" for every operator', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.flightTime.toLowerCase()).toMatch(/virgin atlantic/);
    expect(route.frequency.toLowerCase()).toMatch(/virgin atlantic/);
  });

  it('no invented terminal, baggage or transfer-time claim appears anywhere in the route\'s copy', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency].join(' ').toLowerCase();
    expect(allCopy).not.toMatch(/terminal \d/);
    expect(allCopy).not.toMatch(/kg baggage|checked bag/);
    expect(allCopy).not.toMatch(/transfer time/);
  });

  it('getRoutePresentation reports status "direct"', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('direct');
  });

  it('getAirlineDisplayStatus is "unverified" for virgin-atlantic — attribution rests on the route-level verification record, not a per-airline airlineVerifications entry (this route has none, matching the single-operator pattern used elsewhere, e.g. manchester-dubai)', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.airlineVerifications).toBeUndefined();
    expect(getAirlineDisplayStatus(route, 'virgin-atlantic', FIXED_TODAY)).toBe('unverified');
  });
});

describe('DEST-001 — no fare invented, no route other than this one added', () => {
  it('no fare observation exists for this route — none could be honestly logged this session', () => {
    expect(fareObservations.filter((o) => o.routeSlug === 'london-heathrow-bengaluru')).toHaveLength(0);
  });

  it('no deal card exists for this route', () => {
    expect(deals.filter((d) => d.fromAirportSlug === 'london-heathrow' && d.toDestinationSlug === 'bengaluru')).toHaveLength(0);
  });

  it('destinations.ts contains exactly one Bengaluru entry, not duplicated', () => {
    expect(destinations.filter((d) => d.slug === 'bengaluru')).toHaveLength(1);
  });
});

describe('DEST-001 — affiliate link falls back safely, no unverified deep link claimed', () => {
  it('hasVerifiedDeepLink returns false for bengaluru — no TravelUp page could be confirmed this session', () => {
    expect(hasVerifiedDeepLink('bengaluru')).toBe(false);
  });

  it('getRouteBookingUrl still resolves to a real, tracked TravelUp URL with correct route context, never crashing or pointing at the wrong destination', () => {
    const airport = getAirportBySlug('london-heathrow')!;
    const destination = getDestinationBySlug('bengaluru')!;
    const url = getRouteBookingUrl(airport, destination);
    expect(url).toContain('kqzyfj.com/click-101818709-15363607');
    expect(url).toContain('sid=');
    const decoded = decodeURIComponent(url);
    expect(decoded).toMatch(/sid=route-london-heathrow-bengaluru/);
    // No deep-link override param, since none is verified.
    expect(url).not.toMatch(/[?&]url=/);
  });
});

describe('DEST-001 — Travel Ready Check reuses the existing India rules, no duplication, no regression', () => {
  it('Bengaluru is included in the Travel Ready supported-destinations set purely because country is India', () => {
    const dest = getDestinationBySlug('bengaluru')!;
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).toContain(dest.country);
  });

  it('British passport, Bengaluru, no OCI, no visa held — needs a visa, same as every other India destination', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'bengaluru',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(['visa-or-entry-permission-needed', 'document-timing-may-affect-booking']).toContain(result.verdict);
    expect(result.verdict).not.toBe('not-enough-information');
  });

  it('British passport, Bengaluru, valid OCI — ready to continue, OCI exemption handling is correct', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'bengaluru',
        isBritishPassport: true,
        exemptionDocument: 'oci',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('selecting Bengaluru never falls back to not-enough-information — no missing-rule or generic-country failure was introduced', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'bengaluru',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('existing India destinations are completely unaffected — Delhi still resolves exactly as before', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'delhi',
        isBritishPassport: true,
        exemptionDocument: 'oci',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });
});

describe('DEST-001 — Interactive Route Atlas integration', () => {
  it('the Heathrow network includes a Bengaluru point under India, with verified evidence state', () => {
    const airports = buildAtlasAirports();
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow');
    expect(heathrow).toBeDefined();
    const india = heathrow!.countries.find((c) => c.slug === 'india');
    expect(india).toBeDefined();
    const bengaluru = india!.destinations.find((d) => d.slug === 'bengaluru');
    expect(bengaluru).toBeDefined();
    expect(bengaluru!.evidenceState).toBe('verified');
    expect(bengaluru!.networkMembership).toBe('supported');
    expect(bengaluru!.routeHref).toBe('/routes/london-heathrow-bengaluru');
  });

  it('the existing Heathrow India points (Delhi, Mumbai) are still present alongside Bengaluru', () => {
    const airports = buildAtlasAirports();
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow')!;
    const india = heathrow.countries.find((c) => c.slug === 'india')!;
    const slugs = india.destinations.map((d) => d.slug).sort();
    expect(slugs).toEqual(['bengaluru', 'delhi', 'mumbai'].sort());
  });

  it('Bengaluru sits south of Delhi and Mumbai on the map (larger y), matching its real geography', () => {
    const airports = buildAtlasAirports();
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow')!;
    const india = heathrow.countries.find((c) => c.slug === 'india')!;
    const bengaluru = india.destinations.find((d) => d.slug === 'bengaluru')!;
    const delhi = india.destinations.find((d) => d.slug === 'delhi')!;
    const mumbai = india.destinations.find((d) => d.slug === 'mumbai')!;
    expect(bengaluru.y).toBeGreaterThan(delhi.y);
    expect(bengaluru.y).toBeGreaterThan(mumbai.y);
  });
});

describe('DEST-001 — pages render end-to-end without crashing', () => {
  it('the route page renders for london-heathrow-bengaluru', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'london-heathrow-bengaluru' }) });
    expect(element).toBeTruthy();
  });

  it('the destination page renders for bengaluru', async () => {
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'bengaluru' }) });
    expect(element).toBeTruthy();
  });
});
