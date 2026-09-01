import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes, getRouteAirport, getRouteDestination, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';
import type { FareSignalObservation } from '@/lib/fare-signal';

/**
 * Route Page Journey Clarity System (20 Aug 2026). Real-user validation
 * (two independent first-time users) found the same P1 problem: a route's
 * own verified service (e.g. PIA direct on Manchester-Islamabad) and the
 * tracked fare shown right below it (e.g. a cheaper Etihad connecting
 * itinerary) are individually accurate, but the page didn't make the
 * relationship between them unmistakable. This was never a missing-
 * evidence problem -- a disclosure sentence already existed and fired
 * correctly for every mismatched route (git history, the old
 * itineraryDifferenceCopy function) -- it was an information-hierarchy
 * problem: the sentence was plain-weight body text after several other
 * facts, easy to skim past.
 *
 * Fix scope: components/route/fare-signal.tsx (RouteVsFareCallout) and
 * app/routes/[slug]/page.tsx (two new props threaded through, both reusing
 * values -- presentation.statusLabel, presentationAirlines -- already
 * computed and rendered in the hero above; nothing re-derived, nothing
 * newly invented). No route verification data, fare observation data,
 * Fare Watcher, Route Watch, Trip.com URLs, SEO metadata, hotel logic or
 * Travel Ready logic touched.
 */

const NOW_ISO = '2026-08-20';
const componentSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf-8');

function presentationFor(slug: string, evaluationDateIso: string = NOW_ISO) {
  const route = getRouteBySlug(slug)!;
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, evaluationDateIso);
  const airlines = getAirlinesBySlugs(presentation.airlineSlugs);
  return { route, airport, dest, presentation, airlines };
}

function renderFareSignalForRoute(slug: string, evaluationDateIso: string = NOW_ISO): string {
  const { route, presentation, airlines } = presentationFor(slug, evaluationDateIso);
  const signal = getFareSignalForRoute(route.slug, evaluationDateIso);
  const html = renderToStaticMarkup(
    FareSignal({
      signal,
      tripComUrl: getTripComRouteUrl(route.slug),
      routeSlug: route.slug,
      routeDirectness: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null,
      routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
      routeAirlineLabel: airlines.length > 0 ? airlines.map((a) => a.name).join(', ') : null,
    })
  );
  return html.replace(/\s+/g, ' ');
}

describe('direct-route + connecting-fare: the distinction is explicit (Manchester-Islamabad, the reported case)', () => {
  it('names the route\'s real airline (PIA) and directness, distinct from the tracked fare\'s own directness', () => {
    // Classification B: the Riyadh Air evidence this test names is dated
    // 25 Aug, after this file's 20 Aug NOW_ISO.
    const RIYADH_AIR_EVIDENCE_ISO = '2026-08-25';
    const { presentation, airlines } = presentationFor('manchester-islamabad', RIYADH_AIR_EVIDENCE_ISO);
    expect(presentation.status).toBe('direct');
    expect(airlines.map((a) => a.name)).toEqual(['PIA']);
    const signal = getFareSignalForRoute('manchester-islamabad', RIYADH_AIR_EVIDENCE_ISO);
    expect(signal.observation?.directness).toBe('connecting');

    const html = renderFareSignalForRoute('manchester-islamabad', RIYADH_AIR_EVIDENCE_ISO);
    expect(html).toContain('Route service');
    expect(html).toContain('PIA · Direct');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
    // The current fare's own airline is shown by the existing header row.
    expect(html).toContain('Riyadh Air');
  });
});

describe('direct-route + direct-fare: matching state renders no callout (no unnecessary density)', () => {
  it('a route where the tracked fare matches the verified direct service shows no "Route service" callout', () => {
    const { presentation } = presentationFor('glasgow-bodrum');
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('glasgow-bodrum', NOW_ISO);
    expect(signal.observation?.directness).toBe('direct');

    const html = renderFareSignalForRoute('glasgow-bodrum');
    expect(html).not.toContain('Route service');
  });
});

describe('connecting-only route: never falsely mentions a direct service', () => {
  it('a connecting route whose matching connecting fare is now suppressed (Fare Signal poor-itinerary suppression, 31 Aug 2026) shows no callout, and the word "Direct" never appears', () => {
    // Classification B: the poor-itinerary suppression evidence this test
    // names (the 25 Aug £591 self-transfer recheck) is dated after this
    // file's 20 Aug NOW_ISO.
    const SUPPRESSION_EVIDENCE_ISO = '2026-08-25';
    const { presentation } = presentationFor('birmingham-amritsar', SUPPRESSION_EVIDENCE_ISO);
    expect(presentation.status).toBe('connecting');
    // birmingham-amritsar's only current observation (£591, 3/3 stops,
    // self-transfer) is now correctly suppressed entirely — there is no
    // observation left to check directness on, and a fortiori no callout
    // or "Direct" wording, which remains this test's real point.
    const signal = getFareSignalForRoute('birmingham-amritsar', SUPPRESSION_EVIDENCE_ISO);
    expect(signal.observation).toBeNull();

    const html = renderFareSignalForRoute('birmingham-amritsar', SUPPRESSION_EVIDENCE_ISO);
    expect(html).not.toContain('Route service');
    expect(html).not.toMatch(/\bDirect\b/);
  });

  it('logic-level: a synthetic connecting-route + direct-fare mismatch (0 real routes today, but must still resolve correctly) correctly labels the route side "Connecting", never "Direct"', () => {
    const directFareFixture: FareSignalObservation = {
      id: 'fixture-direct-fare',
      cabin: 'Economy',
      airline: 'Fixture Air',
      price: 500,
      currency: 'GBP',
      observedDate: '2026-08-15',
      departureDate: '2026-10-01',
      returnDate: '2026-10-15',
      directness: 'direct',
      outboundStops: 0,
      returnStops: 0,
      connectionAirports: [],
      isSelfTransfer: false,
    };
    const html = renderToStaticMarkup(
      FareSignal({
        signal: { state: 'current', observation: directFareFixture, freshness: 'fresh', strongerSignal: null },
        tripComUrl: null,
        routeSlug: 'fixture-route',
        routeDirectness: 'connecting',
        routeStatusLabel: 'Connecting',
        routeAirlineLabel: 'Fixture Connecting Air',
      })
    ).replace(/\s+/g, ' ');
    expect(html).toContain('Route service');
    expect(html).toContain('Fixture Connecting Air · Connecting');
    expect(html).toContain('This tracked fare is a different, direct journey.');
  });
});

describe('verification-pending routes stay fail-closed', () => {
  it('an unverified route never receives a route-vs-fare callout, because it has no fare to compare and no route directness to state', () => {
    // birmingham-lahore was this fixture until COV-001 (21 August 2026)
    // reclassified it to verified-connecting — see
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md, Batch 3.
    const { presentation } = presentationFor('birmingham-ahmedabad');
    expect(presentation.status).toBe('unverified');
    const signal = getFareSignalForRoute('birmingham-ahmedabad', NOW_ISO);
    expect(signal.state).toBe('none');

    const html = renderFareSignalForRoute('birmingham-ahmedabad');
    expect(html).not.toContain('Route service');
    expect(html).toContain('No current fare tracked.');
  });

  it('every currently-unverified route resolves routeDirectness to null (the page never passes a status label for a route it cannot vouch for)', () => {
    // Function boundary deliberately resets TS's literal narrowing so this
    // exercises the exact same runtime expression the route page uses
    // (app/routes/[slug]/page.tsx), not a type-narrowed tautology.
    const toRouteDirectness = (status: string): 'direct' | 'connecting' | null =>
      status === 'direct' || status === 'connecting' ? (status as 'direct' | 'connecting') : null;

    for (const route of routes) {
      const { presentation } = presentationFor(route.slug);
      if (presentation.status !== 'unverified') continue;
      expect(toRouteDirectness(presentation.status), route.slug).toBeNull();
    }
  });
});

describe('no-fare routes remain truthful', () => {
  it('a route with no current fare shows no callout and no fabricated fare directness', () => {
    // Fare Coverage Batch 1 (22 August 2026) gave leeds-bradford-bodrum its
    // first-ever fare, and by that point every other currently-direct
    // route on the site already had one too — there is no longer a real
    // direct route with zero publishable observations to use here.
    // Swapped to birmingham-delhi (connecting, verified via COV-001): its
    // two real archived observations stayed deliberately excluded pending
    // a separate presentation decision (Fare Coverage Batch 1B) — until
    // Connecting Journey Structure + BHX-DEL unlock (22 August 2026)
    // implemented that decision and gave the route a current fare too.
    // There is now genuinely no route in the dataset with a known
    // direct/connecting status AND zero publishable observations (verified
    // by a full-dataset scan while implementing that fix). Swapped to
    // birmingham-ahmedabad, one of the five still-unverified routes — a
    // different reason for state === 'none' (route verification, not fare
    // evidence), but the exact same property under test: the 'none' branch
    // renders a completely different JSX block that never calls
    // routeVsFareMismatch() at all, so no callout can fire regardless of
    // the route's own directness.
    const { presentation } = presentationFor('birmingham-ahmedabad');
    const signal = getFareSignalForRoute('birmingham-ahmedabad', NOW_ISO);
    expect(signal.state).toBe('none');
    const html = renderFareSignalForRoute('birmingham-ahmedabad');
    expect(html).not.toContain('Route service');
    expect(html).toContain('No current fare tracked.');
    void presentation;
  });
});

describe('passenger basis only appears when supported (it currently is not, by design)', () => {
  it('the component never claims a specific passenger count -- there is no per-observation field for it (only cabin/return are structurally evidenced)', () => {
    expect(componentSrc).not.toMatch(/\d\s*adult/i);
    expect(componentSrc).not.toContain('per person');
    expect(componentSrc).not.toContain('per adult');
  });
});

describe('baggage unknown remains unknown', () => {
  // Route Page Scanability fix (21 Aug 2026): the hero's own "Check the
  // itinerary, baggage allowance and booking terms before paying." caveat
  // moved into this component's CTA caveat verbatim (see SignalCta) once
  // the hero's duplicate CTA was removed -- so the component now legitimately
  // mentions "baggage" as an instruction to check, not a stated fact. The
  // real rule this test protects -- no fabricated baggage allowance FACT
  // (a figure, an "included"/"free" claim, an airline-specific promise) --
  // still holds and is asserted directly below.
  it('mentions baggage only as an instruction to check, or as verbatim archive evidence -- never a fabricated allowance fact', () => {
    // First Standout Fare Pilot (25 Aug 2026, founder-approved): the
    // component now also renders one evidence-safe baggage line for the
    // Standout Fare state ("Baggage: <verbatim archive text>.", see
    // StandoutEvidence) -- always the observation's own recorded uncertainty
    // ("not stated; optional charges may apply" etc.), never a fabricated
    // figure or an inclusion/free claim. The narrower, still-binding rule
    // this test protects is checked directly below.
    expect(componentSrc).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
    expect(componentSrc).not.toMatch(/\d+\s*(kg|kilograms?)\b/i);
    expect(componentSrc).not.toMatch(/baggage (included|free|allowance:)/i);
    expect(componentSrc).not.toMatch(/baggage (is |are )?included/i);
  });
});

describe('airline identity cannot drift between route intelligence and the fare observation', () => {
  it('routeAirlineLabel passed to FareSignal is byte-identical to the hero\'s own presentationAirlines join, for a real mismatched route', () => {
    const { presentation, airlines } = presentationFor('manchester-islamabad');
    const heroLabel = airlines.map((a) => a.name).join(', ');
    const html = renderFareSignalForRoute('manchester-islamabad');
    expect(html).toContain(`${heroLabel} · ${presentation.statusLabel}`);
  });

  it('when the route\'s own airline and the fare\'s airline happen to share a name, the callout still correctly attributes the fare\'s directness to the fare, not the route', () => {
    const sameAirlineFixture: FareSignalObservation = {
      id: 'fixture-same-airline',
      cabin: 'Economy',
      airline: 'PIA',
      price: 550,
      currency: 'GBP',
      observedDate: '2026-08-15',
      departureDate: '2026-10-01',
      returnDate: '2026-10-15',
      directness: 'connecting',
      outboundStops: 1,
      returnStops: 1,
      connectionAirports: ['Doha'],
      isSelfTransfer: false,
    };
    const html = renderToStaticMarkup(
      FareSignal({
        signal: { state: 'current', observation: sameAirlineFixture, freshness: 'fresh', strongerSignal: null },
        tripComUrl: null,
        routeSlug: 'manchester-islamabad',
        routeDirectness: 'direct',
        routeStatusLabel: 'Direct',
        routeAirlineLabel: 'PIA',
      })
    ).replace(/\s+/g, ' ');
    expect(html).toContain('PIA · Direct');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
  });
});

describe('no banned recommendation/deal language introduced', () => {
  it('the component source never contains recommendation, urgency or superlative language', () => {
    expect(componentSrc).not.toMatch(/\bbest\b/i);
    expect(componentSrc).not.toMatch(/cheapest/i);
    expect(componentSrc).not.toMatch(/\bdeal\b/i);
    expect(componentSrc).not.toMatch(/\bsave\b/i);
    expect(componentSrc).not.toMatch(/recommend/i);
  });

  it('rendered output for every route with a mismatch callout stays free of that language too', () => {
    const banned = /\bbest\b|cheapest|\bdeal\b|\bsave\b|recommend/i;
    for (const route of routes) {
      const { presentation } = presentationFor(route.slug);
      if (presentation.status !== 'direct' && presentation.status !== 'connecting') continue;
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
      if (!signal.observation || !signal.observation.directness || signal.observation.directness === presentation.status) continue;
      const html = renderFareSignalForRoute(route.slug);
      expect(html, route.slug).toContain('Route service');
      expect(html, route.slug).not.toMatch(banned);
    }
  });
});

describe('full 88-route dataset safety check (Phase 8)', () => {
  it('cross-tabulates route directness vs. fare directness and asserts the mismatch callout fires exactly where, and only where, it should', () => {
    let total = 0;
    let mismatchExpected = 0;
    let mismatchRendered = 0;
    let matchNoCallout = 0;
    let noFareNoCallout = 0;
    let unverifiedNoCallout = 0;

    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      total += 1;

      const { presentation } = presentationFor(route.slug);
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
      const html = renderFareSignalForRoute(route.slug);

      const routeDirectness = presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null;
      const fareDirectness = signal.observation?.directness ?? null;

      if (routeDirectness === null) {
        // unverified or service-ended: no route directness to compare, so no callout, ever.
        expect(html, route.slug).not.toContain('Route service');
        unverifiedNoCallout += 1;
        continue;
      }
      if (fareDirectness === null) {
        // no current/recent fare, or fare directness not evidenced: nothing to compare, no callout.
        expect(html, route.slug).not.toContain('Route service');
        noFareNoCallout += 1;
        continue;
      }
      if (routeDirectness === fareDirectness) {
        expect(html, route.slug).not.toContain('Route service');
        matchNoCallout += 1;
        continue;
      }
      // Genuine mismatch: callout must render, and must state the route's real status label.
      mismatchExpected += 1;
      expect(html, route.slug).toContain('Route service');
      expect(html, route.slug).toContain(presentation.statusLabel);
      mismatchRendered += 1;
    }

    // eslint-disable-next-line no-console
    console.log('JOURNEY CLARITY DATASET SAFETY CHECK', {
      totalRoutes: total,
      mismatchCalloutRendered: mismatchRendered,
      matchingNoCallout: matchNoCallout,
      noFareNoCallout,
      unverifiedOrServiceEndedNoCallout: unverifiedNoCallout,
    });

    expect(total).toBe(88);
    expect(mismatchRendered).toBe(mismatchExpected);
    // Every route accounted for in exactly one bucket.
    expect(mismatchRendered + matchNoCallout + noFareNoCallout + unverifiedNoCallout).toBe(total);
  });

  it('records the exact current counts so any future data change that shifts them is a visible, reviewed diff, not a silent drift', () => {
    // Classification B: this test's own comment trail narrates the counts
    // through 31 August 2026 (Fare Signal poor-itinerary suppression) —
    // fixed at that date, after this file's 20 Aug NOW_ISO.
    const SUPPRESSION_ISO = '2026-08-31';
    let directConnectingFare = 0;
    let directDirectFare = 0;
    let connectingConnectingFare = 0;
    let connectingDirectFare = 0;
    let noFare = 0;
    let unverified = 0;

    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      const { presentation } = presentationFor(route.slug, SUPPRESSION_ISO);
      const signal = getFareSignalForRoute(route.slug, SUPPRESSION_ISO);
      const fareDirectness = signal.observation?.directness ?? null;

      if (presentation.status === 'unverified') { unverified += 1; continue; }
      if (fareDirectness === null) { noFare += 1; continue; }
      if (presentation.status === 'direct' && fareDirectness === 'connecting') directConnectingFare += 1;
      else if (presentation.status === 'direct' && fareDirectness === 'direct') directDirectFare += 1;
      else if (presentation.status === 'connecting' && fareDirectness === 'connecting') connectingConnectingFare += 1;
      else if (presentation.status === 'connecting' && fareDirectness === 'direct') connectingDirectFare += 1;
    }

    // noFare 1 -> 5 -> 1 -> 0 (COV-001, 21 August 2026, then Fare Coverage
    // Batch 1 and Connecting Journey Structure + BHX-DEL unlock, both 22
    // August 2026): COV-001 moved four routes from unverified to verified-
    // connecting with their pre-existing fares still suppressed, pushing
    // noFare 1->5. Batch 1 then gave leeds-bradford-bodrum (the original 1)
    // plus three of those four COV-001 routes (manchester-karachi,
    // birmingham-lahore, birmingham-islamabad) a fresh, publishable
    // observation each, dropping noFare back to 1 — only birmingham-delhi
    // remained, its two real observations deliberately held pending a
    // separate connecting-vs-connecting journey presentation decision.
    // Connecting Journey Structure + BHX-DEL unlock then implemented that
    // decision (routeServiceFareMismatch()), unsuppressing birmingham-
    // delhi's 13 August observation and adding a fresh 22 August one,
    // dropping noFare to 0 and moving connectingConnectingFare 13->14.
    // unverified stays 5, untouched by either 22 August change.
    //
    // noFare 0 -> 7 (Fare Signal poor-itinerary suppression, 31 Aug 2026):
    // 7 routes' only current observations are confirmed self-transfer,
    // 2+-stop-per-leg itineraries and are now correctly suppressed
    // entirely, so signal.observation (and therefore fareDirectness) is
    // null for each. 5 of the 7 were direct routes with a connecting fare
    // (manchester-lahore, manchester-dubai, london-heathrow-doha,
    // london-heathrow-jeddah, london-gatwick-amritsar), moving out of
    // directConnectingFare: 56 -> 51. The other 2 were connecting routes
    // with a connecting fare (birmingham-amritsar, birmingham-delhi),
    // moving out of connectingConnectingFare: 14 -> 12.
    //
    // directConnectingFare 51 -> 49, unverified 5 -> 7 (temporal-causality
    // fix, 1 Sep 2026 -- this test's own SUPPRESSION_ISO=31 Aug is now
    // honestly reachable): manchester-delhi and manchester-mumbai's
    // IndiGo direct services both have an announced withdrawal effective
    // 31 August 2026 (data/route-status-events.ts) -- a real, unrelated
    // route-truth event, not a data or fix defect. Both routes were
    // direct+connecting-fare (in directConnectingFare) up to 30 Aug, and
    // become unverified/service-ended from 31 Aug, exactly the boundary
    // this test now evaluates at.
    expect(directConnectingFare).toBe(49);
    expect(directDirectFare).toBe(13);
    expect(connectingConnectingFare).toBe(12);
    expect(connectingDirectFare).toBe(0);
    expect(noFare).toBe(7);
    expect(unverified).toBe(7);
    expect(directConnectingFare + directDirectFare + connectingConnectingFare + connectingDirectFare + noFare + unverified).toBe(88);
  });
});
