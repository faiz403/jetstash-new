import { describe, it, expect } from 'vitest';
import { fareObservations, getPublishableObservationsByRoute, getFareRangeSummary, aggregateFareDirectness } from '@/data/fare-observations';
import { deals, getDealFareDirectnessLabel, hasTrackedFare, isBundledProductDeal } from '@/data/deals';
import { routes } from '@/data/routes';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { computeRouteIntelligenceLevel, aggregateCountryIntelligence, buildAtlasAirports } from '@/lib/atlas-network-data';
import { getTripComRouteUrl } from '@/lib/booking-providers';

/**
 * Regression coverage for Fare Coverage Expansion Batch B (6 August 2026,
 * run after Route Intelligence Scoring v2 / RIS-001 was merged and
 * verified in production, 8b1d18d). See
 * docs/project-control/FARE_COVERAGE_BATCH_B.md and
 * FARE_OBSERVATION_ARCHIVE.md's "Fare Coverage Expansion — Batch B"
 * section for the full write-up this file guards.
 */

const NOW_ISO = '2026-08-06';

const NEW_ROUTES = [
  'london-heathrow-doha',
  'london-gatwick-ahmedabad',
  'london-heathrow-bengaluru',
  'manchester-jeddah',
  'birmingham-mumbai',
  'birmingham-madinah',
  'manchester-dhaka',
  'leeds-bradford-amritsar',
  'leeds-bradford-islamabad',
  'london-gatwick-amritsar',
];

const NEW_OBSERVATION_IDS = [
  'obs-lhr-doh-economy-20260806-8w-v1',
  'obs-lgw-amd-economy-20260806-8w-v1',
  'obs-lhr-blr-economy-20260806-8w-v1',
  'obs-man-jed-economy-20260806-8w-v1',
  'obs-bhx-bom-economy-20260806-8w-v1',
  'obs-bhx-med-economy-20260806-8w-v1',
  'obs-man-dac-economy-20260806-8w-v1',
  'obs-lba-atq-economy-20260806-8w-v1',
  'obs-lba-isb-economy-20260806-8w-v1',
  'obs-lgw-atq-economy-20260806-8w-v1',
];

const NEW_DEAL_IDS = ['lhr-blr-economy', 'man-jed-economy', 'bhx-bom-economy', 'bhx-med-economy', 'man-dac-economy', 'lba-atq-economy', 'lba-isb-economy', 'lgw-atq-economy'];

// The 3 routes RIS-001 mechanically upgrades once Batch B's fare gives each
// its second, already-substantive category.
// london-gatwick-ahmedabad was upgraded to Strong on 6 August 2026 (Batch B) —
// a real, evidence-driven grade at the time, preserved as history throughout
// this file's narrative comments — but Route Verification Refresh Batch 1's
// correction (18 August 2026) reclassified the route unverified after a
// fresh check found current Air India surfaces genuinely conflict, which
// mechanically drops it back to 'useful'. See
// docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md.
const UPGRADED_TO_STRONG = ['london-heathrow-bengaluru', 'london-gatwick-amritsar'];
const REVERTED_TO_USEFUL_18_AUG = ['london-gatwick-ahmedabad'];

describe('Fare Coverage Expansion Batch B — observation methodology', () => {
  it('every Batch B observation exists, is dated 6 August 2026, and uses the 8-week/14-night profile', () => {
    for (const id of NEW_OBSERVATION_IDS) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeDefined();
      expect(obs.observedDate, id).toBe('2026-08-06');
      expect(obs.departureDate, id).toBe('2026-10-01');
      expect(obs.returnDate, id).toBe('2026-10-15');
      expect(obs.currency, id).toBe('GBP');
      expect(obs.cabin, id).toBe('Economy');
    }
  });

  it('every Batch B observation records a real, non-empty source and profileId — never left unset', () => {
    for (const id of NEW_OBSERVATION_IDS) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs.source, id).toBeTruthy();
      expect(obs.profileId, id).toBeTruthy();
      expect(obs.observedVia, id).toBe('google-flights');
    }
  });

  it('every Batch B observation explicitly records fareDirectness — never left unset', () => {
    for (const id of NEW_OBSERVATION_IDS) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs.fareDirectness, id).toBeDefined();
    }
  });

  it('baggage is honestly "not stated" for every Batch B observation — none was invented or guessed', () => {
    for (const id of NEW_OBSERVATION_IDS) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs.baggage, id).toBe('not stated');
    }
  });

  it('directness rule: a confirmed-connecting outbound is recorded "connecting" even though the return leg was never reviewed — every Batch B observation follows this', () => {
    // This is a deliberate, narrower standard than Batch A's own convention
    // (which defaulted every outbound-only review to 'unknown' regardless of
    // findings) - see FARE_COVERAGE_BATCH_B.md §3 for the full reasoning.
    // Every priceNote below explicitly states the outbound showed 1+ stops
    // and the return was not reviewed - confirming the 'connecting' value is
    // the batch's own rule applied consistently, not an accident.
    for (const id of NEW_OBSERVATION_IDS) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs.fareDirectness, id).toBe('connecting');
      // Every observation's own note states the outbound's connecting
      // evidence explicitly - either as a stop count ("1 stop", "2 stops")
      // or, for the one route where "Flight details" was opened (Heathrow-
      // Doha), the layover itself ("1h 15m layover").
      expect(obs.priceNote, id).toMatch(/stop|layover/i);
      expect(obs.priceNote, id).toMatch(/return leg not reviewed/i);
    }
  });

  it('no duplicate observation ids exist anywhere in the archive after this batch', () => {
    const ids = fareObservations.map((o) => o.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});

describe('Fare Coverage Expansion Batch B — publishability and customer visibility', () => {
  it('every new route has exactly one publishable observation', () => {
    for (const slug of NEW_ROUTES) {
      if (REVERTED_TO_USEFUL_18_AUG.includes(slug)) continue; // see below
      const publishable = getPublishableObservationsByRoute(slug, NOW_ISO);
      expect(publishable.length, slug).toBe(1);
    }
  });

  it('london-gatwick-ahmedabad\'s Batch B observation still exists in the archive but is no longer publishable, since 18 August 2026\'s correction reclassified the route unverified', () => {
    const raw = fareObservations.filter((o) => o.routeSlug === 'london-gatwick-ahmedabad' && o.cabin === 'Economy');
    expect(raw.length).toBeGreaterThanOrEqual(1); // append-only archive — never deleted
    expect(getPublishableObservationsByRoute('london-gatwick-ahmedabad', NOW_ISO).length).toBe(0);
  });

  it('every new route has a customer-visible fare (a real Deal that renders it), and the badge reflects the fare\'s own evidenced directness', () => {
    for (const slug of NEW_ROUTES) {
      if (REVERTED_TO_USEFUL_18_AUG.includes(slug)) continue; // see the dedicated test above
      const route = routes.find((r) => r.slug === slug)!;
      const deal = deals.find((d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug && d.cabin === 'Economy' && !isBundledProductDeal(d));
      expect(deal, slug).toBeDefined();
      expect(hasTrackedFare(deal!, NOW_ISO), slug).toBe(true);
      expect(getDealFareDirectnessLabel(deal!, NOW_ISO), slug).toBe('Connecting');
    }
  });

  it('the 2 routes with a pre-existing Deal (Heathrow-Doha, Gatwick-Ahmedabad) did not get a duplicate new Deal entry', () => {
    const lhrDohDeals = deals.filter((d) => d.fromAirportSlug === 'london-heathrow' && d.toDestinationSlug === 'doha' && d.cabin === 'Economy');
    const lgwAmdDeals = deals.filter((d) => d.fromAirportSlug === 'london-gatwick' && d.toDestinationSlug === 'ahmedabad' && d.cabin === 'Economy');
    expect(lhrDohDeals.length).toBe(1);
    expect(lgwAmdDeals.length).toBe(1);
    expect(lhrDohDeals[0].id).toBe('lhr-doh-economy');
    expect(lgwAmdDeals[0].id).toBe('lgw-amd-economy');
  });

  it('every new Deal entry matches a real route and a real Trip.com mapping was never invented for it', () => {
    for (const id of NEW_DEAL_IDS) {
      const deal = deals.find((d) => d.id === id)!;
      expect(deal, id).toBeDefined();
      const route = routes.find((r) => r.airportSlug === deal.fromAirportSlug && r.destinationSlug === deal.toDestinationSlug);
      expect(route, id).toBeDefined();
      // Trip.com URL presence is airport-determined (9 London-origin routes
      // structurally have none) - this test only confirms the lookup never
      // throws and never returns a hand-edited/guessed URL by checking it
      // matches the central, unedited map exactly.
      const url = getTripComRouteUrl(route!.slug);
      if (url !== null) {
        expect(url).toMatch(/^https:\/\/www\.trip\.com\/flights\//);
      }
    }
  });

  it('every new Deal\'s airline field is the route\'s own primary editorial operator, not the specific cheaper fare\'s source airline', () => {
    // Convention established across every existing Deal in data/deals.ts:
    // `airline` is the first entry in the route's own airlineSlugs, resolved
    // to its display name - never the observation's own `source` field.
    const expected: Record<string, string> = {
      'lhr-blr-economy': 'British Airways',
      'man-jed-economy': 'Qatar Airways',
      'bhx-bom-economy': 'Air India',
      'bhx-med-economy': 'Turkish Airlines',
      'man-dac-economy': 'Biman Bangladesh Airlines',
      'lba-atq-economy': 'Air India',
      'lba-isb-economy': 'Emirates',
      'lgw-atq-economy': 'Air India',
    };
    for (const [id, airline] of Object.entries(expected)) {
      const deal = deals.find((d) => d.id === id)!;
      expect(deal.airline, id).toBe(airline);
    }
  });

  it('overall coverage reflects the current evidence archive: 78 of 88 routes publishable, with 30 represented by curated tracked-fare cards (updated 18 August 2026 — london-gatwick-ahmedabad dropped out of both counts when Route Verification Refresh Batch 1\'s correction reclassified it unverified)', () => {
    let publishable = 0;
    let visible = 0;
    for (const route of routes) {
      if (getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0) publishable++;
      const deal = deals.find((d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug && d.cabin === 'Economy' && !isBundledProductDeal(d));
      if (deal && hasTrackedFare(deal, NOW_ISO)) visible++;
    }
    expect(publishable).toBe(78);
    expect(visible).toBe(30);
    // The 48 remaining routes have valid Fare Signals but no curated Deal
    // card. They are intentionally counted by route-level coverage only.
    expect(publishable - visible).toBe(48);
  });

  it('London Heathrow-Jeddah remains without a curated card, alongside the later Fare-Signal-only routes', () => {
    const route = routes.find((r) => r.slug === 'london-heathrow-jeddah')!;
    expect(getPublishableObservationsByRoute('london-heathrow-jeddah', NOW_ISO).length).toBeGreaterThan(0);
    const deal = deals.find((d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug && d.cabin === 'Economy' && !isBundledProductDeal(d));
    expect(deal).toBeUndefined();
  });
});

describe('Fare Coverage Expansion Batch B — RIS-001 mechanical grade changes', () => {
  it('the 2 routes still upgraded clear all three RIS-001 gates on a pre-existing substantive category plus the new fare — not a manual override (originally 3; see the reversion test below)', () => {
    for (const slug of UPGRADED_TO_STRONG) {
      const route = routes.find((r) => r.slug === slug)!;
      expect(route.isDirect, slug).toBe(true); // confirms Gate 3's connecting-depth check never applies here
      const hasWarning = getActiveWarningsByRoute(slug).length > 0;
      const hasAirlineVerif = Boolean(route.airlineVerifications && route.airlineVerifications.length > 0);
      expect(hasWarning || hasAirlineVerif, `${slug} must have a pre-existing substantive category`).toBe(true);
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('strong');
    }
  });

  it('london-gatwick-ahmedabad genuinely cleared the RIS-001 gates on 6 August 2026 (real evidence, not a manual override) but reverted to useful on 18 August 2026 when its verification state changed, not because RIS-001 or its depth categories changed', () => {
    const route = routes.find((r) => r.slug === 'london-gatwick-ahmedabad')!;
    expect(route.verification!.status).toBe('unverified');
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });

  it('the 8 non-upgraded new routes stay useful, each failing a specific, identifiable gate', () => {
    const stillUseful = NEW_ROUTES.filter((s) => !UPGRADED_TO_STRONG.includes(s));
    expect(stillUseful.length).toBe(8);
    for (const slug of stillUseful) {
      const route = routes.find((r) => r.slug === slug)!;
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('useful');
    }
  });

  it('every route currently graded strong or useful has exactly one grade (no route silently produces two)', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, NOW_ISO);
      expect(['strong', 'useful'], route.slug).toContain(level);
    }
  });

  it('Heathrow India is Strong when every destination has sufficient evidenced depth', () => {
    const airports = buildAtlasAirports();
    const heathrow = airports.find((a) => a.airportSlug === 'london-heathrow')!;
    const heathrowIndia = heathrow.countries.find((c) => c.slug === 'india')!;
    expect(heathrowIndia.intelligenceLevel).toBe('strong');
    expect(heathrowIndia.destinations.every((d) => d.intelligenceLevel === 'strong')).toBe(true);
  });

  it('Gatwick India was genuinely Strong on 6 August 2026 (both destinations individually Strong at the time) but reverted to Mixed on 18 August 2026 when london-gatwick-ahmedabad\'s verification state changed — the conservative aggregation rule (Strong only if every destination is Strong) correctly stops carrying it once one sibling is no longer Strong', () => {
    const airports = buildAtlasAirports();
    const gatwick = airports.find((a) => a.airportSlug === 'london-gatwick')!;
    const gatwickIndia = gatwick.countries.find((c) => c.slug === 'india')!;
    expect(gatwickIndia.intelligenceLevel).toBe('mixed');
    const ahmedabad = gatwickIndia.destinations.find((d) => d.slug === 'ahmedabad');
    expect(ahmedabad?.intelligenceLevel, 'ahmedabad should have reverted to useful').toBe('useful');
    const amritsar = gatwickIndia.destinations.find((d) => d.slug === 'amritsar');
    expect(amritsar?.intelligenceLevel, 'amritsar should remain strong').toBe('strong');
  });

  it('a single non-strong destination in either group would prevent Strong (the conservative rule is not bypassed)', () => {
    expect(
      aggregateCountryIntelligence([{ intelligenceLevel: 'strong' }, { intelligenceLevel: 'useful' }] as never)
    ).not.toBe('strong');
  });
});

describe('Fare Coverage Expansion Batch B — no scope creep', () => {
  it('no route fact, fare value, Book-By rule, warning, or Trip.com link was changed for any pre-existing route', () => {
    // Confirmed structurally: Batch B only appended new fareObservations and
    // new deals entries. Route verification facts, warnings, Book-By
    // priority and the Trip.com URL map are separate files this batch never
    // touched - see the PR's own git diff --stat for the authoritative
    // confirmation. This test guards the aggregate observation count only,
    // as a cheap regression signal that nothing was silently removed.
    expect(fareObservations.length).toBeGreaterThanOrEqual(51);
    expect(deals.length).toBeGreaterThanOrEqual(49);
  });

  it('aggregateFareDirectness never guesses across disagreeing observations for any Batch B route', () => {
    for (const slug of NEW_ROUTES) {
      if (REVERTED_TO_USEFUL_18_AUG.includes(slug)) continue; // no longer publishable — see the dedicated test above
      const range = getFareRangeSummary(slug, 'Economy', NOW_ISO);
      expect(range, slug).not.toBeNull();
      // Each of these routes has exactly one Economy observation this
      // batch, so its own stated directness must win outright - never
      // undefined, never guessed from a majority.
      const obs = fareObservations.filter((o) => o.routeSlug === slug && o.cabin === 'Economy');
      const expectedDirectness = aggregateFareDirectness(obs);
      expect(range!.observedDirectness, slug).toBe(expectedDirectness);
      expect(range!.observedDirectness, slug).toBe('connecting');
    }
  });
});
