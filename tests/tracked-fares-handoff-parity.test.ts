import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { buildTrackedFareAirportGroups } from '@/lib/tracked-fare-groups';

/**
 * Tracked Fares handoff parity fix (PR #141, August 2026).
 *
 * Root cause: lib/tracked-fare-groups.ts called
 * getTripComFlightHandoffUrl(route.slug) — route-slug only — while the
 * route guide (app/routes/[slug]/page.tsx) has always called
 * getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug), the
 * three-argument form that also consults the exact-pair
 * TRIPCOM_DESTINATION_URLS fallback map. The two-argument omission
 * silently lost 16 already-approved, dashboard-generated Trip.com
 * handoffs that the corresponding route guide correctly showed all
 * along. No new resolver, no new fallback tier, no manually-constructed
 * URL, no LON/aggregate broadening — this proves /tracked-fares now asks
 * the exact same question the route guide already asks, and gets the
 * exact same answer.
 *
 * The durable assertion is semantic parity (below), not a hardcoded
 * route list — the 16-route reconciliation from the audit is asserted
 * separately, documented as current-dataset evidence, not encoded into
 * production logic.
 */

const routeGuideSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const groupsSrc = readFileSync(join(process.cwd(), 'lib/tracked-fare-groups.ts'), 'utf8');

const nowIso = new Date().toISOString().slice(0, 10);

/** The exact resolver call the route guide makes for a given route — the ground truth every tracked-fare entry must match. */
function routeGuideHandoffUrl(routeSlug: string): string | null {
  const route = routes.find((r) => r.slug === routeSlug)!;
  const airport = getRouteAirport(route)!;
  const dest = getRouteDestination(route)!;
  return getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
}

describe('Source-level parity: /tracked-fares calls the resolver with the same arguments the route guide does', () => {
  it('app/routes/[slug]/page.tsx passes route.slug, airport.slug and dest.slug', () => {
    expect(routeGuideSrc).toMatch(/getTripComFlightHandoffUrl\(route\.slug, airport\.slug, dest\.slug\)/);
  });

  it('lib/tracked-fare-groups.ts now passes the same three arguments, not route.slug alone', () => {
    expect(groupsSrc).toMatch(/getTripComFlightHandoffUrl\(route\.slug, airport\.slug, dest\.slug\)/);
    expect(groupsSrc).not.toMatch(/getTripComFlightHandoffUrl\(route\.slug\)/);
  });

  it('no new resolver, fallback tier or manual URL was introduced', () => {
    expect(groupsSrc).not.toMatch(/https?:\/\//);
    expect(groupsSrc).toContain("import { getTripComFlightHandoffUrl } from '@/lib/booking-providers'");
  });
});

describe('Semantic parity: every current tracked-fare entry resolves identically to its own route guide', () => {
  const nowIsoForGroups = nowIso;
  const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIsoForGroups);
  const allEntries = airportGroups.flatMap((g) => g.entries);

  it('finds real entries to test against (guards against the scanner silently matching nothing)', () => {
    expect(allEntries.length).toBeGreaterThan(0);
  });

  it('every tracked-fare entry\'s tripComUrl exactly equals the route guide\'s own resolution for that route', () => {
    const mismatches = allEntries
      .filter((e) => e.tripComUrl !== routeGuideHandoffUrl(e.routeSlug))
      .map((e) => e.routeSlug);
    expect(mismatches, `routes with a parity mismatch: ${mismatches.join(', ')}`).toEqual([]);
  });

  it('existing direct route-slug handoff still works (e.g. manchester-lahore, in TRIPCOM_ROUTE_URLS)', () => {
    const entry = allEntries.find((e) => e.routeSlug === 'manchester-lahore');
    expect(entry?.tripComUrl).not.toBeNull();
    expect(entry?.tripComUrl).toBe(routeGuideHandoffUrl('manchester-lahore'));
  });

  it('a restored exact-pair fallback handoff now works (manchester-barcelona, only in TRIPCOM_DESTINATION_URLS)', () => {
    const entry = allEntries.find((e) => e.routeSlug === 'manchester-barcelona');
    expect(entry?.tripComUrl).not.toBeNull();
    expect(entry?.tripComUrl).toContain('MAN-BCN');
    expect(entry?.tripComUrl).toBe(routeGuideHandoffUrl('manchester-barcelona'));
  });

  it('a genuine no-handoff route (London-origin, no aggregate broadening) correctly fails closed on both surfaces', () => {
    const entry = allEntries.find((e) => e.routeSlug === 'london-heathrow-delhi');
    expect(entry?.tripComUrl).toBeNull();
    expect(routeGuideHandoffUrl('london-heathrow-delhi')).toBeNull();
  });

  it('no handoff URL was broadened to a generic "LON" aggregate for any entry', () => {
    for (const e of allEntries) {
      if (e.tripComUrl) expect(e.tripComUrl).not.toMatch(/dcity=LON\b/);
    }
  });
});

describe('Current-dataset reconciliation (documented evidence, not a hardcoded production rule)', () => {
  it('83 current tracked fares: 61 with a verified handoff, 22 with the explicit unavailable state (updated 22 August 2026, Connecting Journey Structure + BHX-DEL unlock)', () => {
    // Was 78/56/22 as of 18 August 2026. Fare Coverage Batch 1 (22 August)
    // added four routes' first current Fare Signal (leeds-bradford-bodrum,
    // manchester-karachi, birmingham-lahore, birmingham-islamabad) — all
    // four already had a working Trip.com handoff before this batch, so
    // the +4 total landed entirely on the with-handoff count (82/60/22).
    // Connecting Journey Structure + BHX-DEL unlock (same day) then gave
    // birmingham-delhi its own first current Fare Signal too — it already
    // had a working Trip.com handoff, so this +1 also lands entirely on
    // the with-handoff count (83/61/22).
    const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const allEntries = airportGroups.flatMap((g) => g.entries);
    expect(allEntries).toHaveLength(83);
    expect(allEntries.filter((e) => e.tripComUrl !== null)).toHaveLength(61);
    expect(allEntries.filter((e) => e.tripComUrl === null)).toHaveLength(22);
  });

  // The exact 16 routes the audit named — asserted as regression evidence
  // for this fix, never read by production code.
  it('the 16 audit-named routes are restored', () => {
    const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const bySlug = new Map(airportGroups.flatMap((g) => g.entries).map((e) => [e.routeSlug, e.tripComUrl]));
    const restoredExpected = [
      'manchester-barcelona', 'manchester-faro', 'manchester-athens', 'manchester-rome',
      'birmingham-barcelona', 'birmingham-faro', 'birmingham-athens', 'birmingham-rome',
      'birmingham-dubai', 'birmingham-doha', 'birmingham-jeddah',
      'leeds-bradford-barcelona', 'leeds-bradford-faro',
      'bristol-barcelona', 'bristol-faro', 'bristol-rome',
    ];
    expect(restoredExpected).toHaveLength(16);
    for (const slug of restoredExpected) {
      expect(bySlug.get(slug), `${slug} should now have a handoff`).not.toBeNull();
    }
  });

  it('all 22 remaining no-handoff routes are London Heathrow/Gatwick — the documented aggregate-search limitation, not a new gap', () => {
    const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const blocked = airportGroups.flatMap((g) => g.entries).filter((e) => e.tripComUrl === null);
    expect(blocked).toHaveLength(22);
    for (const e of blocked) {
      const route = routes.find((r) => r.slug === e.routeSlug)!;
      const airport = getRouteAirport(route)!;
      expect(['london-heathrow', 'london-gatwick']).toContain(airport.slug);
    }
  });
});
