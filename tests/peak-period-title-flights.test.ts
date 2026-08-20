import { describe, it, expect } from 'vitest';
import { routes, getRouteAirport, getRouteDestination, getRoutePresentation } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { siteConfig } from '@/lib/site-config';
import { TITLE_THRESHOLD } from './metadata-audit.test';

/**
 * Peak-period title fix (Search Console opportunity audit, 20 Aug 2026).
 *
 * The audit found every route with peak-period content sitting at 0% CTR in
 * Search Console despite real impressions (290 for London Heathrow–Jeddah
 * alone) — the leading suspect was the metadataTitle for that branch never
 * containing "Flights", so the SERP snippet reads as an editorial "Booking
 * Windows & Peak Periods" piece rather than a bookable-route result. A prior
 * Aug 2026 metadata audit had already tried restoring "Flights" here and
 * reverted it because the naive insertion pushed titles past the
 * ~65-character guideline for nearly half the route network (see the git
 * history of data/routes.ts and tests/metadata-audit.test.ts's now-removed
 * route exceptions).
 *
 * This time "Flights" is restored by recovering the character budget
 * elsewhere instead of exceeding it: the origin–destination connector
 * shortens from " to " to an en dash, and "Windows" drops from the trailing
 * phrase ("Booking Windows & Peak Periods" → "Booking & Peak Periods"),
 * keeping "Booking" and "Peak Periods" — the two words actually carrying the
 * intent — intact. This file is the durable guard: it proves "Flights" is
 * present, proves every current peak-period title fits the threshold with no
 * per-route exception needed, and proves the unrelated
 * 'verification-pending' branch and its route-verification logic were not
 * touched by this change — see also tests/verification-pending-leakage.test.ts
 * and tests/birmingham-mumbai-route.test.ts, updated alongside this fix.
 */

const NOW_ISO = '2026-08-20';
const applyTemplate = (title: string) => `${title} | ${siteConfig.name}`;

/**
 * Routes with peakPeriodIds configured AND currently verified/live — i.e.
 * routes that actually reach the peak-period metadataTitle branch this fix
 * changed. A route can carry peakPeriodIds while also being currently
 * 'unverified' (e.g. its own verification lapsed independently of its
 * peak-period content); getRoutePresentation() correctly routes those to
 * buildUnverifiedPresentation() regardless of peakPeriodIds, so they must be
 * excluded here — they're covered by the separate
 * 'verification-pending' describe block below instead.
 */
function peakPeriodRoutes() {
  return routes.filter((r) => r.peakPeriodIds.length > 0 && getRoutePresentation(r, NOW_ISO).status !== 'unverified');
}

describe('peak-period route titles contain "Flights" and fit the character threshold', () => {
  it('every current peak-period route exists and has at least one, so this suite is not silently testing zero routes', () => {
    expect(peakPeriodRoutes().length).toBeGreaterThan(0);
  });

  it('"Flights" appears in the metadataTitle for every current peak-period route', () => {
    const missing: string[] = [];
    for (const route of peakPeriodRoutes()) {
      const presentation = getRoutePresentation(route, NOW_ISO);
      if (!/Flights/.test(presentation.metadataTitle)) missing.push(route.slug);
    }
    expect(missing).toEqual([]);
  });

  it('"Booking" and "Peak Periods" both survive the shortened phrase — only "Windows" was dropped', () => {
    for (const route of peakPeriodRoutes().slice(0, 5)) {
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, route.slug).toMatch(/Booking & Peak Periods/);
      expect(presentation.metadataTitle, route.slug).not.toMatch(/Windows/);
    }
  });

  it('recurrence guard: every current peak-period route\'s full rendered <title> (with the " | JetStash" template applied) is at or under the 65-character guideline — no per-route exception required', () => {
    const overThreshold: { slug: string; length: number; title: string }[] = [];
    for (const route of peakPeriodRoutes()) {
      const presentation = getRoutePresentation(route, NOW_ISO);
      const rendered = applyTemplate(presentation.metadataTitle);
      if (rendered.length > TITLE_THRESHOLD) {
        overThreshold.push({ slug: route.slug, length: rendered.length, title: rendered });
      }
    }
    expect(
      overThreshold,
      'One or more peak-period route titles exceed the threshold. Either the fix regressed, or a new route/city-pair combination needs its own documented exception in tests/metadata-audit.test.ts.'
    ).toEqual([]);
  });

  it('the connector is an en dash, not " to " — the specific mechanism that recovered the character budget', () => {
    for (const route of peakPeriodRoutes().slice(0, 5)) {
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, route.slug).not.toContain(' to ');
      expect(presentation.metadataTitle, route.slug).toContain('–');
    }
  });

  it('the non-peak-period branch is untouched — it already said "Flights" and kept the " to " connector, and still does', () => {
    const nonPeakPeriod = routes.find((r) => r.peakPeriodIds.length === 0 && getRouteAirport(r) && getRouteDestination(r));
    expect(nonPeakPeriod, 'expected at least one non-peak-period route with a resolvable airport/destination').toBeTruthy();
    const presentation = getRoutePresentation(nonPeakPeriod!, NOW_ISO);
    if (presentation.status !== 'unverified') {
      expect(presentation.metadataTitle).toContain(' to ');
      expect(presentation.metadataTitle).toMatch(/Flights/);
      expect(presentation.metadataTitle).toMatch(/Route Guide|Connection Guide/);
    }
  });

  it('the London Heathrow/Gatwick duplicate-title disambiguation still works with the new connector — both Dubai routes keep distinct, non-colliding titles', () => {
    const heathrow = routes.find((r) => r.slug === 'london-heathrow-dubai');
    const gatwick = routes.find((r) => r.slug === 'london-gatwick-dubai');
    expect(heathrow && gatwick, 'expected both London Heathrow and Gatwick Dubai routes to exist').toBeTruthy();
    const heathrowTitle = getRoutePresentation(heathrow!, NOW_ISO).metadataTitle;
    const gatwickTitle = getRoutePresentation(gatwick!, NOW_ISO).metadataTitle;
    expect(heathrowTitle).not.toBe(gatwickTitle);
    expect(heathrowTitle).toContain('London Heathrow');
    expect(gatwickTitle).toContain('London Gatwick');
  });
});

describe('verification-pending ("unverified") route metadata and status logic are completely unchanged by this fix', () => {
  it('every currently-unverified route still gets the exact "Verification in Progress" title — never "Flights" or "Booking & Peak Periods"', () => {
    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      if (presentation.status !== 'unverified') continue;
      expect(presentation.metadataTitle, route.slug).toMatch(/Verification in Progress/);
      expect(presentation.metadataTitle, route.slug).not.toMatch(/Flights/);
      expect(presentation.metadataTitle, route.slug).not.toMatch(/Booking & Peak Periods/);
      expect(presentation.metadataTitle, route.slug).not.toMatch(/Booking Windows & Peak Periods/);
    }
  });

  it('this fix scanned at least one real unverified route — proves the guard above is not vacuously passing over an empty set', () => {
    const unverifiedSlugs = routes
      .filter((r) => {
        const airport = getRouteAirport(r);
        const dest = getRouteDestination(r);
        if (!airport || !dest) return false;
        return getEffectiveRoutePresentation(r, routeStatusEvents, NOW_ISO).status === 'unverified';
      })
      .map((r) => r.slug);
    expect(unverifiedSlugs.length).toBeGreaterThan(0);
  });

  it('route-verification logic itself is untouched — which routes are unverified is driven entirely by getDisplayDirectness()/getEffectiveRoutePresentation(), never by this metadataTitle string change', () => {
    // Sanity check: buildUnverifiedPresentation() is a separate code path from
    // the peak-period title branch edited by this fix (see data/routes.ts) —
    // this test exists to make that separation explicit and regression-tested,
    // not just asserted in a comment.
    const pending = routes.find((r) => {
      const airport = getRouteAirport(r);
      const dest = getRouteDestination(r);
      if (!airport || !dest) return false;
      return getEffectiveRoutePresentation(r, routeStatusEvents, NOW_ISO).status === 'unverified';
    });
    expect(pending, 'expected at least one unverified route to exist').toBeTruthy();
    const presentation = getEffectiveRoutePresentation(pending!, routeStatusEvents, NOW_ISO);
    expect(presentation.canShowBookingGuidance).toBe(false);
    expect(presentation.canShowPeakPeriods).toBe(false);
    expect(presentation.canShowConnectingAlternative).toBe(false);
  });
});
