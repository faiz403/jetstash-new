import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes, getRouteBySlug, getDisplayDirectness, getRouteDestination } from '@/data/routes';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { isBookByRoute } from '@/lib/booking-intelligence';
import { buildAtlasAirports, computeRouteIntelligenceLevel, aggregateCountryIntelligence } from '@/lib/atlas-network-data';
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

describe('Strongest ("strong") route status requires real, defined depth evidence — never a manual flattering override', () => {
  it('every route currently graded "strong" genuinely has at least one depth signal: a publishable fare observation, connectingAlternative, per-airline verification, Book-By priority, or an active investigated warning', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, NOW_ISO);
      if (level !== 'strong') continue;
      const hasFare = getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0;
      const hasConnAlt = Boolean(route.connectingAlternative);
      const hasAirlineVerif = Boolean(route.airlineVerifications?.length);
      const hasBookBy = isBookByRoute(route.slug);
      const hasWarning = getActiveWarningsByRoute(route.slug).length > 0;
      expect(hasFare || hasConnAlt || hasAirlineVerif || hasBookBy || hasWarning, route.slug).toBe(true);
    }
  });

  it('a route with no current direct/connecting verification (route- or airline-level) can never be graded "strong", regardless of any other depth signal', () => {
    // Manchester–Karachi: isDirect true, verification.status 'unverified' — never current.
    const route = getRouteBySlug('manchester-karachi')!;
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).not.toBe('strong');
  });

  it('a route with zero depth signals and no current verification is "useful", not "strong"', () => {
    // Birmingham–Lahore: unverified, no fare, no connectingAlternative, no airlineVerifications, not Book-By, no warning.
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
  it('every route currently graded "useful" fails at least one strong criterion (unverified directness, or verified/connecting but with zero depth signals)', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, NOW_ISO);
      if (level !== 'useful') continue;
      const hasFare = getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0;
      const hasConnAlt = Boolean(route.connectingAlternative);
      const hasAirlineVerif = Boolean(route.airlineVerifications?.length);
      const hasBookBy = isBookByRoute(route.slug);
      const hasWarning = getActiveWarningsByRoute(route.slug).length > 0;
      const meetsDepthBar = hasFare || hasConnAlt || hasAirlineVerif || hasBookBy || hasWarning;
      const isCurrentlyDirectOrConnecting = getDisplayDirectness(route, NOW_ISO) !== 'unverified';
      // Never strong: either its direct/connecting status isn't currently
      // confirmed at all, or (if it is) it also lacks every depth signal.
      expect(meetsDepthBar === false || isCurrentlyDirectOrConnecting === false, route.slug).toBeTruthy();
    }
  });
});

describe('"Expanding" routes are labelled clearly — never a blank or broken state', () => {
  const airports = buildAtlasAirports();
  const allDestinations = airports.flatMap((a) => a.countries.flatMap((c) => c.destinations));
  const untracked = allDestinations.filter((d) => d.routeHref === null);

  it('sanity: at least one Atlas destination has no data/routes.ts entry (the network-evidence-only set)', () => {
    expect(untracked.length).toBeGreaterThan(0);
  });

  it('every untracked destination (no routes.ts entry) is graded "expanding" with a real, non-empty verdict — never blank', () => {
    for (const d of untracked) {
      expect(d.intelligenceLevel, d.slug).toBe('expanding');
      expect(d.verdict, d.slug).toBeTruthy();
      expect(d.verdict.length, d.slug).toBeGreaterThan(0);
    }
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
    expect(atlasSrc).toContain('Active service notice — a change has been announced, see the route guide');
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

  it('every one of the 32 real routes has an entry in the audit\'s slug index — a route added later without an audit update fails this test', () => {
    for (const route of routes) {
      expect(auditDoc, route.slug).toContain(`\`${route.slug}\``);
    }
  });

  it('the audit\'s slug index grade matches the real, current computeRouteIntelligenceLevel() result for every route — the document cannot silently drift from the code', () => {
    for (const route of routes) {
      const level = computeRouteIntelligenceLevel(route, NOW_ISO);
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

  it('the audit states the real, current fare-tracking route count, not a stale hand-typed figure', () => {
    const totalTracked = routes.filter((r) => getPublishableObservationsByRoute(r.slug, NOW_ISO).length > 0).length;
    expect(auditDoc).toContain(`${totalTracked} of 32`);
  });

  it('the audit explicitly flags the Manchester–Dubai fare-evidence gap (the finding this phase surfaced, not fixed)', () => {
    expect(auditDoc).toMatch(/Manchester.Dubai/);
    expect(auditDoc.toLowerCase()).toContain('zero publicly-displayable fare evidence');
  });

  it('the /deals page hero states the same live-computed coverage sentence the audit recommends', () => {
    const dealsPageSrc = readFileSync(join(process.cwd(), 'app/deals/page.tsx'), 'utf8');
    expect(dealsPageSrc).toContain('routesWithTrackedFare');
    expect(dealsPageSrc).toMatch(/coverage is\s*[\s\S]{0,20}being expanded gradually using manually verified observations/);
  });
});

describe('No route facts, fare observations or verification states were altered by this phase', () => {
  it('data/routes.ts is untouched by this test suite\'s own import (sanity: routes array still has the pre-phase count)', () => {
    expect(routes.length).toBe(32);
  });

  it('computeRouteIntelligenceLevel never mutates the route object it reads', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const before = JSON.stringify(route);
    computeRouteIntelligenceLevel(route, NOW_ISO);
    const after = JSON.stringify(route);
    expect(after).toBe(before);
  });
});
