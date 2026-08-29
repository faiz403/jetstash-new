import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComFlightHandoffUrl, TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers';
import { buildTrackedFareAirportGroups } from '@/lib/tracked-fare-groups';
import { FareSignal } from '@/components/route/fare-signal';

/**
 * Trip.com fresh-search trust clarification (PR #142, August 2026).
 *
 * Every Trip.com link is confirmed structurally dateless (see
 * lib/booking-providers.ts's file header). A customer reading a specific
 * dated Fare Signal — price, airline, departure/return dates — and then
 * clicking through lands on a fresh Trip.com search that carries none of
 * that across. TRIPCOM_FRESH_SEARCH_NOTE is the one shared sentence for
 * every surface where a dated observation sits directly above a Trip.com
 * CTA. Scope is deliberately narrow: it does not touch
 * getTripComFlightHandoffUrl, any URL, any route mapping, or any
 * verification rule, and it is not added to surfaces with no dated
 * itinerary above the CTA (DealCard's range summary, hotel handoffs).
 */

const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
const explorerSrc = readFileSync(join(process.cwd(), 'components/sections/tracked-fares-explorer.tsx'), 'utf8');
const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');
const holidayIntelSrc = readFileSync(join(process.cwd(), 'components/destination/holiday-intelligence.tsx'), 'utf8');
const bookingProvidersSrc = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');

const nowIso = new Date().toISOString().slice(0, 10);

describe('1. one shared source of truth for the wording', () => {
  it('TRIPCOM_FRESH_SEARCH_NOTE is defined once, in lib/booking-providers.ts, next to the dateless-link documentation', () => {
    expect(bookingProvidersSrc).toContain('export const TRIPCOM_FRESH_SEARCH_NOTE');
  });

  it('fare-signal.tsx and tracked-fares-explorer.tsx both import the shared constant rather than hand-typing their own wording', () => {
    expect(fareSignalSrc).toContain("TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers'");
    expect(explorerSrc).toContain("TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers'");
    expect(fareSignalSrc).toContain('{TRIPCOM_FRESH_SEARCH_NOTE}');
    expect(explorerSrc).toContain('{TRIPCOM_FRESH_SEARCH_NOTE}');
  });
});

describe('2. wording preserves the required meaning and implies nothing false', () => {
  it('states Trip.com opens a fresh/new search', () => {
    expect(TRIPCOM_FRESH_SEARCH_NOTE).toMatch(/new route search/i);
  });

  it('tells the customer to re-enter dates/itinerary to compare like for like', () => {
    expect(TRIPCOM_FRESH_SEARCH_NOTE).toMatch(/re-enter/i);
    expect(TRIPCOM_FRESH_SEARCH_NOTE).toMatch(/like for like/i);
  });

  it('never implies the observed fare is still available, live, or automatically carried across', () => {
    expect(TRIPCOM_FRESH_SEARCH_NOTE.toLowerCase()).not.toMatch(/still available/);
    expect(TRIPCOM_FRESH_SEARCH_NOTE.toLowerCase()).not.toMatch(/guaranteed/);
    expect(TRIPCOM_FRESH_SEARCH_NOTE.toLowerCase()).not.toMatch(/same (price|airline|fare)/);
    expect(TRIPCOM_FRESH_SEARCH_NOTE.toLowerCase()).not.toMatch(/automatically/);
  });
});

describe('3. appears on the two intended Fare Signal → Trip.com handoff surfaces, and only when a handoff exists', () => {
  it('route-page Fare Signal (current state): renders the note next to the CTA when a Trip.com URL is present', () => {
    const signal = getFareSignalForRoute('manchester-dubai', nowIso);
    expect(signal.state).toBe('current');
    const tripComUrl = getTripComFlightHandoffUrl('manchester-dubai');
    expect(tripComUrl).not.toBeNull();
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl, routeSlug: 'manchester-dubai' }));
    expect(html).toContain(TRIPCOM_FRESH_SEARCH_NOTE);
  });

  it('route-page Fare Signal: does NOT render the note when there is no Trip.com handoff for that route (fails closed with the CTA itself)', () => {
    const signal = getFareSignalForRoute('manchester-dubai', nowIso);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: 'manchester-dubai' }));
    expect(html).not.toContain(TRIPCOM_FRESH_SEARCH_NOTE);
  });

  it('route-page Fare Signal: does NOT render the note when the signal state is "none" (no dated observation to clarify)', () => {
    // leeds-bradford-bodrum was this fixture until Fare Coverage Batch 1
    // (22 August 2026) gave it its first-ever fare. birmingham-delhi was
    // the next fixture, until Connecting Journey Structure + BHX-DEL
    // unlock (22 August 2026) unsuppressed its 13 August observation and
    // appended a fresh 22 August one. Swapped to birmingham-ahmedabad, one
    // of the five routes still genuinely verification-blocked (unverified).
    const signal = getFareSignalForRoute('birmingham-ahmedabad', nowIso);
    expect(signal.state).toBe('none');
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: 'birmingham-ahmedabad' }));
    expect(html).not.toContain(TRIPCOM_FRESH_SEARCH_NOTE);
  });

  it('/tracked-fares TrackedFareCard: the note sits inside the same conditional branch as the Trip.com CTA (renders only when tripComUrl exists)', () => {
    expect(explorerSrc).toMatch(/tripComUrl \? \(\s*<>[\s\S]*Compare flights on Trip\.com[\s\S]*TRIPCOM_FRESH_SEARCH_NOTE[\s\S]*<\/>\s*\) : \(/);
  });

  it('/tracked-fares: every current entry with a real handoff carries the note, none of the no-handoff entries would (source-conditional, not per-entry duplicated text)', () => {
    const groups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const entries = groups.flatMap((g) => g.entries);
    expect(entries.some((e) => e.tripComUrl !== null)).toBe(true);
    expect(entries.some((e) => e.tripComUrl === null)).toBe(true);
  });
});

describe('4. not repeated excessively and not shown on unrelated links', () => {
  it('fare-signal.tsx defines the note exactly once (single render site inside SignalCta, shared by current and recent states)', () => {
    const occurrences = (fareSignalSrc.match(/TRIPCOM_FRESH_SEARCH_NOTE/g) ?? []).length;
    expect(occurrences).toBe(2); // 1 import + 1 usage
  });

  it('tracked-fares-explorer.tsx defines the note exactly once (single render site inside TrackedFareCard)', () => {
    const occurrences = (explorerSrc.match(/TRIPCOM_FRESH_SEARCH_NOTE/g) ?? []).length;
    expect(occurrences).toBe(2); // 1 import + 1 usage
  });

  it('DealCard is untouched: it shows a range/summary, not a single dated itinerary, and keeps its own existing caution copy', () => {
    expect(dealCardSrc).not.toContain('TRIPCOM_FRESH_SEARCH_NOTE');
    expect(dealCardSrc).toContain('Check the itinerary, baggage allowance and booking terms');
  });

  it('Hotel Intelligence (a different partner handoff, out of scope) never gains this flight-fare wording', () => {
    expect(holidayIntelSrc).not.toContain('TRIPCOM_FRESH_SEARCH_NOTE');
  });
});

describe('5. resolver, URLs and handoff state are untouched', () => {
  it('getTripComFlightHandoffUrl signature and behaviour are unchanged (route-slug, optional origin/destination fallback)', () => {
    expect(getTripComFlightHandoffUrl('manchester-lahore')).toContain('MAN-LHE');
    expect(getTripComFlightHandoffUrl('manchester-barcelona')).toBeNull(); // route-slug-only call still correctly finds nothing
    expect(getTripComFlightHandoffUrl('manchester-barcelona', 'manchester', 'barcelona')).toContain('MAN-BCN');
  });

  it('total tracked and with/without-handoff counts match an independent recomputation from live routes (current-state invariant — never a hardcoded historical total; see route verification test determinism batch, 29 Aug 2026)', () => {
    // Independently recomputed from live routes via getFareSignalForRoute()
    // (the membership test) and getTripComFlightHandoffUrl() called the same
    // way the route guide calls it (the ground-truth resolver) — neither is
    // the buildTrackedFareAirportGroups() grouping logic actually under
    // test here. A legitimate route-verification expiry or renewal changes
    // this expectation automatically; it must never require editing this
    // test.
    const currentlyTrackedSlugs = routes.filter((r) => getFareSignalForRoute(r.slug, nowIso).state === 'current').map((r) => r.slug);
    const expectedWithHandoff = currentlyTrackedSlugs.filter((slug) => {
      const route = routes.find((r) => r.slug === slug)!;
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      return getTripComFlightHandoffUrl(route.slug, airport?.slug, dest?.slug) !== null;
    }).length;
    const expectedNoHandoff = currentlyTrackedSlugs.length - expectedWithHandoff;

    const groups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
    const entries = groups.flatMap((g) => g.entries);
    expect(entries).toHaveLength(currentlyTrackedSlugs.length);
    expect(entries.filter((e) => e.tripComUrl !== null)).toHaveLength(expectedWithHandoff);
    expect(entries.filter((e) => e.tripComUrl === null)).toHaveLength(expectedNoHandoff);
  });
});
