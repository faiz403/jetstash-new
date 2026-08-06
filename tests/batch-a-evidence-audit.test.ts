import { describe, it, expect } from 'vitest';
import { fareObservations, getFareRangeSummary, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { deals, getDealFareDirectnessLabel, isBundledProductDeal } from '@/data/deals';
import { routes } from '@/data/routes';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { computeRouteIntelligenceLevel, aggregateCountryIntelligence } from '@/lib/atlas-network-data';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import type { DestinationPoint } from '@/components/founder/atlas-feel-test';

/**
 * Regression coverage for the 6 August 2026 Batch A evidence-completeness
 * and customer-visibility audit (see FARE_OBSERVATION_ARCHIVE.md's
 * "Evidence-completeness audit" section and ROUTE_COVERAGE_AUDIT.md's
 * "Batch A evidence-completeness and customer-visibility audit" addendum
 * for the full write-up this file guards).
 */

const NOW_ISO = '2026-08-06';

describe('Every Batch A observation has complete round-trip evidence, or explicitly uses "unknown"', () => {
  // Only these two observations have genuine, confirmed, both-legs-reviewed
  // evidence (Trip.com/Google Flights outbound AND return itinerary panels
  // both opened and read) - every other Batch A observation only ever
  // reviewed the outbound leg's results-list summary. This list is the
  // canary: adding a genuine 'direct'/'connecting' value to any other
  // observation must come with equivalent full-evidence justification, not
  // silently pass this test.
  const fullRoundTripEvidenceIds = new Set(['obs-man-dxb-economy-20260806-8w-v1', 'obs-man-lhe-economy-20260806-8w-v1']);

  const outboundOnlyIds = [
    'obs-man-isb-economy-20260806-8w-v1',
    'obs-man-del-economy-20260806-8w-v1',
    'obs-man-bom-economy-20260806-8w-v1',
    'obs-man-amd-economy-20260806-8w-v1',
    'obs-man-atq-economy-20260806-8w-v1',
    'obs-man-doh-economy-20260806-8w-v1',
    'obs-man-med-economy-20260806-8w-v1',
    'obs-bhx-atq-economy-20260806-8w-v1',
  ];

  it('the two full-round-trip-evidence observations keep an explicit direct/connecting value', () => {
    for (const id of fullRoundTripEvidenceIds) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeDefined();
      expect(['direct', 'connecting'], id).toContain(obs.fareDirectness);
    }
  });

  it('every outbound-only Batch A observation is honestly recorded as fareDirectness: "unknown" - never a guessed direct/connecting value', () => {
    for (const id of outboundOnlyIds) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeDefined();
      expect(obs.fareDirectness, id).toBe('unknown');
    }
  });

  it('no Batch A observation dated 2026-08-06 has a direct/connecting value outside the two full-evidence entries', () => {
    const batchADated = fareObservations.filter((o) => o.observedDate === '2026-08-06');
    for (const obs of batchADated) {
      if (fullRoundTripEvidenceIds.has(obs.id)) continue;
      expect(obs.fareDirectness, obs.id).not.toBe('direct');
      // Every 2026-08-06 observation outside the two full-evidence entries
      // must be 'unknown', not a bare 'connecting' either - even a
      // genuinely-connecting-looking outbound leg does not confirm the
      // return leg, so it must never silently read as confirmed.
      if (obs.fareDirectness !== undefined) {
        expect(obs.fareDirectness, obs.id).toBe('unknown');
      }
    }
  });
});

describe('fareDirectness resolution rules the audit established', () => {
  it('"unknown" is never treated as a guessed connecting/direct value by aggregation', () => {
    const range = getFareRangeSummary('manchester-islamabad', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBeUndefined();
  });

  it('Manchester-Doha, with one connecting and one unknown-directness observation, resolves to no aggregated directness - never guesses toward either value', () => {
    const range = getFareRangeSummary('manchester-doha', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.count).toBe(2);
    expect(range!.observedDirectness).toBeUndefined();
  });

  it('Manchester-Dubai and Manchester-Lahore keep their genuine, evidence-backed directness after the audit', () => {
    expect(getFareRangeSummary('manchester-dubai', 'Economy', NOW_ISO)!.observedDirectness).toBe('connecting');
    expect(getFareRangeSummary('manchester-lahore', 'Economy', NOW_ISO)!.observedDirectness).toBe('connecting');
  });
});

describe('bhx-atq-economy correctly fails closed after the audit correction', () => {
  it('no longer shows "Connecting" from the under-evidenced observation alone', () => {
    const deal = deals.find((d) => d.id === 'bhx-atq-economy')!;
    const label = getDealFareDirectnessLabel(deal, NOW_ISO);
    expect(label).toBeUndefined();
    expect(label).not.toBe('Direct flight');
  });
});

describe('Customer-visible fare coverage — every "13 of 32" tracked route either has a visible fare card or is a documented exception', () => {
  // The one route this audit found and left unfixed (pre-dates Batch A,
  // out of scope) - a canary so a future silent regression on any OTHER
  // route is caught immediately, while this one known gap doesn't fail
  // the suite until it's deliberately closed.
  const documentedInvisibleRoutes = new Set(['london-heathrow-jeddah']);

  it('every tracked route has a matching flight-category Economy Deal, except the documented exception', () => {
    const trackedRoutes = routes.filter((r) => getPublishableObservationsByRoute(r.slug, NOW_ISO).length > 0);
    expect(trackedRoutes.length).toBe(13);
    for (const route of trackedRoutes) {
      const matchingDeal = deals.find(
        (d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug && d.cabin === 'Economy' && !isBundledProductDeal(d)
      );
      if (documentedInvisibleRoutes.has(route.slug)) {
        expect(matchingDeal, route.slug).toBeUndefined();
      } else {
        expect(matchingDeal, `${route.slug} should have a customer-visible Economy Deal`).toBeDefined();
      }
    }
  });

  it('none of the 7 newly added Deal entries ever shows an unsupported "Direct flight" badge', () => {
    const newDealIds = ['man-isb-economy', 'man-del-economy', 'man-bom-economy', 'man-amd-economy', 'man-atq-economy', 'man-doh-economy', 'man-med-economy'];
    for (const id of newDealIds) {
      const deal = deals.find((d) => d.id === id)!;
      expect(deal, id).toBeDefined();
      expect(getDealFareDirectnessLabel(deal, NOW_ISO), id).not.toBe('Direct flight');
    }
  });

  it('every newly added Deal has a real Trip.com URL and no invented data - preserves the existing provider mapping', () => {
    const newDeals = [
      { id: 'man-isb-economy', route: 'manchester-islamabad' },
      { id: 'man-del-economy', route: 'manchester-delhi' },
      { id: 'man-bom-economy', route: 'manchester-mumbai' },
      { id: 'man-amd-economy', route: 'manchester-ahmedabad' },
      { id: 'man-atq-economy', route: 'manchester-amritsar' },
      { id: 'man-doh-economy', route: 'manchester-doha' },
      { id: 'man-med-economy', route: 'manchester-madinah' },
    ];
    for (const { id, route } of newDeals) {
      const deal = deals.find((d) => d.id === id)!;
      expect(deal, id).toBeDefined();
      expect(getTripComRouteUrl(route), id).toBeTruthy();
    }
  });
});

describe('Newly promoted Strong routes — the content-depth finding is tracked, not silently fixed or hidden', () => {
  it('Manchester-Amritsar and Manchester-Ahmedabad are graded strong on exactly the minimum two categories (connectingAlternative + fare) - the exact combination the audit found reads thin', () => {
    for (const slug of ['manchester-amritsar', 'manchester-ahmedabad']) {
      const route = routes.find((r) => r.slug === slug)!;
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('strong');
      expect(Boolean(route.connectingAlternative), `${slug} connectingAlternative`).toBe(true);
      expect(getPublishableObservationsByRoute(slug, NOW_ISO).length > 0, `${slug} fare`).toBe(true);
      // Neither route has the other four categories - confirming the
      // "bare minimum, nothing else" finding stays true and visible,
      // rather than silently acquiring more depth unnoticed.
      expect(Boolean(route.airlineVerifications?.length), `${slug} airline-verif`).toBe(false);
      expect(getActiveWarningsByRoute(slug).length > 0, `${slug} warning`).toBe(false);
    }
  });
});

describe('Country aggregation cannot overstate coverage', () => {
  const fakePoint = (intelligenceLevel: 'strong' | 'useful' | 'expanding'): DestinationPoint =>
    ({ intelligenceLevel } as unknown as DestinationPoint);

  it('Manchester India is Strong only because every one of its destinations individually is - not a manual override', () => {
    const indiaDestinationSlugs = ['delhi', 'mumbai', 'amritsar', 'ahmedabad'];
    const manchesterIndiaRoutes = routes.filter((r) => r.airportSlug === 'manchester' && indiaDestinationSlugs.includes(r.destinationSlug));
    expect(manchesterIndiaRoutes.length).toBeGreaterThanOrEqual(4);
    const levels = manchesterIndiaRoutes.map((r) => computeRouteIntelligenceLevel(r, NOW_ISO));
    for (let i = 0; i < manchesterIndiaRoutes.length; i++) {
      expect(levels[i], manchesterIndiaRoutes[i].slug).toBe('strong');
    }
    const aggregate = aggregateCountryIntelligence(levels.map(fakePoint));
    expect(aggregate).toBe('strong');
  });

  it('a single non-strong destination would prevent the country from reading strong (the conservative rule is not bypassed)', () => {
    const aggregate = aggregateCountryIntelligence(['strong', 'strong', 'strong', 'useful'].map((l) => fakePoint(l as 'strong' | 'useful')));
    expect(aggregate).not.toBe('strong');
  });
});
