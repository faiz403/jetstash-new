import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, getRouteAirport, getRouteDestination, routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import {
  getSafeTripComFlightHandoffUrl,
  SERVICE_ENDED_CTA_LABEL,
  GENERIC_FLIGHT_SEARCH_URL,
  GENERIC_FLIGHT_SEARCH_CTA_LABEL,
  GENERIC_FLIGHT_SEARCH_REL,
} from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';
import RoutePage from '@/app/routes/[slug]/page';

/**
 * LHR/LGW temporary current-flight fallback (12 Sept 2026, founder-approved).
 * Skyscanner was the founder's initial direction, but was superseded within
 * the same session once JetStash's own record (docs/project-control/
 * LAUNCH_READINESS_AUDIT_2026-07-29.md, lib/booking-providers.ts) showed the
 * Skyscanner affiliate application is on file as declined and no
 * verified widget embed code could be sourced — the founder then confirmed
 * no Skyscanner/Impact account exists and redirected to the Google Flights
 * design. See GENERIC_FLIGHT_SEARCH_URL's doc comment in
 * lib/booking-providers.ts for the full gating rule.
 */

const NOW_ISO = '2026-09-12';

function renderRouteFareSignal(slug: string) {
  const route = getRouteBySlug(slug)!;
  const airport = getRouteAirport(route)!;
  const dest = getRouteDestination(route)!;
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
  const tripComUrl = getSafeTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug, NOW_ISO);
  const signal = getFareSignalForRoute(route.slug, NOW_ISO);
  const html = renderToStaticMarkup(
    FareSignal({
      signal,
      tripComUrl,
      routeSlug: route.slug,
      isServiceEnded: presentation.status === 'service-ended',
    })
  );
  return { html, tripComUrl, presentation };
}

describe('1-2. LHR->JED and LGW->DXB get the temporary current-flight-search fallback', () => {
  for (const slug of ['london-heathrow-jeddah', 'london-gatwick-dubai']) {
    it(`${slug}: renders "Search current flights" linking to Google Flights, no Trip.com CTA`, () => {
      const { html, tripComUrl } = renderRouteFareSignal(slug);
      expect(tripComUrl).toBeNull();
      expect(html).toContain(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
      expect(html).toContain(GENERIC_FLIGHT_SEARCH_URL);
      expect(html).not.toContain('Compare flights on Trip.com');
      expect(html).not.toContain(SERVICE_ENDED_CTA_LABEL);
    });
  }
});

describe('3-4. LHR->Dhaka and LHR->Sylhet get the fallback despite unverified route status', () => {
  for (const slug of ['london-heathrow-dhaka', 'london-heathrow-sylhet']) {
    it(`${slug}: unverified status still gets "Search current flights" (fallback makes no verification claim)`, () => {
      const { html, tripComUrl, presentation } = renderRouteFareSignal(slug);
      expect(presentation.status).toBe('unverified');
      expect(tripComUrl).toBeNull();
      expect(html).toContain(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
    });
  }
});

describe('5-8. no generic-London substitution — exact airport specificity is a Google Flights property, not JetStash-constructed', () => {
  it('the fallback URL has no query string at all — no origin, no destination, no LON/LHR/LGW substitution invented', () => {
    // Deliberate design: Google Flights' deep-link query format isn't
    // public/stable, so JetStash never constructs one. The traveller lands
    // on a blank generic search and enters their own airports — this is
    // the honest alternative to guessing an unverified deep-link format,
    // not a defect. See GENERIC_FLIGHT_SEARCH_URL's doc comment.
    expect(GENERIC_FLIGHT_SEARCH_URL).toBe('https://www.google.com/travel/flights');
    expect(GENERIC_FLIGHT_SEARCH_URL).not.toMatch(/[?&]/);
  });

  it('the same fallback URL is used for every affected route — no per-route URL is constructed anywhere in the component', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    // GenericFlightSearchFallback takes no routeSlug/airport prop and
    // renders the imported constant directly -- proves no interpolation.
    const fnStart = src.indexOf('function GenericFlightSearchFallback()');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain('href={GENERIC_FLIGHT_SEARCH_URL}');
    expect(fnBody).not.toMatch(/\$\{/); // no template-string interpolation of a route/airport into the href
  });
});

describe('9. no undocumented/deep-link query construction', () => {
  it('GENERIC_FLIGHT_SEARCH_URL carries no query parameters', () => {
    const url = new URL(GENERIC_FLIGHT_SEARCH_URL);
    expect(url.search).toBe('');
  });
});

describe('10-11. MAN->ISB and MAN->DXB retain Trip.com only', () => {
  for (const slug of ['manchester-islamabad', 'manchester-dubai']) {
    it(`${slug}: ordinary Trip.com CTA renders, never the generic fallback`, () => {
      const { html, tripComUrl } = renderRouteFareSignal(slug);
      expect(tripComUrl).not.toBeNull();
      expect(html).not.toContain(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
    });
  }
});

describe('12-13. MAN->Delhi and MAN->Mumbai retain the restored service-ended Trip.com CTA only', () => {
  for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
    it(`${slug}: SERVICE_ENDED_CTA_LABEL renders, never the generic fallback`, () => {
      const { html, tripComUrl, presentation } = renderRouteFareSignal(slug);
      expect(presentation.status).toBe('service-ended');
      expect(tripComUrl).not.toBeNull();
      expect(html).toContain(SERVICE_ENDED_CTA_LABEL);
      expect(html).not.toContain(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
    });
  }
});

describe('14. generic fallback never renders when a monetised handoff exists', () => {
  it('every route with a resolved tripComUrl never renders "Search current flights"', () => {
    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      const tripComUrl = getSafeTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug, NOW_ISO);
      if (!tripComUrl) continue;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
      const html = renderToStaticMarkup(
        FareSignal({ signal, tripComUrl, routeSlug: route.slug, isServiceEnded: presentation.status === 'service-ended' })
      );
      expect(html, route.slug).not.toContain(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
    }
  });
});

describe('15. no tripcom_click event is fired for the generic fallback', () => {
  it('GenericFlightSearchFallback is a plain <a>, never TrackedOutboundLink — no analytics event attached', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    const fnStart = src.indexOf('function GenericFlightSearchFallback()');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).not.toContain('TrackedOutboundLink');
    expect(fnBody).not.toContain('tripcom_click');
    expect(fnBody).not.toContain('track(');
  });
});

describe('16-17. no sponsored/affiliate disclosure falsely applied; correct non-commission disclosure renders', () => {
  it('the fallback link rel excludes "sponsored"', () => {
    expect(GENERIC_FLIGHT_SEARCH_REL).toBe('nofollow noopener noreferrer');
    expect(GENERIC_FLIGHT_SEARCH_REL).not.toContain('sponsored');
  });

  it('the fallback never renders inside AffiliateLinkDisclosure and states no commission is earned', () => {
    const { html } = renderRouteFareSignal('london-heathrow-jeddah');
    expect(html).not.toContain('Ad · Affiliate link.');
    expect(html).toContain('does not currently earn commission');
    expect(html).not.toContain('partner fare');
    expect(html).not.toContain('JetStash deal');
    expect(html).not.toContain('tracked fare');
    expect(html).not.toContain('verified price');
    expect(html).not.toMatch(/affiliate link/i);
  });
});

describe('18. existing Heathrow/Gatwick informational truth remains unchanged', () => {
  it('none of the 26 routes have their route-status/verification facts altered — only the commercial action changes', () => {
    const londonRoutes = routes.filter((r) => r.airportSlug.startsWith('london-'));
    expect(londonRoutes).toHaveLength(26);
    for (const route of londonRoutes) {
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      expect(presentation.status, route.slug).not.toBe('service-ended');
    }
  });
});

describe('19-20. widget/CTA remains usable at 390px, no horizontal overflow (structural check)', () => {
  it('the fallback link and disclosure use responsive, wrapping classes (no fixed pixel width, no nowrap)', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    const fnStart = src.indexOf('function GenericFlightSearchFallback()');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).not.toMatch(/w-\[\d+px\]/);
    expect(fnBody).not.toContain('whitespace-nowrap');
  });
});

describe('shared condition renders correctly on the full route page (not just the FareSignal unit)', () => {
  it('london-heathrow-jeddah route page renders the fallback in the Fare Check section, once only', () => {
    const element = RoutePage({ params: Promise.resolve({ slug: 'london-heathrow-jeddah' }) });
    return element.then((el) => {
      const html = renderToStaticMarkup(el);
      const occurrences = html.split('Search current flights').length - 1;
      expect(occurrences).toBe(1);
    });
  });

  it('a normal monetised route (manchester-dubai) never renders the generic fallback anywhere on the page', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-dubai' }) });
    const html = renderToStaticMarkup(element);
    expect(html).not.toContain('Search current flights');
  });
});
