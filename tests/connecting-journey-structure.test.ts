import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { routes, getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, isPubliclyPublishable, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { FareSignal } from '@/components/route/fare-signal';

/**
 * Connecting Journey Structure + BHX-DEL unlock (22 August 2026). The
 * founder explicitly rejected a generic "may differ" warning for every
 * connecting-route + connecting-fare pair (13+1 cases in the prior
 * Clarity Audit) in favour of a fail-closed, evidence-gated comparison:
 * `data/routes.ts`'s new `routeServiceConnections` field (populated only
 * where primary-source evidence names a specific hub for both directions)
 * compared against a tracked fare's own structured connection-airport
 * fields via `routeServiceFareMismatch()` (components/route/fare-signal.tsx).
 * This file proves the 13 regression points from that spec.
 */

const NOW_ISO = '2026-08-22';
const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf-8');

function presentationFor(slug: string) {
  const route = getRouteBySlug(slug)!;
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
  return { route, presentation };
}

function renderFareSignalForRoute(slug: string): string {
  const { route, presentation } = presentationFor(slug);
  const signal = getFareSignalForRoute(route.slug, NOW_ISO);
  const airport = getRouteAirport(route)!;
  const dest = getRouteDestination(route)!;
  const html = renderToStaticMarkup(
    FareSignal({
      signal,
      tripComUrl: getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug),
      routeSlug: route.slug,
      routeDirectness: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null,
      routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
      routeAirlineLabel: null,
      routeServiceConnections: route.routeServiceConnections ?? null,
    })
  );
  return html.replace(/\s+/g, ' ');
}

describe('1. existing PR #155 direct-vs-connecting wording is completely unchanged', () => {
  it('routeVsFareMismatch()\'s own wording ("a different, X journey") is untouched in source', () => {
    expect(fareSignalSrc).toContain('This tracked fare is a different, ${fareDirectnessWord} journey.');
  });

  it('a real direct-route + connecting-fare mismatch still renders the original wording, not the new connecting-vs-connecting one', () => {
    const html = renderFareSignalForRoute('manchester-islamabad');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
    expect(html).not.toContain('This tracked fare is a different connecting journey.');
  });
});

describe('2. Birmingham-Delhi gets a proven connecting-vs-connecting mismatch', () => {
  it('route carries routeServiceConnections via Amritsar (ATQ); the tracked fare connects via Frankfurt/Munich', () => {
    const route = getRouteBySlug('birmingham-delhi')!;
    expect(route.routeServiceConnections).toEqual({ outbound: ['ATQ'], return: ['ATQ'] });
    const signal = getFareSignalForRoute('birmingham-delhi', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.connectionAirports).toEqual(['Frankfurt Airport (FRA)', 'Munich Airport (MUC)']);
  });

  it('renders the new "different connecting journey" callout, with no airport codes repeated inside the note itself', () => {
    const html = renderFareSignalForRoute('birmingham-delhi');
    expect(html).toContain('Route service');
    expect(html).toContain('This tracked fare is a different connecting journey.');
    // formatRouting() renders the fare's own connection airports elsewhere on
    // the card -- the note text itself must not duplicate them.
    const noteMatch = html.match(/This tracked fare is a different connecting journey\./);
    expect(noteMatch).not.toBeNull();
  });
});

describe('3. Birmingham-Lahore and Birmingham-Islamabad stay clean: proven-same routing renders no callout', () => {
  it('birmingham-lahore: route (IST) and fare (Istanbul Airport (IST)) resolve to the same hub', () => {
    const route = getRouteBySlug('birmingham-lahore')!;
    expect(route.routeServiceConnections).toEqual({ outbound: ['IST'], return: ['IST'] });
    const signal = getFareSignalForRoute('birmingham-lahore', NOW_ISO);
    expect(signal.observation?.connectionAirports).toEqual(['Istanbul Airport (IST)']);
    const html = renderFareSignalForRoute('birmingham-lahore');
    expect(html).not.toContain('Route service');
    expect(html).not.toContain('different connecting journey');
  });

  it('birmingham-islamabad: route (IST) and fare (Istanbul Airport (IST)) resolve to the same hub', () => {
    const route = getRouteBySlug('birmingham-islamabad')!;
    expect(route.routeServiceConnections).toEqual({ outbound: ['IST'], return: ['IST'] });
    const signal = getFareSignalForRoute('birmingham-islamabad', NOW_ISO);
    expect(signal.observation?.connectionAirports).toEqual(['Istanbul Airport (IST)']);
    const html = renderFareSignalForRoute('birmingham-islamabad');
    expect(html).not.toContain('Route service');
    expect(html).not.toContain('different connecting journey');
  });
});

describe('4. Manchester-Karachi stays completely silent: no routeServiceConnections, so no comparison ever runs', () => {
  it('the route has no routeServiceConnections field at all (COV-001 found no single stable hub)', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.routeServiceConnections).toBeUndefined();
  });

  it('renders no "Route service" callout despite having a current connecting fare', () => {
    const signal = getFareSignalForRoute('manchester-karachi', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.directness).toBe('connecting');
    const html = renderFareSignalForRoute('manchester-karachi');
    expect(html).not.toContain('Route service');
  });
});

describe('5. missing route or fare evidence resolves silently, never a guess', () => {
  it('a route with routeServiceConnections but a fare lacking structured connection-airport evidence renders no callout (nothing to compare against)', () => {
    // manchester-dhaka gained routeServiceConnections this same PR (single
    // named hub, both directions, from Biman's own official notice) and
    // does have a current tracked fare (Emirates, 18 Aug) -- but that fare
    // observation carries no outboundConnectionAirports/
    // returnConnectionAirports of its own, so connectionAirports is empty
    // and routeServiceFareMismatch() must stay silent rather than guess.
    const route = getRouteBySlug('manchester-dhaka')!;
    expect(route.routeServiceConnections).toEqual({ outbound: ['ZYL'], return: ['ZYL'] });
    const signal = getFareSignalForRoute('manchester-dhaka', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.connectionAirports).toEqual([]);
    const html = renderFareSignalForRoute('manchester-dhaka');
    expect(html).not.toContain('Route service');
  });

  it('across the full 88-route dataset, the new callout only ever fires for the one proven-different route (birmingham-delhi)', () => {
    let newCalloutCount = 0;
    const firedFor: string[] = [];
    for (const route of routes) {
      if (!route.routeServiceConnections) continue;
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
      if (!signal.observation || signal.observation.directness !== 'connecting') continue;
      const html = renderFareSignalForRoute(route.slug);
      if (html.includes('different connecting journey')) {
        newCalloutCount += 1;
        firedFor.push(route.slug);
      }
    }
    expect(firedFor).toEqual(['birmingham-delhi']);
    expect(newCalloutCount).toBe(1);
  });
});

describe('6. no prose parsing, no airline-identity inference', () => {
  it('routeServiceFareMismatch() never reads flightTime, verification.note or airlineSlugs -- it only compares two structured airport-code lists', () => {
    const fnSrc = fareSignalSrc.slice(fareSignalSrc.indexOf('function routeServiceFareMismatch'), fareSignalSrc.indexOf('function RouteVsFareCallout'));
    expect(fnSrc).not.toContain('flightTime');
    expect(fnSrc).not.toContain('verification');
    expect(fnSrc).not.toContain('airlineSlugs');
    expect(fnSrc).not.toContain('.note');
  });
});

describe('7. no generic connecting-route warning was introduced for the wider 13-route set', () => {
  it('routes the prior Clarity Audit flagged as connecting-vs-connecting mismatches, but which carry no routeServiceConnections evidence, still render no callout', () => {
    const stillSilent = ['manchester-amritsar', 'manchester-ahmedabad', 'manchester-madinah', 'birmingham-mumbai', 'manchester-jeddah', 'birmingham-madinah'];
    for (const slug of stillSilent) {
      const route = getRouteBySlug(slug)!;
      expect(route.routeServiceConnections, slug).toBeUndefined();
      const html = renderFareSignalForRoute(slug);
      expect(html, slug).not.toContain('different connecting journey');
    }
  });
});

describe('8, 9 & 10. Birmingham-Delhi observation lifecycle', () => {
  it('the 13 August observation is now valid/comparable (unsuppressed, not altered)', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-bhx-del-economy-20260813-8w-v1')!;
    expect(isPubliclyPublishable(obs)).toBe(true);
    expect(obs.price).toBe(658);
    expect(obs.source).toBe('Lufthansa and Air India');
    expect(obs.comparisonEligibility).toBe('current');
  });

  it('the 18 August observation remains excluded, untouched', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-bhx-del-economy-20260818-8w-v1')!;
    expect(isPubliclyPublishable(obs)).toBe(false);
    expect(obs.price).toBe(527);
  });

  it('the 22 August observation is the current publicly-shown fare', () => {
    const signal = getFareSignalForRoute('birmingham-delhi', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe('obs-bhx-del-economy-20260822-8w-v1');
    expect(signal.observation?.price).toBe(776);
  });
});

describe('11. Trip.com resolver and affiliate parameters are untouched', () => {
  it('birmingham-delhi\'s handoff URL is unchanged and carries the same affiliate identifiers as before', () => {
    const url = getTripComFlightHandoffUrl('birmingham-delhi', 'birmingham', 'delhi');
    expect(url).not.toBeNull();
    expect(url).toContain('BHX-DEL');
    expect(url).toContain('Allianceid=9804124');
    expect(url).toContain('SID=327450313');
  });
});

describe('12. unresolved routes (no routeServiceConnections evidence) remain fail-closed', () => {
  it('the vast majority of routes carry no routeServiceConnections field at all', () => {
    const withField = routes.filter((r) => r.routeServiceConnections);
    expect(withField.map((r) => r.slug).sort()).toEqual(
      ['birmingham-delhi', 'birmingham-islamabad', 'birmingham-lahore', 'manchester-dhaka'].sort()
    );
  });
});

describe('13. Fare Watcher does not manufacture a candidate for the newly-unlocked Birmingham-Delhi fare', () => {
  it('birmingham-delhi has fewer than the minimum comparable baseline, so no candidate forms', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    expect(candidates.some((c) => c.routeSlug === 'birmingham-delhi')).toBe(false);
  });
});

describe('route-page wiring: routeServiceConnections is passed straight through with no re-derivation', () => {
  it('app/routes/[slug]/page.tsx passes route.routeServiceConnections into <FareSignal>', () => {
    const pageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf-8');
    expect(pageSrc).toContain('routeServiceConnections={route.routeServiceConnections ?? null}');
  });
});
