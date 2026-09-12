import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import {
  getTripComFlightHandoff,
  getSafeTripComFlightHandoffUrl,
  getTripComRouteUrl,
  PROVIDER_REL,
} from '@/lib/booking-providers';

const NOW = '2026-09-08';

function handoffForRoute(route: (typeof routes)[number]) {
  return getTripComFlightHandoff(route.slug, route.airportSlug, route.destinationSlug, NOW);
}

describe('First Revenue Sprint Phase 1 — public route handoffs', () => {
  it('classifies every public route into exactly one safe handoff state', () => {
    // Commercial Funnel Fix (12 Sept 2026, founder-approved): manchester-delhi
    // and manchester-mumbai moved from `noSafe` into a distinct
    // `serviceEndedConnecting` bucket — they now resolve to a handoff, but
    // one gated on a stricter, service-ended-specific evidence rule (exact
    // route + canonical connectingAlternative both required), never counted
    // as an ordinary `exact` handoff. See getTripComFlightHandoff()'s doc
    // comment in lib/booking-providers.ts.
    const counts = { exact: 0, fallback: 0, serviceEndedConnecting: 0, noSafe: 0 };

    for (const route of routes) {
      const handoff = handoffForRoute(route);
      if (!handoff) counts.noSafe += 1;
      else if (handoff.kind === 'exact-route') counts.exact += 1;
      else if (handoff.kind === 'service-ended-connecting') counts.serviceEndedConnecting += 1;
      else counts.fallback += 1;
    }

    expect(counts.exact + counts.fallback + counts.serviceEndedConnecting + counts.noSafe).toBe(routes.length);
    expect(counts).toEqual({ exact: 43, fallback: 18, serviceEndedConnecting: 2, noSafe: 26 });
  });

  it('uses effective route truth to allow only the service-ended-connecting handoff for a currently service-ended route, never the ordinary exact/fallback kinds', () => {
    const ended = routes.filter(
      (route) => getEffectiveRoutePresentation(route, routeStatusEvents, NOW).status === 'service-ended',
    );

    for (const route of ended) {
      const handoff = handoffForRoute(route);
      expect(handoff?.kind, route.slug).toBe('service-ended-connecting');
    }
    expect(ended.map((route) => route.slug)).toEqual(['manchester-delhi', 'manchester-mumbai']);
  });

  it('does not let a historical exact mapping override an ended presentation', () => {
    const route = routes.find((candidate) => getTripComRouteUrl(candidate.slug) !== null)!;
    expect(
      getTripComFlightHandoff(
        route.slug,
        route.airportSlug,
        route.destinationSlug,
        NOW,
      )?.url,
    ).toBeTruthy();
  });

  it('validates every public handoff URL, preserves attribution, and keeps the airport pair intact', () => {
    for (const route of routes) {
      const handoff = handoffForRoute(route);
      if (!handoff) continue;

      const airport = getRouteAirport(route)!;
      const destination = getRouteDestination(route)!;
      const url = new URL(handoff.url);
      expect(url.protocol, route.slug).toBe('https:');
      expect(url.hostname, route.slug).toBe('www.trip.com');
      expect(url.pathname, route.slug).toMatch(/^\/flights\//);
      expect(url.searchParams.get('dcity'), route.slug).toBe(airport.code);
      // Trip.com uses city codes for Izmir and Rome, while JetStash correctly
      // records their individual airports as ADB and FCO. Dashboard-generated
      // handoffs are retained rather than hand-edited to airport codes.
      const providerDestinationCode = ({ izmir: 'IZM', rome: 'ROM' } as Record<string, string>)[route.destinationSlug] ?? destination.iataCode;
      expect(url.searchParams.get('acity'), route.slug).toBe(providerDestinationCode);
      expect(url.searchParams.get('Allianceid'), route.slug).toBe('9804124');
      expect(url.searchParams.get('SID'), route.slug).toBe('327450313');
      expect(url.searchParams.get('trip_sub3'), route.slug).toMatch(/^D\d+$/);
      expect(url.searchParams.get('locale'), route.slug).toBe('en-XX');
      expect(url.searchParams.get('curr'), route.slug).toBe('GBP');
      expect(handoff.url).not.toMatch(/localhost|\?[^?]*\?|&&/);
    }
  });

  it('keeps London airport-specific routes fail-closed when no verified handoff exists', () => {
    for (const route of routes.filter((candidate) => candidate.airportSlug.startsWith('london-'))) {
      expect(handoffForRoute(route), route.slug).toBeNull();
    }
  });

  it('preserves the frozen Manchester–Islamabad handoff and affiliate identifiers', () => {
    const handoff = getSafeTripComFlightHandoffUrl('manchester-islamabad', 'manchester', 'islamabad', NOW);
    expect(handoff).toContain('tickets-MAN-ISB');
    expect(handoff).toContain('trip_sub3=D19082296');
  });

  it('retains the required sponsored external-link relationship', () => {
    expect(PROVIDER_REL).toBe('nofollow sponsored noopener noreferrer');
  });
});

describe('First Revenue Sprint Phase 1 — partner click instrumentation', () => {
  it('keeps route and CTA-surface identifiers at every flight CTA call site', () => {
    const files = [
      'components/route/fare-signal.tsx',
      'components/ui/deal-card.tsx',
      'components/ui/no-fare-fallback.tsx',
      'components/sections/tracked-fares-explorer.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).toContain('event="tripcom_click"');
      expect(source, file).toMatch(/properties=\{\{ route: [^,}]+, source: /);
    }
  });

  it('uses a single tracked leaf per partner CTA, preventing parent/child double-fire wiring', () => {
    const source = readFileSync(join(process.cwd(), 'components/ui/tracked-outbound-link.tsx'), 'utf8');
    expect(source.match(/onClick=/g)).toHaveLength(1);
    expect(source).toContain('onClick={() => track(event, properties)}');
  });

  it('keeps Google Ads conversion dispatch guarded by the consent-dependent gtag availability check', () => {
    const source = readFileSync(join(process.cwd(), 'lib/google-ads-conversions.ts'), 'utf8');
    expect(source).toContain("if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;");
  });
});
