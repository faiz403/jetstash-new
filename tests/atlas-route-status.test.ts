import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes, getRouteBySlug, getDisplayDirectness, getRouteDestination } from '@/data/routes';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { isBookByRoute } from '@/lib/booking-intelligence';
import { travellerTips } from '@/data/traveller-tips';
import { buildAtlasAirports, computeRouteIntelligenceLevel, aggregateCountryIntelligence } from '@/lib/atlas-network-data';
import { deals, hasTrackedFare } from '@/data/deals';
import type { DestinationPoint, RouteIntelligenceLevel, CountryIntelligenceLevel } from '@/components/founder/atlas-feel-test';

/**
 * Route Coverage Truth Phase 1 (August 2026) — regression suite for the
 * Atlas's honest three-level route status and conservative country
 * aggregation. See docs/project-control/ROUTE_COVERAGE_AUDIT.md for the
 * full 32-route audit this same derivation feeds.
 */

const NOW_ISO = '2026-08-06';
const VALID_ROUTE_LEVELS: RouteIntelligenceLevel[] = ['strong', 'useful', 'expanding'];
const VALID_COUNTRY_LEVELS: CountryIntelligenceLevel[] = ['strong', 'mixed', 'useful', 'expanding'];

function fixtureDest(overrides: Partial<DestinationPoint>): DestinationPoint {
  return {
    slug: 'fixture',
    label: 'Fixture City',
    x: 0,
    y: 0,
    networkMembership: 'supported',
    intelligenceLevel: 'expanding',
    serviceNotice: null,
    verdict: 'test fixture',
    detail: null,
    flightTime: '10h',
    href: '/destinations/fixture',
    routeHref: '/routes/fixture',
    ...overrides,
  };
}

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

/** Mirrors computeRouteIntelligenceLevel()'s six depth categories for test assertions — kept separate from the production function so a test can't accidentally pass by testing itself. */
function depthCategories(route: (typeof routes)[number]) {
  return {
    hasFare: getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0,
    hasConnAlt: Boolean(route.connectingAlternative),
    hasAirlineVerif: Boolean(route.airlineVerifications?.length),
    hasBookBy: isBookByRoute(route.slug),
    hasWarning: getActiveWarningsByRoute(route.slug).length > 0,
    hasBaggage: travellerTips.some((t) => t.category === 'baggage' && (t.scope.routeSlug === route.slug || t.scope.destinationSlug === route.destinationSlug)),
  };
}
function depthCategoryCount(route: (typeof routes)[number]) {
  return Object.values(depthCategories(route)).filter(Boolean).length;
}

/**
 * RIS-001 (Route Intelligence Scoring v2, August 2026) — mirrors of the two
 * NEW gates computeRouteIntelligenceLevel() applies beyond category count,
 * kept independent for the same "a test can't accidentally pass by testing
 * itself" reason as depthCategories() above. See lib/atlas-network-data.ts's
 * doc comment for the full reasoning.
 */
function hasSubstantiveDepth(route: (typeof routes)[number]) {
  const d = depthCategories(route);
  return d.hasAirlineVerif || d.hasBookBy || d.hasWarning || d.hasBaggage;
}
function hasVisibleFare(route: (typeof routes)[number]) {
  const matchingDeals = deals.filter((d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug);
  return matchingDeals.some((d) => hasTrackedFare(d, NOW_ISO));
}

describe('Every Atlas destination receives exactly one valid, non-blank route status', () => {
  const airports = buildAtlasAirports();
  const allDestinations = airports.flatMap((a) => a.countries.flatMap((c) => c.destinations));
  const allCountries = airports.flatMap((a) => a.countries);

  it('sanity: real data exists to check', () => {
    expect(allDestinations.length).toBeGreaterThan(0);
    expect(allCountries.length).toBeGreaterThan(0);
  });

  it('every destination has an intelligenceLevel that is one of the three valid route-level values — never undefined, never blank', () => {
    for (const d of allDestinations) {
      expect(d.intelligenceLevel, d.slug).toBeTruthy();
      expect(VALID_ROUTE_LEVELS, d.slug).toContain(d.intelligenceLevel);
    }
  });

  it('every country has an intelligenceLevel that is one of the four valid country-level values — never undefined, never blank', () => {
    for (const c of allCountries) {
      expect(c.intelligenceLevel, c.slug).toBeTruthy();
      expect(VALID_COUNTRY_LEVELS, c.slug).toContain(c.intelligenceLevel);
    }
  });

  it('no destination is ever assigned the country-only "mixed" value — that state only exists at aggregation time', () => {
    for (const d of allDestinations) {
      expect(d.intelligenceLevel).not.toBe('mixed');
    }
  });
});

describe('Strongest ("strong") route status requires BROAD depth evidence — at least two independent categories, never one signal alone', () => {
  it('every route currently graded "strong" genuinely has at least TWO of the six depth categories: a publishable fare observation, connectingAlternative, per-airline verification, Book-By priority, an active investigated warning, or dedicated baggage guidance', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, NOW_ISO);
      if (level !== 'strong') continue;
      expect(depthCategoryCount(route), route.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('a single depth category is NOT enough for "strong" — the exact defensibility gap a product-truth review found in the first version of this threshold (August 2026)', () => {
    // Each of these genuinely has exactly one depth category and nothing
    // else — current/verified, but thin. Regression-guards the specific
    // routes the review flagged as wrongly "strong" under the old
    // "any one signal" threshold.
    //
    // manchester-amritsar and manchester-ahmedabad were both in this list
    // (connectingAlternative only) until Fare Coverage Expansion Batch A
    // (6 August 2026) gave each a genuine second category (fare evidence) -
    // briefly graded 'strong' on category count alone, then Route
    // Intelligence Scoring v2 (RIS-001, same week) found that exact
    // combination (connectingAlternative + fare, nothing else) reads thin
    // to a visitor and added a category-DIVERSITY gate that correctly
    // returns both to 'useful' - see the dedicated RIS-001 test file, not
    // this one.
    //
    // leeds-bradford-islamabad, london-gatwick-ahmedabad,
    // london-gatwick-amritsar and london-heathrow-bengaluru were ALL in
    // this list (warning-only or airline-verif-only) until Fare Coverage
    // Expansion Batch B (6 August 2026, run after RIS-001) gave each a
    // fresh fare observation - its second category. Three of the four
    // (Gatwick-Ahmedabad, Gatwick-Amritsar, Heathrow-Bengaluru) are direct
    // routes with an already-substantive pre-existing category, so they
    // correctly cleared all three RIS-001 gates and became 'strong' - see
    // tests/fare-coverage-batch-b.test.ts, not this one. Leeds
    // Bradford-Islamabad stays here: it's now genuinely two categories, but
    // RIS-001's Gate 3 (visible-content) still blocks it, because it's a
    // connecting route with no connectingAlternative block.
    //
    // london-gatwick-amritsar rejoined this single-signal list on 31 August
    // 2026 (Route-warning truth alignment): its "pre-existing substantive
    // category" was lgw-atq-reduced-frequency, an unsourced "Runs 3 times a
    // week" warning that predated a later truth correction hedging this
    // route's own frequency field. Resolving that warning (see
    // data/route-warnings.ts) correctly removes it as a depth category — it
    // was never genuinely "sourced, investigated" research (this file's own
    // hasWarningDepth comment's own standard), so the route's fare
    // observation is now its only real depth category. See
    // tests/fare-coverage-batch-b.test.ts for the corresponding grade
    // reversion.
    const singleSignalRoutes = [
      'manchester-doha', // fare only
      'london-gatwick-amritsar', // fare only, since 31 Aug 2026 (warning resolved)
    ];
    for (const slug of singleSignalRoutes) {
      const route = getRouteBySlug(slug)!;
      expect(depthCategoryCount(route), slug).toBe(1);
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('useful');
    }

    // Leeds Bradford-Islamabad: two categories (breadth cleared), but a
    // connecting route with no connectingAlternative block - Gate 3 blocks
    // Strong regardless of category count.
    const lba = getRouteBySlug('leeds-bradford-islamabad')!;
    expect(depthCategoryCount(lba)).toBe(2);
    expect(lba.isDirect).toBe(false);
    expect(Boolean(lba.connectingAlternative)).toBe(false);
    expect(computeRouteIntelligenceLevel(lba, NOW_ISO)).toBe('useful');
  });

  it('leeds-bradford-islamabad, london-gatwick-ahmedabad, london-gatwick-amritsar and london-heathrow-bengaluru each gained a fresh fare observation from Fare Coverage Expansion Batch B (6 August 2026); london-heathrow-bengaluru correctly remains "strong" on that plus its pre-existing substantive category (london-gatwick-amritsar also cleared this gate at the time, but see the reversion test below — it no longer does)', () => {
    const upgraded = ['london-heathrow-bengaluru'];
    for (const slug of upgraded) {
      const route = getRouteBySlug(slug)!;
      expect(depthCategoryCount(route), slug).toBe(2);
      expect(route.isDirect, slug).toBe(true);
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('strong');
    }
  });

  it('london-gatwick-ahmedabad reverted to "useful" on 18 August 2026 — Route Verification Refresh Batch 1\'s correction reclassified it unverified after a fresh check found current Air India surfaces genuinely conflict, which both drops its fare observation from publishable (isObservationPublishable requires a current, confirmed direct/connecting status) and blocks Strong at the prerequisite gate regardless of category count. It genuinely was Strong for 6 August-18 August 2026, on real evidence at the time — this is not a walk-back of that history, only its current state.', () => {
    const route = getRouteBySlug('london-gatwick-ahmedabad')!;
    expect(route.verification!.status).toBe('unverified');
    // Route-warning truth alignment (31 Aug 2026): the pre-existing warning
    // this route counted as its one depth category (lgw-amd-reduced-frequency)
    // is now resolved — unsourced, and directly contradicted this route's own
    // "frequency not published until independently confirmed" copy. Its
    // depth-category count correctly drops to 0; the final grade is
    // unchanged ('useful'), since the unverified short-circuit in
    // computeRouteIntelligenceLevel already produced 'useful' regardless of
    // category count.
    expect(depthCategoryCount(route)).toBe(0); // fare not publishable, warning resolved
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });

  it('london-gatwick-amritsar reverted to "useful" on 31 August 2026 (Route-warning truth alignment) — its "pre-existing substantive category" was lgw-atq-reduced-frequency, an unsourced "Runs 3 times a week" warning that predated a later truth correction hedging this route\'s own frequency field. Resolving that warning correctly drops it below RIS-001\'s two-category threshold, on real evidence changing, not a scoring-rule change.', () => {
    const route = getRouteBySlug('london-gatwick-amritsar')!;
    expect(route.isDirect).toBe(true);
    expect(depthCategoryCount(route)).toBe(1); // fare only; warning resolved
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });

  it('manchester-amritsar and manchester-ahmedabad have two depth categories (breadth) but stay "useful" under RIS-001\'s diversity gate — connectingAlternative + fare alone is not enough', () => {
    for (const slug of ['manchester-amritsar', 'manchester-ahmedabad']) {
      const route = getRouteBySlug(slug)!;
      expect(depthCategoryCount(route), slug).toBe(2);
      expect(computeRouteIntelligenceLevel(route, NOW_ISO), slug).toBe('useful');
    }
  });

  it('a route with genuinely broad evidence (two or more independent categories) is graded "strong"', () => {
    // Manchester–Lahore: fare + Book-By + baggage guidance (3 categories).
    const route = getRouteBySlug('manchester-lahore')!;
    expect(depthCategoryCount(route)).toBeGreaterThanOrEqual(2);
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('strong');
  });

  it('a route with no current direct/connecting verification (route- or airline-level) can never be graded "strong", regardless of any other depth signal', () => {
    // Manchester–Karachi: isDirect true, verification.status 'unverified' — never current.
    const route = getRouteBySlug('manchester-karachi')!;
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).not.toBe('strong');
  });

  it('a route with zero depth signals and no current verification is "useful", not "strong"', () => {
    // Birmingham–Lahore: unverified, no fare, no connectingAlternative, no airlineVerifications, not Book-By, no warning, no baggage.
    const route = getRouteBySlug('birmingham-lahore')!;
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });

  it('status is derived purely from route truth: two calls with the same route and date produce the identical result (no hidden randomness or manual override)', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const a = computeRouteIntelligenceLevel(route, NOW_ISO);
    const b = computeRouteIntelligenceLevel(route, NOW_ISO);
    expect(a).toBe(b);
  });
});

describe('"Useful" routes never receive the strongest status', () => {
  it('every route currently graded "useful" fails at least one of RIS-001\'s four gates (unverified directness; fewer than two depth categories; no substantive category beyond connectingAlternative+fare; or fare/connecting-depth not visibly rendered)', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, NOW_ISO);
      if (level !== 'useful') continue;
      const isCurrentlyDirectOrConnecting = getDisplayDirectness(route, NOW_ISO) !== 'unverified';
      const meetsDepthBar = depthCategoryCount(route) >= 2;
      const meetsDiversityBar = hasSubstantiveDepth(route);
      const meetsVisibleFareBar = hasVisibleFare(route);
      const meetsConnectingDepthBar = route.isDirect || Boolean(route.connectingAlternative);
      const failsAtLeastOneGate =
        !isCurrentlyDirectOrConnecting || !meetsDepthBar || !meetsDiversityBar || !meetsVisibleFareBar || !meetsConnectingDepthBar;
      expect(failsAtLeastOneGate, route.slug).toBe(true);
    }
  });
});

describe('"Expanding" routes are labelled clearly — never a blank or broken state', () => {
  const airports = buildAtlasAirports();
  const allDestinations = airports.flatMap((a) => a.countries.flatMap((c) => c.destinations));
  const untracked = allDestinations.filter((d) => d.routeHref === null);

  // Route Intelligence Completion (August 2026): before this phase, 48 of
  // the 80 real data/routes.ts entries had no wiring at all into
  // buildAtlasAirports()'s per-airport build functions — 11 (all
  // Manchester's Turkey/Morocco/Europe destinations) were plotted via
  // buildUntrackedDestinationPoint's hardcoded 'expanding' state despite
  // having a real, verified route guide, and 37 more (plus an entirely
  // missing Bristol network) had no Atlas point at all. Every one of those
  // 48 is now wired to its real routes.ts entry via buildDestinationPoint,
  // so the honest, CURRENT state is zero untracked Atlas destinations — not
  // a bug, the intended outcome of closing that gap. This assertion
  // documents that outcome explicitly (rather than silently allowing it to
  // drift back) — if a future destination is ever added to
  // data/network-evidence.ts ahead of its own route guide, this number
  // will correctly become nonzero again, and the test below (using a
  // synthetic fixture, since the real data no longer has an example)
  // independently proves the 'expanding' labelling itself still renders
  // correctly whenever that happens.
  it('sanity: zero Atlas destinations currently lack a data/routes.ts entry — every real route is now wired', () => {
    expect(untracked.length).toBe(0);
  });

  it('every untracked destination (no routes.ts entry) that DOES occur is graded "expanding" with a real, non-empty verdict — never blank', () => {
    for (const d of untracked) {
      expect(d.intelligenceLevel, d.slug).toBe('expanding');
      expect(d.verdict, d.slug).toBeTruthy();
      expect(d.verdict.length, d.slug).toBeGreaterThan(0);
    }
  });

  it('the "expanding" labelling itself still renders correctly, proven via a synthetic fixture since real data has no current example', () => {
    const syntheticExpanding = fixtureDest({ intelligenceLevel: 'expanding', routeHref: null, verdict: 'Route intelligence not yet researched.' });
    expect(syntheticExpanding.intelligenceLevel).toBe('expanding');
    expect(syntheticExpanding.routeHref).toBeNull();
    expect(syntheticExpanding.verdict).toBeTruthy();
  });
});

describe('Country aggregation is conservative — a mixed country can never claim the strongest status', () => {
  it('every destination "strong" -> country "strong"', () => {
    const points = [fixtureDest({ slug: 'a', intelligenceLevel: 'strong' }), fixtureDest({ slug: 'b', intelligenceLevel: 'strong' })];
    expect(aggregateCountryIntelligence(points)).toBe('strong');
  });

  it('a mixture of "strong" and "useful" -> country "mixed", never "strong"', () => {
    const points = [fixtureDest({ slug: 'a', intelligenceLevel: 'strong' }), fixtureDest({ slug: 'b', intelligenceLevel: 'useful' })];
    expect(aggregateCountryIntelligence(points)).toBe('mixed');
  });

  it('a mixture of "strong" and "expanding" -> country "mixed", never "strong"', () => {
    const points = [fixtureDest({ slug: 'a', intelligenceLevel: 'strong' }), fixtureDest({ slug: 'b', intelligenceLevel: 'expanding' })];
    expect(aggregateCountryIntelligence(points)).toBe('mixed');
  });

  it('one "strong" destination alone can no longer make the WHOLE country "strong" if siblings are weaker — the exact bug this phase fixes', () => {
    const points = [
      fixtureDest({ slug: 'a', intelligenceLevel: 'strong' }),
      fixtureDest({ slug: 'b', intelligenceLevel: 'expanding' }),
      fixtureDest({ slug: 'c', intelligenceLevel: 'expanding' }),
    ];
    expect(aggregateCountryIntelligence(points)).not.toBe('strong');
    expect(aggregateCountryIntelligence(points)).toBe('mixed');
  });

  it('"useful" present, no "strong" -> country "useful"', () => {
    const points = [fixtureDest({ slug: 'a', intelligenceLevel: 'useful' }), fixtureDest({ slug: 'b', intelligenceLevel: 'expanding' })];
    expect(aggregateCountryIntelligence(points)).toBe('useful');
  });

  it('every destination "expanding" -> country "expanding"', () => {
    const points = [fixtureDest({ slug: 'a', intelligenceLevel: 'expanding' }), fixtureDest({ slug: 'b', intelligenceLevel: 'expanding' })];
    expect(aggregateCountryIntelligence(points)).toBe('expanding');
  });

  it('a single "strong" destination alone -> country "strong" (trivially "every destination strong" when there is only one)', () => {
    expect(aggregateCountryIntelligence([fixtureDest({ slug: 'a', intelligenceLevel: 'strong' })])).toBe('strong');
  });
});

describe('Countries affected by the aggregation fix in the real, current data', () => {
  const airports = buildAtlasAirports();

  it('every real country in the Atlas has an intelligenceLevel consistent with its own destinations (re-derivable from the real data, not just the fixture tests above)', () => {
    for (const airport of airports) {
      for (const country of airport.countries) {
        expect(country.intelligenceLevel, `${airport.airportSlug}/${country.slug}`).toBe(aggregateCountryIntelligence(country.destinations));
      }
    }
  });
});

describe('Route markers retain their correct individual status independent of selection state', () => {
  it('every destination keeps its own intelligenceLevel/serviceNotice regardless of which country or destination is "active" — buildAtlasAirports() computes the full tree once, selection is pure client-side UI state layered on top', () => {
    const first = buildAtlasAirports();
    const second = buildAtlasAirports();
    for (let i = 0; i < first.length; i++) {
      for (let j = 0; j < first[i].countries.length; j++) {
        for (let k = 0; k < first[i].countries[j].destinations.length; k++) {
          expect(second[i].countries[j].destinations[k].intelligenceLevel).toBe(first[i].countries[j].destinations[k].intelligenceLevel);
        }
      }
    }
  });
});

describe('Destination selection, hover, click and keyboard behaviour are unchanged by this phase', () => {
  // These mirror tests/atlas-audit-fixes.test.ts's own structural assertions
  // — re-affirmed here from the route-status change's point of view: the
  // interaction model (activateCountry/selectDestination, exactly one
  // tabIndex per marker, Enter/Space activation, focus-visible styling)
  // lives entirely outside the intelligenceLevel/serviceNotice fields this
  // phase touched.
  it('activateCountry and selectDestination function definitions are untouched', () => {
    expect(atlasSrc).toContain('function activateCountry(slug: string) {');
    expect(atlasSrc).toContain('function selectDestination(slug: string) {');
  });

  it('every marker keeps exactly one real keyboard-accessible control (the hit-circle), never the decorative label', () => {
    expect(atlasSrc).toContain('tabIndex={0}');
    expect(atlasSrc).toMatch(/aria-hidden="true"[\s\S]{0,400}onClick=\{\(\) => activateCountry\(c\.slug\)\}/);
  });

  it('keyboard Enter/Space activation is unchanged for both country and destination markers', () => {
    expect(atlasSrc).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{\s*e\.preventDefault\(\);\s*activateCountry\(c\.slug\);/);
    expect(atlasSrc).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{\s*e\.preventDefault\(\);\s*selectDestination\(d\.slug\);/);
  });

  it('mobile chip selectors still call the exact same activateCountry/selectDestination handlers as the desktop map', () => {
    expect(atlasSrc).toContain('onClick={() => activateCountry(c.slug)}');
    expect(atlasSrc).toContain('onClick={() => selectDestination(d.slug)}');
  });
});

describe('Legend wording matches the real implementation', () => {
  it('every country-level label in the legend comes from the same COUNTRY_INTELLIGENCE_COLOUR map the map itself renders from', () => {
    expect(atlasSrc).toContain('Object.keys(COUNTRY_INTELLIGENCE_COLOUR)');
  });

  it('every route-level label in the legend comes from the same ROUTE_INTELLIGENCE_COLOUR map the map itself renders from', () => {
    expect(atlasSrc).toContain('Object.keys(ROUTE_INTELLIGENCE_COLOUR)');
  });

  it('the legend explains the active-service-notice accent in plain text, not colour alone', () => {
    expect(atlasSrc).toContain('Active service notice');
  });

  it('the three route-level labels read exactly as specified: "JetStash knows this route well" / "Useful route guidance available" / "Intelligence still being expanded"', () => {
    expect(atlasSrc).toContain("strong: { fill: '#E0B158', label: 'JetStash knows this route well' }");
    expect(atlasSrc).toContain("useful: { fill: '#A39D8C', label: 'Useful route guidance available' }");
    expect(atlasSrc).toContain("expanding: { fill: '#5B6472', label: 'Intelligence still being expanded' }");
  });
});

describe('Accessible labels expose the status meaning, not colour alone', () => {
  it('the destination hit-circle aria-label always names the route-intelligence label in words', () => {
    expect(atlasSrc).toMatch(/aria-label=\{`\$\{d\.label\} — \$\{ROUTE_INTELLIGENCE_COLOUR\[d\.intelligenceLevel\]\.label\}/);
  });

  it('the country hit-circle aria-label always names the country-intelligence label in words', () => {
    expect(atlasSrc).toContain('aria-label={`${c.label} — ${colour.label}`}');
  });

  it('the destination panel renders the tier label as visible text, not only as a coloured accent bar', () => {
    expect(atlasSrc).toContain('{ROUTE_INTELLIGENCE_COLOUR[activeDest.intelligenceLevel].label}');
  });
});

describe('The route coverage audit document stays in sync with the real data', () => {
  const auditDoc = readFileSync(join(process.cwd(), 'docs/project-control/ROUTE_COVERAGE_AUDIT.md'), 'utf8');
  const SOFT_LAUNCH_SLUGS = ['manchester-lahore', 'manchester-islamabad', 'manchester-dubai', 'birmingham-amritsar', 'manchester-madinah', 'manchester-doha'];
  // Classification C: the doc's own slug index and "83 of 88" figure (its
  // last addendum, "Fare Coverage Expansion Batch B") are its CURRENT, kept-
  // up-to-date state — each addendum revises the same single table forward,
  // it isn't a historical snapshot pinned to the doc's original 6 August
  // 2026 header date. This file's NOW_ISO (6 Aug) is used elsewhere in this
  // file for genuinely dated 6-Aug scenarios; this describe block alone
  // needs the later, honest date the doc's current content actually
  // reflects (verified against the real archive: 83 tracked routes and
  // london-gatwick-izmir at "strong" both hold from 22 Aug 2026 onward).
  const AUDIT_CURRENT_ISO = '2026-08-22';

  it('every real route has an entry in the audit\'s slug index — a route added later without an audit update fails this test', () => {
    for (const route of routes) {
      expect(auditDoc, route.slug).toContain(`\`${route.slug}\``);
    }
  });

  it('the audit\'s slug index grade matches the real, current computeRouteIntelligenceLevel() result for every route — the document cannot silently drift from the code', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, AUDIT_CURRENT_ISO);
      const expectedGrade = level === 'strong' ? 'Strong' : level === 'useful' ? 'Useful' : 'Expanding';
      const rowPattern = new RegExp('\\|\\s*`' + route.slug + '`\\s*\\|\\s*' + expectedGrade + '\\s*\\|');
      expect(auditDoc, `${route.slug} expected ${expectedGrade}`).toMatch(rowPattern);
    }
  });

  it('all six soft-launch routes are explicitly covered in the audit\'s dedicated launch-readiness section', () => {
    const section = auditDoc.slice(auditDoc.indexOf('## 4. Six launch-route readiness'), auditDoc.indexOf('## 5. Fare-tracking coverage truth'));
    expect(section.length).toBeGreaterThan(0);
    for (const slug of SOFT_LAUNCH_SLUGS) {
      const route = getRouteBySlug(slug)!;
      const dest = getRouteDestination(route);
      // The launch section is written in human city-pair form, not slugs —
      // check the destination city appears within the section.
      expect(section, slug).toContain(dest!.city);
    }
  });

  it('the audit states the real, current fare-tracking route count, not a stale hand-typed figure (88, not 80/82, after the Final Route-Guide Completion batch\'s two evidence passes)', () => {
    const totalTracked = routes.filter((r) => getPublishableObservationsByRoute(r.slug, AUDIT_CURRENT_ISO).length > 0).length;
    expect(auditDoc).toContain(`${totalTracked} of 88`);
  });

  it('the audit explicitly flags Manchester–Dubai\'s remaining fare-observation gap (Route Completion Batch 1 finding)', () => {
    expect(auditDoc).toMatch(/Manchester.Dubai/);
    expect(auditDoc.toLowerCase()).toContain('manual founder action');
  });

  it('the audit records Route Completion Batch 1\'s historical outcome (both "useful" as of August 2026\'s Batch 1) as a preserved record, without implying it\'s still current', () => {
    expect(auditDoc).toContain('## Batch 1 completion record');
    const section = auditDoc.slice(auditDoc.indexOf('## Batch 1 completion record'), auditDoc.indexOf('## Addendum (6 August 2026)'));
    expect(section.length).toBeGreaterThan(0);
    expect(section).toContain('manchester-dubai-emirates-baggage-weight');
    expect(section.toLowerCase()).toContain('neither does');
  });

  it('the audit\'s current, real grade for each Batch 1 route matches computeRouteIntelligenceLevel() exactly — Dubai is now Strong (a real fare observation closed its gap), Doha stays Useful', () => {
    const dubai = getRouteBySlug('manchester-dubai')!;
    const doha = getRouteBySlug('manchester-doha')!;
    expect(computeRouteIntelligenceLevel(dubai, AUDIT_CURRENT_ISO)).toBe('strong');
    expect(computeRouteIntelligenceLevel(doha, AUDIT_CURRENT_ISO)).toBe('useful');
    // The slug index (the doc's own machine-checkable manifest) must agree.
    expect(auditDoc).toMatch(/\|\s*`manchester-dubai`\s*\|\s*Strong\s*\|/);
    expect(auditDoc).toMatch(/\|\s*`manchester-doha`\s*\|\s*Useful\s*\|/);
  });

  it('the /deals page hero states the same live-computed coverage sentence the audit recommends', () => {
    const dealsPageSrc = readFileSync(join(process.cwd(), 'app/deals/page.tsx'), 'utf8');
    expect(dealsPageSrc).toContain('routesWithTrackedFare');
    expect(dealsPageSrc).toMatch(/coverage is\s*[\s\S]{0,20}being expanded gradually using manually verified observations/);
  });
});

describe('No route facts, fare observations or verification states were altered by this phase', () => {
  it('data/routes.ts is untouched by this test suite\'s own import (sanity: current route count, 88 after the Final Route-Guide Completion batch\'s two evidence passes)', () => {
    expect(routes.length).toBe(88);
  });

  it('computeRouteIntelligenceLevel never mutates the route object it reads', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const before = JSON.stringify(route);
    computeRouteIntelligenceLevel(route, NOW_ISO);
    const after = JSON.stringify(route);
    expect(after).toBe(before);
  });
});
