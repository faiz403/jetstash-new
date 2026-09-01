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

  it('no Batch A observation outside the two full-evidence entries has a direct/connecting value', () => {
    // Scoped to Batch A's own known observation IDs (outboundOnlyIds above),
    // not "every observation dated 2026-08-06" - Fare Coverage Expansion
    // Batch B (also 6 August 2026, run after RIS-001) added 10 more
    // observations the same day, under its OWN, deliberately different
    // directness convention (a confirmed-connecting outbound alone is
    // enough to record 'connecting' - see
    // tests/fare-coverage-batch-b.test.ts and FARE_COVERAGE_BATCH_B.md §3).
    // Filtering by date alone would incorrectly apply Batch A's stricter
    // rule to Batch B's entries.
    for (const id of outboundOnlyIds) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeDefined();
      expect(obs.fareDirectness, id).not.toBe('direct');
      // Every Batch A outbound-only observation must be 'unknown', not a
      // bare 'connecting' either - even a genuinely-connecting-looking
      // outbound leg does not confirm the return leg under BATCH A's OWN
      // convention, so it must never silently read as confirmed.
      if (obs.fareDirectness !== undefined) {
        expect(obs.fareDirectness, id).toBe('unknown');
      }
    }
  });
});

describe('fareDirectness resolution rules the audit established', () => {
  // Temporal-causality fix (1 Sep 2026): both tests below explicitly test
  // what a LATER round of evidence resolves to (Classification B — the
  // test's own title names the later evidence it depends on), not the 6
  // August Batch A snapshot the rest of this file reconstructs. Each gets
  // its own local evaluation date fixed to the earliest date the specific
  // evidence it names actually existed, rather than sharing the file's
  // NOW_ISO — moving the shared constant would incorrectly let this later
  // evidence leak into the genuine 6-August reconstructions above.
  it('the 6 August unknown value is not a guess, while the later fully reviewed options aggregate as connecting', () => {
    // Earliest date manchester-islamabad has real, stated 'connecting'
    // evidence (the three 10 August Turkish Airlines/Etihad checks) --
    // the 6 August entry itself is 'unknown' and correctly excluded from
    // the aggregate by aggregateFareDirectness().
    const EARLIEST_CONNECTING_EVIDENCE_ISO = '2026-08-10';
    const range = getFareRangeSummary('manchester-islamabad', 'Economy', EARLIEST_CONNECTING_EVIDENCE_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBe('connecting');
  });

  it('Manchester-Doha now resolves to a real, evidenced "connecting" once the 18 August Weekly Full Fare Refresh #1 observation supplied the route/cabin\'s first ever stated fareDirectness value - honest aggregation, not a guess (previously undefined: one observation predates the field, one is explicitly \'unknown\', neither states \'direct\'/\'connecting\')', () => {
    // The 18 August observation this test's own title names.
    const WEEKLY_FULL_FARE_REFRESH_1_ISO = '2026-08-18';
    const range = getFareRangeSummary('manchester-doha', 'Economy', WEEKLY_FULL_FARE_REFRESH_1_ISO);
    expect(range).not.toBeNull();
    expect(range!.count).toBe(3);
    expect(range!.observedDirectness).toBe('connecting');
  });

  it('Manchester-Dubai and Manchester-Lahore keep their genuine, evidence-backed directness after the audit', () => {
    expect(getFareRangeSummary('manchester-dubai', 'Economy', NOW_ISO)!.observedDirectness).toBe('connecting');
    expect(getFareRangeSummary('manchester-lahore', 'Economy', NOW_ISO)!.observedDirectness).toBe('connecting');
  });
});

describe('bhx-atq-economy reflects the latest evidence-complete observation', () => {
  it('shows Connecting only after both legs were reviewed', () => {
    // Classification B: birmingham-amritsar's 6 August entry is itself
    // 'unknown' (outbound-only); the earliest stated 'connecting' evidence
    // is the 11 August KLM/IndiGo/Air India check.
    const EARLIEST_CONNECTING_EVIDENCE_ISO = '2026-08-11';
    const deal = deals.find((d) => d.id === 'bhx-atq-economy')!;
    const label = getDealFareDirectnessLabel(deal, EARLIEST_CONNECTING_EVIDENCE_ISO);
    expect(label).toBe('Connecting');
    expect(label).not.toBe('Direct flight');
  });
});

describe('Route-level Fare Signal coverage and curated Deal-card coverage remain distinct', () => {
  // Deal entries are a curated card catalogue, not a second copy of the
  // observation archive. These routes have valid current Fare Signals but no
  // curated Economy card by design; they must still count in route-level
  // coverage and on the /deals hero.
  const fareSignalOnlyRoutes = new Set([
    // Fare Coverage Batch 1 (22 August 2026): leeds-bradford-bodrum,
    // birmingham-lahore and birmingham-islamabad each gained a fresh
    // publishable observation but have no curated Economy Deal card.
    // manchester-karachi also gained one but DOES have an existing Economy
    // Deal (man-khi-economy), so it's correctly excluded from this set.
    'leeds-bradford-bodrum',
    'birmingham-lahore',
    'birmingham-islamabad',
    // Connecting Journey Structure + BHX-DEL unlock (22 August 2026):
    // birmingham-delhi gained a fresh publishable observation but has no
    // curated Economy Deal card (only lhr-del-economy and man-del-economy
    // exist for Delhi).
    'birmingham-delhi',
    'london-heathrow-jeddah',
    'manchester-istanbul',
    'manchester-antalya',
    'manchester-izmir',
    'manchester-marrakech',
    'manchester-agadir',
    'birmingham-istanbul',
    'birmingham-antalya',
    'birmingham-dalaman',
    'birmingham-bodrum',
    'leeds-bradford-antalya',
    'leeds-bradford-dalaman',
    'birmingham-dubai',
    'birmingham-doha',
    'birmingham-jeddah',
    'glasgow-dubai',
    'edinburgh-dubai',
    'newcastle-dubai',
    'bristol-faro',
    'manchester-faro',
    'birmingham-faro',
    'leeds-bradford-faro',
    'bristol-dalaman',
    'glasgow-antalya',
    'london-heathrow-lahore',
    'london-heathrow-dubai',
    'london-gatwick-dubai',
    'glasgow-dalaman',
    'bristol-antalya',
    'newcastle-dalaman',
    'bristol-marrakech',
    'birmingham-agadir',
    'birmingham-athens',
    'london-gatwick-antalya',
    'london-gatwick-bodrum',
    'london-gatwick-faro',
    'london-gatwick-barcelona',
    'birmingham-rome',
    'birmingham-barcelona',
    'bristol-barcelona',
    'leeds-bradford-barcelona',
    'london-gatwick-rome',
    'london-gatwick-athens',
    'london-gatwick-dalaman',
    'glasgow-bodrum',
    'bristol-rome',
    'london-gatwick-istanbul',
    'london-gatwick-marrakech',
  ]);

  it('every route-level tracked fare is either represented by a curated Economy card or explicitly remains Fare-Signal-only', () => {
    // Classification B: this test's own comment trail narrates coverage
    // through 22 August 2026 (79→78→82→83) — the file's 6 August NOW_ISO
    // was never this test's true evaluation date. Fixed at the date the
    // narrated 83-route state actually existed.
    const COVERAGE_83_ROUTES_ISO = '2026-08-22';
    const trackedRoutes = routes.filter((r) => getPublishableObservationsByRoute(r.slug, COVERAGE_83_ROUTES_ISO).length > 0);
    // 79→78 on 18 August 2026: Route Verification Refresh Batch 1's correction
    // reclassified london-gatwick-ahmedabad unverified, which drops its fare
    // observation out of isObservationPublishable() — see ROUTE_VERIFICATION_CADENCE_POLICY.md.
    // 78→82 on 22 August 2026 (Fare Coverage Batch 1) — see
    // tests/fare-coverage-batch-3.test.ts's identical update.
    // 82→83 on 22 August 2026 (Connecting Journey Structure + BHX-DEL
    // unlock): birmingham-delhi gained a fresh publishable observation.
    expect(trackedRoutes.length).toBe(83);
    for (const route of trackedRoutes) {
      const matchingDeal = deals.find(
        (d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug && d.cabin === 'Economy' && !isBundledProductDeal(d)
      );
      if (fareSignalOnlyRoutes.has(route.slug)) {
        expect(matchingDeal, route.slug).toBeUndefined();
      } else {
        expect(matchingDeal, `${route.slug} should have a curated Economy card`).toBeDefined();
      }
    }
    expect(fareSignalOnlyRoutes.size).toBe(52);
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
  // This test originally asserted these two routes graded 'strong' on the
  // bare connectingAlternative+fare minimum - that finding is exactly what
  // Route Intelligence Scoring v2 (RIS-001, 6 August 2026) was scoped to
  // fix. Under RIS-001's Gate 2 (diversity), a route whose only two
  // categories are connectingAlternative and a fare observation no longer
  // qualifies for Strong. See ROUTE_COVERAGE_AUDIT.md's "Route Intelligence
  // Scoring v2 (RIS-001)" addendum for the full model and the recomputed
  // 32-route table.
  it('Manchester-Amritsar and Manchester-Ahmedabad have exactly the minimum two categories (connectingAlternative + fare) and correctly grade "useful" under RIS-001\'s diversity gate, not "strong"', () => {
    for (const slug of ['manchester-amritsar', 'manchester-ahmedabad']) {
      const route = routes.find((r) => r.slug === slug)!;
      expect(Boolean(route.connectingAlternative), `${slug} connectingAlternative`).toBe(true);
      expect(getPublishableObservationsByRoute(slug, NOW_ISO).length > 0, `${slug} fare`).toBe(true);
      // Neither route has any of the four "substantive" categories -
      // confirming the "bare minimum, nothing else" finding stays true and
      // visible, rather than silently acquiring more depth unnoticed.
      expect(Boolean(route.airlineVerifications?.length), `${slug} airline-verif`).toBe(false);
      expect(getActiveWarningsByRoute(slug).length > 0, `${slug} warning`).toBe(false);
      // RIS-001: connectingAlternative + fare alone is not enough for Strong.
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('useful');
    }
  });
});

describe('Country aggregation cannot overstate coverage', () => {
  const fakePoint = (intelligenceLevel: 'strong' | 'useful' | 'expanding'): DestinationPoint =>
    ({ intelligenceLevel } as unknown as DestinationPoint);

  // This test originally asserted all four Manchester India destinations
  // graded 'strong' and the country aggregate followed suit - that was the
  // exact "technically correctly aggregated but inflated in practice"
  // finding Route Intelligence Scoring v2 (RIS-001, 6 August 2026) was
  // scoped to fix (see the evidence-completeness audit's Part 2, and the
  // RIS-001 addendum, both in ROUTE_COVERAGE_AUDIT.md). Under RIS-001,
  // Amritsar and Ahmedabad no longer qualify for Strong (connectingAlternative
  // + fare alone, no substantive category), so the aggregation logic itself
  // - unchanged, still conservative - now correctly reports Mixed rather than
  // Strong for Manchester India.
  it('Manchester India is Mixed under RIS-001 - Delhi and Mumbai are genuinely Strong, Amritsar and Ahmedabad are not, and the conservative aggregation rule reflects that honestly rather than overstating country-level confidence', () => {
    const indiaDestinationSlugs = ['delhi', 'mumbai', 'amritsar', 'ahmedabad'];
    const manchesterIndiaRoutes = routes.filter((r) => r.airportSlug === 'manchester' && indiaDestinationSlugs.includes(r.destinationSlug));
    expect(manchesterIndiaRoutes.length).toBeGreaterThanOrEqual(4);
    const levels = manchesterIndiaRoutes.map((r) => computeRouteIntelligenceLevel(r, NOW_ISO));
    const bySlug = Object.fromEntries(manchesterIndiaRoutes.map((r, i) => [r.destinationSlug, levels[i]]));
    expect(bySlug.delhi, 'delhi').toBe('strong');
    expect(bySlug.mumbai, 'mumbai').toBe('strong');
    expect(bySlug.amritsar, 'amritsar').toBe('useful');
    expect(bySlug.ahmedabad, 'ahmedabad').toBe('useful');
    const aggregate = aggregateCountryIntelligence(levels.map(fakePoint));
    expect(aggregate).toBe('mixed');
  });

  it('a single non-strong destination would prevent the country from reading strong (the conservative rule is not bypassed)', () => {
    const aggregate = aggregateCountryIntelligence(['strong', 'strong', 'strong', 'useful'].map((l) => fakePoint(l as 'strong' | 'useful')));
    expect(aggregate).not.toBe('strong');
  });
});
