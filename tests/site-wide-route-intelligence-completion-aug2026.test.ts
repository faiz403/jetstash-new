import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes, getRouteByAirportAndDestination } from '@/data/routes';
import { destinations } from '@/data/destinations';
import { routeStatusEvents } from '@/data/route-status-events';
import { computeRouteIntelligenceLevel } from '@/lib/atlas-network-data';
import { buildRouteCountryGroups } from '@/lib/route-country-groups';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getRouteIntelligenceDisplay, getRouteIntelligenceDisplayForRoute } from '@/lib/route-intelligence-display';

/**
 * Site-wide Route Intelligence Completion (August 2026, phase 2).
 *
 * Phase 1 (same month) fixed the Atlas so every one of the (then) 80 real routes
 * gets a genuine computeRouteIntelligenceLevel() grade — but that grade was
 * only ever visible on the homepage Atlas. An audit of the three other
 * public journeys a visitor actually follows to reach a route
 * (`/routes`'s card catalogue, a destination page's flight-guide cards, and
 * a route's own `/routes/[slug]` detail page) found none of them showed it
 * at all.
 *
 * Fixed by wiring the SAME computeRouteIntelligenceLevel() result — via one
 * shared adapter, lib/route-intelligence-display.ts, never a second scoring
 * system or a manually-set value — into all three surfaces, reusing the
 * Atlas's own exact label wording so a visitor sees identical words
 * wherever they encounter a route.
 *
 * This suite is the regression guard: it fails loudly if a future route
 * guide, or a future edit to any of these three surfaces, silently drops
 * Route Intelligence from public view again.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);

describe('Shared display adapter (lib/route-intelligence-display.ts) reuses the Atlas\'s own canonical wording', () => {
  const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

  it('every label matches ROUTE_INTELLIGENCE_COLOUR\'s destination-dot wording in atlas-feel-test.tsx exactly — never reworded independently', () => {
    for (const level of ['strong', 'useful', 'expanding'] as const) {
      const { label } = getRouteIntelligenceDisplay(level);
      expect(atlasSrc, level).toContain(`label: '${label}'`);
    }
  });

  it('never calls a second scoring function — only computeRouteIntelligenceLevel(), imported directly from lib/atlas-network-data.ts', () => {
    const src = readFileSync(join(process.cwd(), 'lib/route-intelligence-display.ts'), 'utf8');
    expect(src).toContain("import { computeRouteIntelligenceLevel } from '@/lib/atlas-network-data'");
    expect(src).not.toMatch(/function\s+compute\w*Score/i);
  });
});

describe('Surface 1 — /routes card catalogue shows Route Intelligence for every one of the 88 routes', () => {
  const countryGroups = buildRouteCountryGroups(routes, NOW_ISO, routeStatusEvents);
  const allCards = countryGroups.flatMap((g) => g.routes);
  const catalogueSrc = readFileSync(join(process.cwd(), 'components/routes/routes-catalogue.tsx'), 'utf8');

  it('every route appears exactly once across all country groups, each carrying a real intelligence value', () => {
    expect(allCards.length).toBe(routes.length);
    for (const card of allCards) {
      const route = routes.find((r) => r.slug === card.slug)!;
      expect(card.intelligence.level, card.slug).toBe(computeRouteIntelligenceLevel(route, NOW_ISO));
    }
  });

  it('the RouteCard component actually renders route.intelligence — a source-level check that the wiring is not dead data', () => {
    expect(catalogueSrc).toContain('route.intelligence.label');
    expect(catalogueSrc).toContain('route.intelligence.dotClassName');
  });

  it('never renders a second full Badge-style pill for intelligence — stays a quiet dot, not visual clutter next to the existing direct/connecting pill', () => {
    // The existing direct/connecting pill uses `rounded-full ... px-2.5 py-0.5` with the
    // route.statusLabel text; the intelligence line must be visibly smaller/quieter
    // (no px-2.5/py-0.5 pill styling) so it never reads as a second competing badge.
    const intelligenceLineMatch = catalogueSrc.match(/<span className="mt-1\.5 flex items-center gap-1\.5 text-xs text-ink-400">[\s\S]{0,200}?route\.intelligence\.label/);
    expect(intelligenceLineMatch).not.toBeNull();
    expect(intelligenceLineMatch![0]).not.toContain('rounded-full bg-');
  });
});

describe('Surface 2 — destination page flight-guide cards show Route Intelligence for every real route', () => {
  const guideSrc = readFileSync(join(process.cwd(), 'components/destination/destination-flight-guides.tsx'), 'utf8');

  it('every destination\'s flight-guide entry with a real route carries the matching intelligence value; every entry with no route carries null', () => {
    for (const destination of destinations) {
      const entries = getDestinationFlightGuideEntries(destination, NOW_ISO);
      for (const entry of entries) {
        if (entry.routeSlug === null) {
          expect(entry.intelligence, `${destination.slug}/${entry.airport.slug}`).toBeNull();
        } else {
          const route = getRouteByAirportAndDestination(entry.airport.slug, destination.slug)!;
          expect(entry.intelligence?.level, entry.routeSlug).toBe(computeRouteIntelligenceLevel(route, NOW_ISO));
        }
      }
    }
  });

  it('every one of the 88 real routes is reachable through its own destination\'s flight-guide entries with a non-null intelligence value', () => {
    const missing: string[] = [];
    for (const route of routes) {
      const destination = destinations.find((d) => d.slug === route.destinationSlug);
      if (!destination) {
        missing.push(`${route.slug} (no matching destination record)`);
        continue;
      }
      const entries = getDestinationFlightGuideEntries(destination, NOW_ISO);
      const entry = entries.find((e) => e.routeSlug === route.slug);
      if (!entry || !entry.intelligence) missing.push(route.slug);
    }
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('the component actually renders entry.intelligence inside the guides list — a source-level check that the wiring is not dead data', () => {
    expect(guideSrc).toContain('entry.intelligence &&');
    expect(guideSrc).toContain('entry.intelligence.label');
    expect(guideSrc).toContain('entry.intelligence.dotClassName');
  });
});

describe('Surface 3 — every individual route page shows its own Route Intelligence', () => {
  const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');

  it('every route\'s computed display matches computeRouteIntelligenceLevel() exactly, via the shared adapter the page itself calls', () => {
    for (const route of routes) {
      const display = getRouteIntelligenceDisplayForRoute(route, NOW_ISO);
      expect(display.level).toBe(computeRouteIntelligenceLevel(route, NOW_ISO));
    }
  });

  it('the route page renders routeIntelligence next to the existing Route Status badge, not as a duplicate Badge component', () => {
    expect(routePageSrc).toContain('getRouteIntelligenceDisplayForRoute(route, nowIso)');
    expect(routePageSrc).toContain('routeIntelligence.label');
    expect(routePageSrc).toContain('routeIntelligence.dotClassName');
    // The existing Route Status badge is the one and only <Badge> in this
    // block — Route Intelligence must render as the quiet dot+span pattern,
    // never a second <Badge variant=...> in the same hero block.
    const heroBlock = routePageSrc.slice(routePageSrc.indexOf('stagger-in stagger-1'), routePageSrc.indexOf('</h1>'));
    const badgeCount = (heroBlock.match(/<Badge/g) ?? []).length;
    expect(badgeCount).toBe(1);
  });
});

describe('Sanity — the real, complete distribution is identical across all three surfaces and the Atlas (11 Strong / 77 Useful / 0 Expanding, updated 22 August 2026 when Business Fare Evidence Batch 1 promoted london-heathrow-lahore Useful→Strong — see tests/atlas-route-intelligence-completion-aug2026.test.ts for the full reasoning; previously 10 Strong / 78 Useful, 18 August 2026, when Route Verification Refresh Batch 1\'s correction reverted london-gatwick-ahmedabad from Strong to Useful)', () => {
  it('matches on /routes', () => {
    const countryGroups = buildRouteCountryGroups(routes, NOW_ISO, routeStatusEvents);
    const counts = { strong: 0, useful: 0, expanding: 0 };
    for (const group of countryGroups) {
      for (const card of group.routes) counts[card.intelligence.level]++;
    }
    expect(counts).toEqual({ strong: 11, useful: 77, expanding: 0 });
  });

  it('matches via computeRouteIntelligenceLevel() directly (the shared source of truth every surface calls)', () => {
    const counts = { strong: 0, useful: 0, expanding: 0 };
    for (const route of routes) counts[computeRouteIntelligenceLevel(route, NOW_ISO)]++;
    expect(counts).toEqual({ strong: 11, useful: 77, expanding: 0 });
  });
});
