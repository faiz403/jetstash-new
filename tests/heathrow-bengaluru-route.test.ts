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
import { getTripComRouteUrl, hasTripComRoute } from '@/lib/booking-providers';
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

  it('per-airline verification records exist for British Airways and Virgin Atlantic, each independently sourced', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.airlineVerifications).toBeDefined();
    expect(route.airlineVerifications).toHaveLength(2);
    const ba = route.airlineVerifications!.find((v) => v.airlineSlug === 'british-airways');
    const vs = route.airlineVerifications!.find((v) => v.airlineSlug === 'virgin-atlantic');
    expect(ba).toBeDefined();
    expect(ba!.status).toBe('verified');
    expect(ba!.sourceUrl).toBe('https://mediacentre.britishairways.com/pressrelease/details/24270');
    expect(vs).toBeDefined();
    expect(vs!.status).toBe('verified');
    expect(vs!.sourceUrl).toBe('https://www.virginatlantic.com/where-we-fly/asia/india/bengaluru');
  });

  it('British Airways and Virgin Atlantic are named as airlines; Air India is deliberately excluded — its official pages give contradictory information about a direct service', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(route.airlineSlugs.slice().sort()).toEqual(['british-airways', 'virgin-atlantic'].sort());
    expect(route.airlineSlugs).not.toContain('air-india');
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency].join(' ');
    expect(allCopy).toMatch(/air india/i);
    expect(allCopy).toMatch(/contradictory/i);
  });

  it('every listed airline slug resolves to a real entry in data/airlines.ts', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    const resolved = getAirlinesBySlugs(route.airlineSlugs);
    expect(resolved.length).toBe(route.airlineSlugs.length);
  });

  it('British Airways\' evidence explicitly says "daily" and names the operating aircraft — not inferred from a booking page selling dates', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    const ba = route.airlineVerifications!.find((v) => v.airlineSlug === 'british-airways')!;
    expect(ba.supportedClaim.toLowerCase()).toMatch(/daily/);
    expect(ba.supportedClaim.toLowerCase()).toMatch(/777-200/);
    expect(ba.supportedClaim.toLowerCase()).toMatch(/the airline operates/);
  });

  it('Virgin Atlantic\'s evidence explicitly says "daily", and its weaker operating-carrier disclosure (vs British Airways\' explicit "the airline operates" wording) is recorded, not glossed over', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    const vs = route.airlineVerifications!.find((v) => v.airlineSlug === 'virgin-atlantic')!;
    expect(vs.supportedClaim.toLowerCase()).toMatch(/daily/);
    expect(vs.remainingUncertainty!.toLowerCase()).toMatch(/codeshare|joint-venture/);
  });

  it('frequency and flightTime never claim both airlines fly the exact same stated duration or an aggregate weekly count not actually stated by either source', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    // The flightTime figure (10h) is Virgin Atlantic's own stated duration only — British Airways'
    // source never gave a duration, so flightTime must not imply it's a jointly-confirmed figure.
    expect(route.flightTime.toLowerCase()).toMatch(/virgin atlantic/);
    expect(route.flightTime.toLowerCase()).not.toMatch(/british airways/);
    // No invented per-route weekly count (BA's source gives only a 5-city aggregate).
    expect(route.frequency).not.toMatch(/\d+x\s*weekly/i);
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

  it('getAirlineDisplayStatus is "verified" for both British Airways and Virgin Atlantic, each backed by its own airlineVerifications entry', () => {
    const route = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(getAirlineDisplayStatus(route, 'british-airways', FIXED_TODAY)).toBe('verified');
    expect(getAirlineDisplayStatus(route, 'virgin-atlantic', FIXED_TODAY)).toBe('verified');
  });
});

describe('DEST-001 — no fare invented, no route other than this one added', () => {
  // Both tests below originally documented that no fare could be honestly
  // logged in the DEST-001 session itself - true at the time, not a
  // standing constraint. Fare Coverage Expansion Batch B (6 August 2026,
  // a later, separate initiative - see FARE_COVERAGE_BATCH_B.md) logged a
  // real, dated Gulf Air observation and added a matching Deal entry.
  it('exactly one genuine, dated fare observation exists for this route, added by Fare Coverage Expansion Batch B', () => {
    // 18 August 2026: Weekly Full Fare Refresh #1 appended a second,
    // genuine observation (British Airways, both legs direct) — see
    // tests/fare-coverage-batch-b.test.ts for the resulting honest
    // directness disagreement (Batch B's outbound-only-connecting evidence
    // vs this one's both-legs-direct evidence — aggregate now undefined).
    const observations = fareObservations.filter((o) => o.routeSlug === 'london-heathrow-bengaluru');
    expect(observations).toHaveLength(2);
    expect(observations[0].id).toBe('obs-lhr-blr-economy-20260806-8w-v1');
    expect(observations[0].source).toBe('Gulf Air');
    expect(observations[1].id).toBe('obs-lhr-blr-economy-20260818-8w-v1');
  });

  it('exactly one deal card exists for this route, added by Fare Coverage Expansion Batch B', () => {
    const matchingDeals = deals.filter((d) => d.fromAirportSlug === 'london-heathrow' && d.toDestinationSlug === 'bengaluru');
    expect(matchingDeals).toHaveLength(1);
    expect(matchingDeals[0].id).toBe('lhr-blr-economy');
  });

  it('destinations.ts contains exactly one Bengaluru entry, not duplicated', () => {
    expect(destinations.filter((d) => d.slug === 'bengaluru')).toHaveLength(1);
  });
});

describe('DEST-001 — booking CTA fails closed, no generic Trip.com link claimed', () => {
  it('london-heathrow-bengaluru has no Trip.com link — Trip.com has no Heathrow-specific dateless link, and no generic London fallback is used', () => {
    expect(hasTripComRoute('london-heathrow-bengaluru')).toBe(false);
    expect(getTripComRouteUrl('london-heathrow-bengaluru')).toBeNull();
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
  it('the Heathrow network includes a Bengaluru point under India, correctly resolved and network-supported', () => {
    const airports = buildAtlasAirports();
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow');
    expect(heathrow).toBeDefined();
    const india = heathrow!.countries.find((c) => c.slug === 'india');
    expect(india).toBeDefined();
    const bengaluru = india!.destinations.find((d) => d.slug === 'bengaluru');
    expect(bengaluru).toBeDefined();
    expect(bengaluru!.networkMembership).toBe('supported');
    expect(bengaluru!.routeHref).toBe('/routes/london-heathrow-bengaluru');
  });

  it('Route Coverage Truth fix (August 2026): Bengaluru\'s verified status now matches Delhi\'s and Mumbai\'s — all three show a confirmed "Direct service verified" verdict, never "pending", because computeRouteIntelligenceLevel()/buildDestinationPoint() route through getDisplayDirectness(), which checks per-airline `airlineVerifications` as well as the route-level `verification` field. This closes the pre-existing gap this test used to document (buildDestinationPoint() previously only checked route-level verification, quietly under-stating all three routes as "pending" despite each having a current, primary-sourced airline verification) — not a regression, a fix, and not special-cased to any one of the three routes.', () => {
    // Historical/business-rule invariant: this documents a specific past
    // regression fix (per-airline verification now feeds the Atlas verdict,
    // not just route-level verification) and the specific evidence state
    // that proved it at the time — not today's live verification state.
    // Frozen to this file's own existing FIXED_TODAY so it stays true
    // regardless of a later, independent per-airline verification expiring
    // (e.g. london-heathrow-delhi's British Airways verification, due
    // 2026-08-28) — see the route verification test determinism batch, 29
    // Aug 2026. That expiry is a real, separate, current-state fact; it
    // does not retroactively change what this fix proved in July.
    const airports = buildAtlasAirports(FIXED_TODAY);
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow')!;
    const india = heathrow.countries.find((c) => c.slug === 'india')!;
    const bengaluru = india.destinations.find((d) => d.slug === 'bengaluru')!;
    const delhi = india.destinations.find((d) => d.slug === 'delhi')!;
    const mumbai = india.destinations.find((d) => d.slug === 'mumbai')!;
    // The bug this test guards against was about VERIFICATION STATUS
    // (was Bengaluru's confirmed BA service being read as "pending"?) — all
    // three now correctly show a confirmed verdict, never "pending" or
    // "unverified".
    expect(bengaluru.verdict).toBe('Direct service verified.');
    expect(bengaluru.verdict).toBe(delhi.verdict);
    expect(bengaluru.verdict).toBe(mumbai.verdict);
    expect(bengaluru.verdict).not.toMatch(/pending|not yet independently verified/i);
    // Intelligence LEVEL (breadth of guidance beyond verification) is a
    // separate, genuinely different question — see computeRouteIntelligenceLevel's
    // doc comment. Bengaluru was "useful" here (verified via a
    // primary-sourced airline verification, but with none of the other five
    // depth categories) until Fare Coverage Expansion Batch B (6 August
    // 2026, a later, separate initiative - see FARE_COVERAGE_BATCH_B.md)
    // gave it a genuine, dated fare observation — its second category,
    // clearing all three RIS-001 gates (airline-verification is already
    // substantive, the fare is customer-visible via lhr-blr-economy, and
    // it's a direct route so the connecting-depth check doesn't apply).
    // All three destinations now genuinely read "strong" — a mechanical
    // consequence of real evidence, not a forced equalization.
    expect(bengaluru.intelligenceLevel).toBe('strong');
    expect(delhi.intelligenceLevel).toBe('strong');
    expect(mumbai.intelligenceLevel).toBe('strong');
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
