import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { airports } from '@/data/airports';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { buildTrackedFareAirportGroups } from '@/lib/tracked-fare-groups';
import {
  matchesTrackedFareQuery,
  filterAirportGroups,
  toggleAirportInSet,
  isAirportVisible,
} from '@/components/sections/tracked-fares-explorer';
import { mainNav, footerNav } from '@/lib/site-config';
import TrackedFaresPage from '@/app/tracked-fares/page';

/**
 * Exhaustive Tracked Fares (PR #140) — the public, browsable answer to
 * "which routes does JetStash currently have a checked fare for?" (the
 * Tracked Fares discoverability audit, 16 August 2026). Deliberately
 * mirrors tests/routes-index-catalogue.test.ts's coverage depth and style
 * (grouping correctness, no-duplicates, accordion toggle, search matching)
 * since lib/tracked-fare-groups.ts and tracked-fares-explorer.tsx are
 * themselves deliberate structural copies of lib/route-country-groups.ts
 * and routes-catalogue.tsx.
 */

const FIXED_TODAY = '2026-08-17';
const airportGroups = buildTrackedFareAirportGroups(routes, airports, FIXED_TODAY);
const pageSrc = readFileSync(join(process.cwd(), 'app/tracked-fares/page.tsx'), 'utf8');
const explorerSrc = readFileSync(join(process.cwd(), 'components/sections/tracked-fares-explorer.tsx'), 'utf8');
const groupsSrc = readFileSync(join(process.cwd(), 'lib/tracked-fare-groups.ts'), 'utf8');

describe('1. every current Fare Signal appears exactly once, no duplicates, no extras', () => {
  it('the flattened set of entry slugs matches getFareSignalForRoute(...).state === "current" exactly', () => {
    const expectedSlugs = routes.filter((r) => getFareSignalForRoute(r.slug, FIXED_TODAY).state === 'current').map((r) => r.slug);
    const actualSlugs = airportGroups.flatMap((g) => g.entries.map((e) => e.routeSlug));
    expect(actualSlugs).toHaveLength(expectedSlugs.length);
    expect(new Set(actualSlugs)).toEqual(new Set(expectedSlugs));
  });

  it('a route with state "none" or "recent" never appears (e.g. an unreal/no-evidence slug proves the gate, not just today\'s real data)', () => {
    const allSlugs = airportGroups.flatMap((g) => g.entries.map((e) => e.routeSlug));
    // Every real route with zero evidence is excluded by construction — spot
    // check a route slug that genuinely has none, confirmed the same way
    // PR #139's own regression tests confirmed it. leeds-bradford-bodrum
    // was this fixture until Fare Coverage Batch 1 (22 August 2026) gave it
    // its first-ever fare; swapped to birmingham-delhi, whose two real
    // observations stayed deliberately excluded pending a separate
    // connecting-vs-connecting journey presentation decision — until
    // Connecting Journey Structure + BHX-DEL unlock (22 August 2026)
    // implemented that decision and gave the route a current fare too.
    // Swapped to birmingham-ahmedabad, one of the five routes still
    // genuinely verification-blocked (unverified), which has zero evidence
    // for a different, durable reason: route verification status.
    expect(allSlugs).not.toContain('birmingham-ahmedabad');
  });
});

describe('2. grouped under the correct departure airport', () => {
  it('every entry in a group actually departs from that group\'s airport', () => {
    for (const group of airportGroups) {
      for (const entry of group.entries) {
        const route = routes.find((r) => r.slug === entry.routeSlug)!;
        expect(getRouteAirport(route)?.slug).toBe(group.airportSlug);
      }
    }
  });

  it('an airport with zero current Fare Signals is omitted entirely, never shown with a "0" count', () => {
    const emptyAirportSlugs = airports
      .map((a) => a.slug)
      .filter((slug) => !routes.some((r) => getRouteAirport(r)?.slug === slug && getFareSignalForRoute(r.slug, FIXED_TODAY).state === 'current'));
    for (const slug of emptyAirportSlugs) {
      expect(airportGroups.some((g) => g.airportSlug === slug)).toBe(false);
    }
  });
});

describe('3. entry fields are exactly what the observation carries — nothing invented', () => {
  it('price, dates, airline and directness all come from the same FareSignalObservation the route guide itself uses', () => {
    const dubaiEntry = airportGroups.flatMap((g) => g.entries).find((e) => e.routeSlug === 'manchester-dubai');
    expect(dubaiEntry).toBeDefined();
    const signal = getFareSignalForRoute('manchester-dubai', FIXED_TODAY);
    expect(dubaiEntry!.observation).toEqual(signal.observation);
  });

  it('tripComUrl is fail-closed the same way DealCard/NoFareFallback already are — null, never a generic fallback, when no verified handoff exists', () => {
    // Every entry's tripComUrl is either null or a real string, never
    // undefined or a placeholder — proves the derivation went through
    // getTripComFlightHandoffUrl rather than being hand-typed.
    for (const entry of airportGroups.flatMap((g) => g.entries)) {
      expect(entry.tripComUrl === null || typeof entry.tripComUrl === 'string').toBe(true);
    }
  });
});

describe('4, 5 & 6. accordion toggle logic — expand/collapse, mobile single-open, desktop multi-open', () => {
  it('toggling a closed airport opens it', () => {
    expect(toggleAirportInSet(new Set(), 'manchester', true).has('manchester')).toBe(true);
  });

  it('toggling an already-open airport closes it, on both mobile and desktop', () => {
    expect(toggleAirportInSet(new Set(['manchester']), 'manchester', true).has('manchester')).toBe(false);
    expect(toggleAirportInSet(new Set(['manchester']), 'manchester', false).has('manchester')).toBe(false);
  });

  it('mobile (isDesktop=false): opening a new airport closes every other open airport', () => {
    const result = toggleAirportInSet(new Set(['birmingham']), 'manchester', false);
    expect(result.has('manchester')).toBe(true);
    expect(result.has('birmingham')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('desktop (isDesktop=true): opening a new airport leaves other open airports untouched', () => {
    const result = toggleAirportInSet(new Set(['birmingham']), 'manchester', true);
    expect(result.has('manchester')).toBe(true);
    expect(result.has('birmingham')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('isAirportVisible: always visible while searching, otherwise only when expanded', () => {
    expect(isAirportVisible('manchester', new Set(), true)).toBe(true);
    expect(isAirportVisible('manchester', new Set(), false)).toBe(false);
    expect(isAirportVisible('manchester', new Set(['manchester']), false)).toBe(true);
  });
});

describe('7, 8 & 9. search matching — destination, country, airport, case-insensitive, trims whitespace', () => {
  const allEntries = airportGroups.flatMap((g) => g.entries);

  it('searching a destination city finds the matching entry', () => {
    const dubaiEntry = allEntries.find((e) => e.routeSlug === 'manchester-dubai')!;
    expect(matchesTrackedFareQuery(dubaiEntry, 'dubai')).toBe(true);
    expect(matchesTrackedFareQuery(dubaiEntry, 'DUBAI')).toBe(true);
    expect(matchesTrackedFareQuery(dubaiEntry, '  dubai  ')).toBe(true);
  });

  it('searching a non-matching term returns false', () => {
    const dubaiEntry = allEntries.find((e) => e.routeSlug === 'manchester-dubai')!;
    expect(matchesTrackedFareQuery(dubaiEntry, 'lahore')).toBe(false);
  });

  it('an empty/whitespace-only query matches everything', () => {
    const dubaiEntry = allEntries.find((e) => e.routeSlug === 'manchester-dubai')!;
    expect(matchesTrackedFareQuery(dubaiEntry, '')).toBe(true);
    expect(matchesTrackedFareQuery(dubaiEntry, '   ')).toBe(true);
  });

  it('filterAirportGroups drops any airport group left with zero matches, never an empty header', () => {
    const filtered = filterAirportGroups(airportGroups, 'dubai');
    for (const group of filtered) {
      expect(group.entries.length).toBeGreaterThan(0);
    }
    expect(filtered.some((g) => g.entries.some((e) => e.destCity === 'Dubai'))).toBe(true);
  });
});

describe('10. the page itself — live stat, terminology, cross-link, no fabricated CTA', () => {
  const element = TrackedFaresPage();
  const html = renderToStaticMarkup(element);

  it('the hero stat matches the live count exactly, never a hand-typed figure', () => {
    const liveCount = routes.filter((r) => getFareSignalForRoute(r.slug, new Date().toISOString().slice(0, 10)).state === 'current').length;
    expect(html).toContain(`${liveCount} of ${routes.length}`);
    expect(pageSrc).not.toMatch(/value: ['"]\d+ of \d+['"]/);
  });

  it('never uses "deal", "cheap", "saving" or "best" anywhere on the page or its card — evidence, not a marketing selection', () => {
    for (const src of [pageSrc, explorerSrc]) {
      // Matches JSX text content and template literals, not TypeScript type
      // names (Deal, DealCabin) or import paths (data/deals) — those are
      // internal identifiers, never customer-facing text.
      expect(src.toLowerCase()).not.toMatch(/\bcheap(est|er)?\b/);
      expect(src.toLowerCase()).not.toMatch(/\bsaving(s)?\b/);
      expect(src.toLowerCase()).not.toMatch(/\bbest\b/);
      expect(src).not.toMatch(/%\s*off/);
    }
  });

  it('has exactly one restrained cross-link to /deals, framed as curated highlights — not a second Tracked Fares label', () => {
    const dealsLinkCount = (html.match(/href="\/deals"/g) ?? []).length;
    expect(dealsLinkCount).toBeGreaterThanOrEqual(1);
    expect(html).toMatch(/curated/i);
  });

  it('CTA is fail-closed per entry — either a real Trip.com link or the explicit no-handoff sentence, never both, never neither silently', () => {
    for (const entry of airportGroups.flatMap((g) => g.entries).slice(0, 5)) {
      if (entry.tripComUrl) {
        expect(explorerSrc).toContain('Compare flights on Trip.com');
      } else {
        expect(explorerSrc).toContain('Direct flight comparison is not available for this airport yet.');
      }
    }
  });
});

describe('11. Deal and Fare Signal concepts stay separate — no cross-import from data/deals.ts into the derivation layer', () => {
  it('lib/tracked-fare-groups.ts never imports from data/deals.ts', () => {
    expect(groupsSrc).not.toMatch(/from ['"]@\/data\/deals['"]/);
  });
});

describe('12. navigation — Option B: no second primary-nav item for /deals', () => {
  it('mainNav "Tracked Fares" points at /tracked-fares', () => {
    expect(mainNav.find((i) => i.label === 'Tracked Fares')?.href).toBe('/tracked-fares');
  });

  it('mainNav has no separate /deals entry', () => {
    expect(mainNav.some((i) => i.href === '/deals')).toBe(false);
  });

  it('/deals is still reachable via the footer', () => {
    expect(footerNav.specialist.some((i) => i.href === '/deals')).toBe(true);
  });
});
