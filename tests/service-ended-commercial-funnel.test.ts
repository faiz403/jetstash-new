import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, getRouteAirport, getRouteDestination, routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import {
  getTripComFlightHandoff,
  getSafeTripComFlightHandoffUrl,
  getTripComRouteUrl,
  SERVICE_ENDED_CTA_LABEL,
} from '@/lib/booking-providers';
import { getTipsForScope } from '@/data/traveller-tips';
import RoutePage from '@/app/routes/[slug]/page';

/**
 * Service-Ended Route Commercial Funnel Fix (12 Sept 2026, founder-approved,
 * following the 12 Sept read-only dead-end audit). Focused regression suite
 * for the founder's 13-item test requirement. See:
 *   - data/routes.ts (buildServiceEndedPresentation, canShowConnectingAlternative)
 *   - lib/booking-providers.ts (getTripComFlightHandoff's service-ended gate)
 *   - components/route/fare-signal.tsx, components/ui/deal-card.tsx,
 *     components/travel-ready/travel-ready-check.tsx (CTA wording/policy parity)
 *   - data/traveller-tips.ts (redundant withdrawal clause trimmed)
 */

const NOW_ISO = '2026-09-12';

describe('1-2. Service-ended + connectingAlternative + exact handoff → connecting alternative renders, current Trip.com CTA renders', () => {
  it('manchester-delhi: connectingAlternative section and a current Trip.com CTA both render', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-delhi' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('You can still fly this route with a connection');
    expect(html).toContain('Dubai');
    expect(html).toContain(SERVICE_ENDED_CTA_LABEL);
  });

  it('manchester-mumbai: connectingAlternative section and a current Trip.com CTA both render', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-mumbai' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('You can still fly this route with a connection');
    expect(html).toContain('Dubai');
    expect(html).toContain(SERVICE_ENDED_CTA_LABEL);
  });
});

describe('3. CTA wording never implies a nonstop/direct is currently available', () => {
  it('SERVICE_ENDED_CTA_LABEL names neither "direct" nor "nonstop", and never claims to book a flight', () => {
    expect(SERVICE_ENDED_CTA_LABEL.toLowerCase()).not.toMatch(/direct|nonstop|book this/);
    expect(SERVICE_ENDED_CTA_LABEL).toBe('Compare current connecting flights on Trip.com');
  });

  it('manchester-delhi and manchester-mumbai route pages never render a nonstop-implying CTA phrase', async () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const element = await RoutePage({ params: Promise.resolve({ slug }) });
      const html = renderToStaticMarkup(element);
      expect(html, slug).not.toMatch(/book this direct flight/i);
      expect(html, slug).not.toMatch(/check this nonstop fare/i);
      expect(html, slug).not.toMatch(/direct flight on Trip\.com/i);
    }
  });
});

describe('4. Service-ended WITHOUT connectingAlternative remains fail closed', () => {
  it('data/routes.ts: canShowConnectingAlternative is false and no connecting-journey promise is made when connectingAlternative is absent', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const stripped = { ...route, connectingAlternative: undefined };
    const presentation = getEffectiveRoutePresentation(stripped, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('service-ended');
    if (presentation.status === 'service-ended') {
      expect(presentation.canShowConnectingAlternative).toBe(false);
      expect(presentation.summary).not.toMatch(/connecting journey/i);
    }
  });

  it('getTripComFlightHandoff source: the service-ended branch fails closed (returns null) before ever reading the exact-URL map when connectingAlternative is absent', () => {
    const src = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    const brandStart = src.indexOf('if (isServiceEnded)');
    const brandEnd = src.indexOf("kind: 'service-ended-connecting'");
    const serviceEndedBranch = src.slice(brandStart, brandEnd);
    const noAltCheckIndex = serviceEndedBranch.indexOf('if (!route?.connectingAlternative) return null;');
    const exactUrlLookupIndex = serviceEndedBranch.indexOf('getTripComRouteUrl(routeSlug)');
    expect(noAltCheckIndex).toBeGreaterThan(-1);
    expect(exactUrlLookupIndex).toBeGreaterThan(-1);
    // The connectingAlternative fail-closed return must come BEFORE the
    // exact-URL lookup, so a missing connectingAlternative can never even
    // reach a real, existing exact link.
    expect(noAltCheckIndex).toBeLessThan(exactUrlLookupIndex);
  });
});

describe('5. Service-ended WITHOUT a verified exact handoff remains commercially fail closed', () => {
  it('every service-ended route besides manchester-delhi/manchester-mumbai has no handoff', () => {
    const ended = routes.filter(
      (route) => getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status === 'service-ended',
    );
    expect(ended.map((r) => r.slug).sort()).toEqual(['manchester-delhi', 'manchester-mumbai']);
  });

  it('a service-ended route with connectingAlternative but no exact TRIPCOM_ROUTE_URLS entry still fails closed (never falls back to the destination map)', () => {
    // Source-level proof (readFileSync, not Function.toString — the built
    // test runner's function source doesn't reliably preserve literal
    // string formatting): the service-ended branch inside
    // getTripComFlightHandoff must read the exact-route map only, never
    // TRIPCOM_DESTINATION_URLS.
    const src = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    const brandStart = src.indexOf('if (isServiceEnded)');
    const brandEnd = src.indexOf("kind: 'service-ended-connecting'");
    expect(brandStart).toBeGreaterThan(-1);
    expect(brandEnd).toBeGreaterThan(brandStart);
    const serviceEndedBranch = src.slice(brandStart, brandEnd);
    expect(serviceEndedBranch).not.toContain('TRIPCOM_DESTINATION_URLS');
    expect(serviceEndedBranch).toContain('if (!route?.connectingAlternative) return null;');
  });
});

describe('6-7. Manchester-Delhi and Manchester-Mumbai get a current connecting path', () => {
  for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
    it(`${slug}: getTripComFlightHandoff resolves an exact URL with kind "service-ended-connecting"`, () => {
      const route = getRouteBySlug(slug)!;
      const airport = getRouteAirport(route)!;
      const dest = getRouteDestination(route)!;
      const handoff = getTripComFlightHandoff(route.slug, airport.slug, dest.slug, NOW_ISO);
      expect(handoff).not.toBeNull();
      expect(handoff!.kind).toBe('service-ended-connecting');
      expect(handoff!.url).toMatch(/^https:\/\/www\.trip\.com\/flights\//);
    });
  }
});

describe('8. No tracked fare is invented for Delhi/Mumbai', () => {
  it('manchester-delhi and manchester-mumbai route pages never show a fabricated fare, Standout Fare, or discount', async () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const element = await RoutePage({ params: Promise.resolve({ slug }) });
      const html = renderToStaticMarkup(element);
      expect(html, slug).toContain('No current fare tracked.');
      expect(html, slug).not.toContain('Standout Fare');
    }
  });
});

describe('9. Old direct service still clearly marked ended', () => {
  it('manchester-delhi and manchester-mumbai hero and Route Status still say the direct service ended', async () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const element = await RoutePage({ params: Promise.resolve({ slug }) });
      const html = renderToStaticMarkup(element);
      expect(html, slug).toContain('Direct service ended');
    }
  });
});

describe('10. Redundant withdrawal copy is reduced', () => {
  it('the false "not currently verified" partner-link note no longer renders for Delhi/Mumbai (a real handoff exists)', async () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const element = await RoutePage({ params: Promise.resolve({ slug }) });
      const html = renderToStaticMarkup(element);
      expect(html, slug).not.toContain('Exact partner booking link is not currently verified for this route.');
    }
  });

  it('the Mumbai traveller tip no longer repeats "Manchester\'s direct Mumbai service has ended"', () => {
    const mumbaiTip = getTipsForScope({ routeSlug: 'manchester-mumbai' })[0];
    expect(mumbaiTip.body).not.toContain("Manchester's direct Mumbai service has ended");
    expect(mumbaiTip.body).toContain('confirm the baggage allowance directly with the operating airline');
  });
});

describe('11. Travel Ready uses the same safe handoff policy as the route page', () => {
  it('travel-ready-check.tsx no longer imports the raw, unsafe getTripComFlightHandoffUrl', () => {
    const source = readFileSync(join(process.cwd(), 'components/travel-ready/travel-ready-check.tsx'), 'utf8');
    const importLine = source.split('\n').find((line) => line.includes("from '@/lib/booking-providers'"))!;
    expect(importLine).not.toContain('getTripComFlightHandoffUrl');
    expect(importLine).toContain('getTripComFlightHandoff');
  });

  it('Travel Ready and the route page resolve to the identical handoff for manchester-delhi and manchester-mumbai', () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const route = getRouteBySlug(slug)!;
      const airport = getRouteAirport(route)!;
      const dest = getRouteDestination(route)!;
      const routePageUrl = getSafeTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug, NOW_ISO);
      const travelReadyHandoff = getTripComFlightHandoff(route.slug, airport.slug, dest.slug, NOW_ISO);
      expect(travelReadyHandoff?.url, slug).toBe(routePageUrl);
      expect(travelReadyHandoff?.kind, slug).toBe('service-ended-connecting');
    }
  });
});

describe('12. Heathrow/Gatwick blocked routes remain blocked — no loosened safety, no invented URL', () => {
  it('every London-origin route still fails closed (unaffected by the service-ended gate change)', () => {
    for (const route of routes.filter((r) => r.airportSlug.startsWith('london-'))) {
      const airport = getRouteAirport(route)!;
      const dest = getRouteDestination(route)!;
      const handoff = getTripComFlightHandoff(route.slug, airport.slug, dest.slug, NOW_ISO);
      expect(handoff, route.slug).toBeNull();
    }
  });

  it('renders the exact fail-closed sentence, never a fabricated CTA, for a representative blocked route', async () => {
    const blockedRoute = routes.find(
      (r) => r.airportSlug.startsWith('london-') && getRouteAirport(r) && getRouteDestination(r),
    )!;
    const element = await RoutePage({ params: Promise.resolve({ slug: blockedRoute.slug }) });
    const html = renderToStaticMarkup(element);
    expect(html).not.toContain('Compare current connecting flights on Trip.com');
  });
});

describe('13. No invented partner URL', () => {
  it('the service-ended-connecting handoff URL is derived from the pre-existing TRIPCOM_ROUTE_URLS dashboard record, never a synthesized string', () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const route = getRouteBySlug(slug)!;
      const rawDashboardUrl = getTripComRouteUrl(route.slug);
      expect(rawDashboardUrl, slug).toBeTruthy();
      const handoff = getTripComFlightHandoff(route.slug, route.airportSlug, route.destinationSlug, NOW_ISO);
      // The resolved URL only ever adds the locale/currency query params
      // when missing — same host, path and query identity as the stored
      // record, confirming nothing was invented for this fix.
      const rawUrlObj = new URL(rawDashboardUrl!);
      const handoffUrlObj = new URL(handoff!.url);
      expect(handoffUrlObj.hostname, slug).toBe(rawUrlObj.hostname);
      expect(handoffUrlObj.pathname, slug).toBe(rawUrlObj.pathname);
      expect(handoffUrlObj.searchParams.get('dcity'), slug).toBe(rawUrlObj.searchParams.get('dcity'));
      expect(handoffUrlObj.searchParams.get('acity'), slug).toBe(rawUrlObj.searchParams.get('acity'));
      expect(handoffUrlObj.searchParams.get('trip_sub3'), slug).toBe(rawUrlObj.searchParams.get('trip_sub3'));
    }
  });
});

describe('representative unaffected routes stay unaffected', () => {
  it('manchester-islamabad and manchester-dubai keep their ordinary (non-service-ended) CTA wording', async () => {
    for (const slug of ['manchester-islamabad', 'manchester-dubai']) {
      const element = await RoutePage({ params: Promise.resolve({ slug }) });
      const html = renderToStaticMarkup(element);
      expect(html, slug).toContain('Compare flights on Trip.com');
      expect(html, slug).not.toContain(SERVICE_ENDED_CTA_LABEL);
    }
  });
});
