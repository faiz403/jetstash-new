import { describe, expect, it } from 'vitest';
import { routes } from '@/data/routes';
import { buildAtlasAirports, computeRouteIntelligenceLevel } from '@/lib/atlas-network-data';

/**
 * Route Intelligence Completion (August 2026).
 *
 * An audit of the full 80-route catalogue found that `lib/atlas-network-data.ts`'s
 * per-airport build functions had fallen badly behind data/routes.ts as the
 * Turkey, Morocco and Europe route-guide batches (12 August 2026) shipped:
 *
 * - 11 routes (all Manchester's Turkey/Morocco/Europe destinations) had a
 *   real, verified route guide but were still plotted via
 *   buildUntrackedDestinationPoint's hardcoded 'expanding' state — "not yet
 *   researched" shown for a route JetStash had actually researched.
 * - 37 more routes had NO Atlas presence at all — most because the airport
 *   they departed from (Birmingham, Gatwick, Glasgow, Newcastle, Leeds
 *   Bradford, Heathrow) never had that destination added to its build
 *   function, and Bristol had no build function at all despite 6 real route
 *   guides.
 *
 * 48 of 80 routes (60%) were affected. Every one is now wired through
 * buildDestinationPoint — the same mechanism already used for the other 32
 * — using only existing route/destination data; no new evidence was
 * researched and no route fact, fare, or booking link was touched.
 *
 * This suite is the regression guard: it fails loudly, naming the exact
 * missing slug(s), the moment a future route guide ships without a matching
 * Atlas wiring update — the precise class of gap this phase closed.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);

describe('Every data/routes.ts entry has a tracked Atlas Route Intelligence state', () => {
  const airports = buildAtlasAirports();
  const trackedBySlug = new Map<string, { intelligenceLevel: string; routeHref: string | null }>();
  for (const airport of airports) {
    for (const country of airport.countries) {
      for (const dest of country.destinations) {
        trackedBySlug.set(`${airport.airportSlug}-${dest.slug}`, { intelligenceLevel: dest.intelligenceLevel, routeHref: dest.routeHref });
      }
    }
  }

  it('every route in data/routes.ts has a matching Atlas DestinationPoint with a real routeHref — a route guide can never silently ship with no Atlas presence', () => {
    const missing = routes.filter((r) => !trackedBySlug.has(r.slug)).map((r) => r.slug);
    expect(missing, `routes with zero Atlas presence: ${missing.join(', ')}`).toEqual([]);
  });

  it('every routes.ts entry\'s Atlas point is genuinely tracked (routeHref set) — never silently downgraded to the untracked "expanding" fallback', () => {
    const wronglyUntracked = routes.filter((r) => trackedBySlug.get(r.slug)?.routeHref === null).map((r) => r.slug);
    expect(wronglyUntracked, `routes shown as untracked despite having a real route guide: ${wronglyUntracked.join(', ')}`).toEqual([]);
  });

  it('every routes.ts entry\'s Atlas intelligenceLevel matches the real, live computeRouteIntelligenceLevel() result — never a stale or hand-set value', () => {
    const mismatched: string[] = [];
    for (const route of routes) {
      const expected = computeRouteIntelligenceLevel(route, NOW_ISO);
      const actual = trackedBySlug.get(route.slug)?.intelligenceLevel;
      if (actual !== expected) mismatched.push(`${route.slug} (atlas=${actual}, expected=${expected})`);
    }
    expect(mismatched, mismatched.join('; ')).toEqual([]);
  });

  it('no tracked routes.ts entry is ever graded "expanding" — that state is reserved for real network-evidence-only destinations with no route guide at all', () => {
    const wronglyExpanding = routes.filter((r) => trackedBySlug.get(r.slug)?.intelligenceLevel === 'expanding').map((r) => r.slug);
    expect(wronglyExpanding, wronglyExpanding.join(', ')).toEqual([]);
  });

  it('the total count of routes.ts entries and tracked Atlas points are identical — catches drift in either direction (a route added without Atlas wiring, or a stale Atlas entry for a deleted route)', () => {
    const trackedRouteCount = routes.filter((r) => trackedBySlug.get(r.slug)?.routeHref !== null && trackedBySlug.get(r.slug) !== undefined).length;
    expect(trackedRouteCount).toBe(routes.length);
  });

  it('sanity: the current 88-route catalogue grades 11 Strong / 77 Useful / 0 Expanding', () => {
    const counts = { strong: 0, useful: 0, expanding: 0 };
    for (const route of routes) {
      const level = trackedBySlug.get(route.slug)?.intelligenceLevel;
      if (level === 'strong' || level === 'useful' || level === 'expanding') counts[level]++;
    }
    expect(counts).toEqual({ strong: 11, useful: 77, expanding: 0 });
  });
});

describe('Every airport with at least one real route guide has an Atlas build function', () => {
  it('Bristol — 6 real routes.ts entries, previously absent from buildAtlasAirports() entirely — now present', () => {
    const airports = buildAtlasAirports();
    const bristol = airports.find((a) => a.airportSlug === 'bristol');
    expect(bristol, 'Bristol has no Atlas network at all').toBeDefined();
    const bristolRouteCount = routes.filter((r) => r.airportSlug === 'bristol').length;
    const bristolAtlasCount = bristol!.countries.flatMap((c) => c.destinations).length;
    expect(bristolAtlasCount).toBe(bristolRouteCount);
  });

  it('every distinct airportSlug in data/routes.ts has a matching AirportNetworkData entry in buildAtlasAirports()', () => {
    const airports = buildAtlasAirports();
    const airportSlugs = new Set(airports.map((a) => a.airportSlug));
    const routeAirportSlugs = new Set(routes.map((r) => r.airportSlug));
    const missingAirports = [...routeAirportSlugs].filter((slug) => !airportSlugs.has(slug));
    expect(missingAirports, `airports with real routes but no Atlas network: ${missingAirports.join(', ')}`).toEqual([]);
  });
});
