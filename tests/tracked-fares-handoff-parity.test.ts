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

  it('existing direct route-slug handoff still works (e.g. manchester-islamabad, in TRIPCOM_ROUTE_URLS)', () => {
    // Not manchester-lahore: since Fare Signal poor-itinerary suppression
    // (31 Aug 2026), it has no current Fare Signal at all and so no longer
    // appears on the tracked-fares listing — see tests/fare-signal.test.ts
    // for the full account. manchester-islamabad is unaffected and still
    // has a direct route-slug handoff entry.
    const entry = allEntries.find((e) => e.routeSlug === 'manchester-islamabad');
    expect(entry?.tripComUrl).not.toBeNull();
    expect(entry?.tripComUrl).toBe(routeGuideHandoffUrl('manchester-islamabad'));
  });

  it('a restored exact-pair fallback handoff now works (manchester-barcelona, only in TRIPCOM_DESTINATION_URLS)', () => {
    const entry = allEntries.find((e) => e.routeSlug === 'manchester-barcelona');
    expect(entry?.tripComUrl).not.toBeNull();
    expect(entry?.tripComUrl).toContain('MAN-BCN');
    expect(entry?.tripComUrl).toBe(routeGuideHandoffUrl('manchester-barcelona'));
  });

  it('a genuine no-handoff route (London-origin, no aggregate broadening) correctly fails closed on both surfaces', () => {
    // Current-state invariant: find a live example rather than hardcoding
    // one route slug — a route that was a no-handoff example when this test
    // was written (london-heathrow-delhi) can legitimately drop out of
    // tracked-fares entirely once its own independent verification expires
    // (see london-heathrow-delhi's British Airways verification, due
    // 2026-08-28) and fails closed even harder than "tracked with no
    // handoff". The property this test protects — a tracked London-origin
    // entry with no aggregate-broadened handoff fails closed identically on
    // both surfaces — still needs at least one live example to be
    // meaningful. See the route verification test determinism batch, 29 Aug
    // 2026.
    const noHandoffEntry = allEntries.find(
      (e) => e.tripComUrl === null && ['london-heathrow', 'london-gatwick'].includes(getRouteAirport(routes.find((r) => r.slug === e.routeSlug)!)!.slug)
    );
    expect(noHandoffEntry, 'expected at least one currently-tracked London-origin no-handoff entry to exist').toBeDefined();
    expect(noHandoffEntry!.tripComUrl).toBeNull();
    expect(routeGuideHandoffUrl(noHandoffEntry!.routeSlug)).toBeNull();
  });

  it('no handoff URL was broadened to a generic "LON" aggregate for any entry', () => {
    for (const e of allEntries) {
      if (e.tripComUrl) expect(e.tripComUrl).not.toMatch(/dcity=LON\b/);
    }
  });
});

describe('Current-dataset reconciliation (current-state invariant: recomputed independently from live routes on every run, never a hardcoded historical total — see route verification test determinism batch, 29 Aug 2026)', () => {
  it('every currently-tracked route (a real, current Fare Signal) appears exactly once, with the handoff/no-handoff split matching an independent recomputation', () => {
    // Independently recomputed from live routes via getFareSignalForRoute()
    // (the membership test) and routeGuideHandoffUrl() (the route guide's
    // own ground-truth resolver, already defined above) — neither is the
    // buildTrackedFareAirportGroups()/grouping logic actually under test
    // here. A legitimate route-verification expiry or renewal changes this
    // expectation automatically; it must never require editing this test.
    const currentlyTrackedSlugs = routes.filter((r) => getFareSignalForRoute(r.slug, nowIso).state === 'current').map((r) => r.slug);
    const expectedWithHandoff = currentlyTrackedSlugs.filter((slug) => routeGuideHandoffUrl(slug) !== null).length;
    const expectedNoHandoff = currentlyTrackedSlugs.length - expectedWithHandoff;

    const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const allEntries = airportGroups.flatMap((g) => g.entries);
    expect(allEntries).toHaveLength(currentlyTrackedSlugs.length);
    expect(allEntries.filter((e) => e.tripComUrl !== null)).toHaveLength(expectedWithHandoff);
    expect(allEntries.filter((e) => e.tripComUrl === null)).toHaveLength(expectedNoHandoff);
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

  it('every remaining no-handoff route is London Heathrow/Gatwick — the documented aggregate-search limitation, not a new gap', () => {
    // Structural invariant: the durable property is "no-handoff routes are
    // always London-origin", not a specific count of them — that count
    // moves as routes enter/leave current tracking, which is expected.
    const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const blocked = airportGroups.flatMap((g) => g.entries).filter((e) => e.tripComUrl === null);
    expect(blocked.length).toBeGreaterThan(0);
    for (const e of blocked) {
      const route = routes.find((r) => r.slug === e.routeSlug)!;
      const airport = getRouteAirport(route)!;
      expect(['london-heathrow', 'london-gatwick']).toContain(airport.slug);
    }
  });
});
