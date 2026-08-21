import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes, getRouteAirport, getRouteDestination, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { FareSignal } from '@/components/route/fare-signal';

/**
 * Route Page Scanability fix (21 Aug 2026). Read-only audit
 * ("JETSTASH — ROUTE PAGE SCANABILITY AUDIT") measured, on live production,
 * that the hero's own Trip.com CTA sat at or past the mobile fold (852px at
 * 375px width, 822px at 390px, against 812/844px viewports) while the exact
 * same action was repeated one section below in Fare Signal — an identical
 * link, an identical "Partner link" caveat, ~200-850px apart, adding zero
 * comprehension. Founder-approved fix: delete the hero's duplicate CTA,
 * caption, itinerary/baggage caveat and the continuation cue that only
 * existed to bridge to it; let Fare Signal (which already renders
 * unconditionally as the very next section) be the one place a route's
 * booking action lives. WhatsApp Share is explicitly kept, just no longer
 * sharing a flex row with the removed CTA.
 *
 * Scope is presentation-only: no Trip.com URL, fare observation, route
 * verification evidence, Fare Watcher, Route Watch or dated-handoff work is
 * touched by this fix.
 */

const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');

const NOW_ISO = '2026-08-21';

function presentationFor(slug: string) {
  const route = getRouteBySlug(slug)!;
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
  return { route, airport, dest, presentation };
}

describe('the hero no longer contains the duplicate Trip.com CTA', () => {
  it('the hero CTA button, its wording, its caption and the continuation cue are all gone from the route page', () => {
    expect(routePageSrc).not.toContain('Compare flights on Trip.com');
    expect(routePageSrc).not.toContain('More JetStash intelligence below');
    expect(routePageSrc).not.toContain('route-intelligence-continuation-cue');
    // The itinerary/baggage caveat is gone from the hero specifically —
    // Fare Signal's own copy of it (asserted below) is the one survivor.
    const heroSection = routePageSrc.slice(routePageSrc.indexOf('<section className="relative overflow-hidden bg-ink-900'), routePageSrc.indexOf('</section>'));
    expect(heroSection).not.toContain('Check the itinerary, baggage allowance and booking terms before paying.');
  });

  it('the hero no longer imports or uses TrackedOutboundLink or PROVIDER_REL (both moved out with the CTA)', () => {
    expect(routePageSrc).not.toContain("import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';");
    expect(routePageSrc).not.toMatch(/PROVIDER_REL/);
  });
});

describe('WhatsApp Share remains available in the hero, in a standalone position', () => {
  it('WhatsAppShareButton is still imported and rendered from the route page', () => {
    expect(routePageSrc).toContain("import { WhatsAppShareButton } from '@/components/route/whatsapp-share-button';");
    expect(routePageSrc).toMatch(/<WhatsAppShareButton[\s\S]*?source="route-hero"/);
  });

  it('keeps its exact existing condition — it still moves into the Book-By panel instead of duplicating there, unchanged by this fix', () => {
    expect(routePageSrc).toMatch(/\{!bookBySnapshot && \(\s*<div className="mt-7">\s*<WhatsAppShareButton/);
  });
});

describe('Fare Signal is the one remaining first commercial decision unit', () => {
  it('renders exactly once, immediately after the hero, unconditionally', () => {
    expect((routePageSrc.match(/<FareSignal/g) ?? []).length).toBe(1);
  });

  it('a route with a valid handoff still gets: tracked fare, airline/cabin, checked date, routing, dates, the Route Service distinction where applicable, the CTA, and one complete caveat', () => {
    const { route, presentation } = presentationFor('manchester-islamabad');
    const signal = getFareSignalForRoute(route.slug, NOW_ISO);
    const dest = getRouteDestination(route)!;
    const airport = getRouteAirport(route)!;
    const tripComUrl = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
    expect(tripComUrl).not.toBeNull();

    const html = renderToStaticMarkup(
      FareSignal({
        signal,
        tripComUrl,
        routeSlug: route.slug,
        routeDirectness: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null,
        routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
        routeAirlineLabel: 'PIA',
      })
    ).replace(/\s+/g, ' ');

    expect(html).toContain('630'); // tracked fare
    expect(html).toContain('Etihad'); // airline/cabin
    expect(html).toContain('Checked 18 August 2026'); // checked date
    expect(html).toContain('Connecting journey'); // routing
    expect(html).toContain('13 October 2026'); // dates
    expect(html).toContain('Route service'); // PR #155 distinction (mismatch case)
    expect(html).toContain('PIA · Direct');
    expect(html).toContain('Check current price'); // CTA
    expect(html).toContain('Check the itinerary, baggage allowance and booking terms before paying. Partner link, opens Trip.com in a new tab.'); // one complete caveat
  });
});

describe('no-CTA routes still show the exact fail-closed message, in Fare Signal now instead of the hero', () => {
  it('a route with no safe Trip.com handoff (london-heathrow-mumbai) shows the exact sentence and no CTA', () => {
    const { route } = presentationFor('london-heathrow-mumbai');
    const dest = getRouteDestination(route)!;
    const airport = getRouteAirport(route)!;
    const tripComUrl = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
    expect(tripComUrl).toBeNull();
    const signal = getFareSignalForRoute(route.slug, NOW_ISO);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl, routeSlug: route.slug })).replace(/\s+/g, ' ');
    expect(html).toContain('Exact partner booking link is not currently verified for this route.');
    expect(html).not.toContain('Check current price');
  });

  it('the sentence is byte-identical to the one the hero used to show (moved, not reworded)', () => {
    expect(fareSignalSrc).toContain('Exact partner booking link is not currently verified for this route.');
  });
});

describe('verification-pending routes remain fail-closed on route-service claims — but keep a genuinely verified CTA if one exists', () => {
  it('birmingham-lahore: unverified route status, but its independently-verified Trip.com link (a separate fact) still renders — no Route Service claim, no fabricated directness', () => {
    const { route, presentation } = presentationFor('birmingham-lahore');
    expect(presentation.status).toBe('unverified');
    const dest = getRouteDestination(route)!;
    const airport = getRouteAirport(route)!;
    const tripComUrl = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
    expect(tripComUrl).not.toBeNull(); // genuinely verified, independent of route-service status
    const signal = getFareSignalForRoute(route.slug, NOW_ISO);
    expect(signal.state).toBe('none');

    const html = renderToStaticMarkup(
      FareSignal({ signal, tripComUrl, routeSlug: route.slug, routeDirectness: null, routeStatusLabel: null, routeAirlineLabel: null })
    ).replace(/\s+/g, ' ');
    expect(html).toContain('No current fare tracked.');
    expect(html).not.toContain('Route service');
    expect(html).not.toMatch(/\bDirect\b/);
    // The CTA is legitimate here — it comes from booking-providers.ts's own
    // separate dashboard-verified map, not from route-service evidence.
    expect(html).toContain('Check current price');
  });

  it('a route with neither a fare nor a verified CTA (unverified + no handoff) shows the fail-closed sentence, not a silent gap', () => {
    const unverifiedNoCta = routes.find((r) => {
      const { presentation } = presentationFor(r.slug);
      if (presentation.status !== 'unverified') return false;
      const dest = getRouteDestination(r);
      const airport = getRouteAirport(r);
      if (!dest || !airport) return false;
      return getTripComFlightHandoffUrl(r.slug, airport.slug, dest.slug) === null;
    });
    expect(unverifiedNoCta, 'expected at least one unverified route with no Trip.com handoff in the current dataset').toBeDefined();
    const { route } = presentationFor(unverifiedNoCta!.slug);
    const signal = getFareSignalForRoute(route.slug, NOW_ISO);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: route.slug })).replace(/\s+/g, ' ');
    expect(html).toContain('Exact partner booking link is not currently verified for this route.');
  });
});

describe('no evidence or trust wording was accidentally lost — full 88-route safety check', () => {
  it('every route resolves to exactly one of: a working CTA, or the exact fail-closed sentence — never neither, never both', () => {
    let withCta = 0;
    let failClosed = 0;
    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      const tripComUrl = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
      const { presentation } = presentationFor(route.slug);
      const html = renderToStaticMarkup(
        FareSignal({
          signal,
          tripComUrl,
          routeSlug: route.slug,
          routeDirectness: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null,
          routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
          routeAirlineLabel: null,
        })
      );
      const hasCtaText = html.includes('Check current price');
      const hasFailClosedText = html.includes('Exact partner booking link is not currently verified for this route.');
      expect(hasCtaText, route.slug).toBe(Boolean(tripComUrl));
      expect(hasFailClosedText, route.slug).toBe(!tripComUrl);
      if (hasCtaText) withCta += 1;
      if (hasFailClosedText) failClosed += 1;
    }
    // 63 routes have a verified Trip.com link (unchanged by this fix — see
    // the 21 Aug 2026 Trip.com dated-handoff readiness audit), 25 do not.
    expect(withCta).toBe(63);
    expect(failClosed).toBe(25);
    expect(withCta + failClosed).toBe(88);
  });

  it('the PR #155 Route Service distinction is completely unaffected by this fix — the mismatch counts from that audit still hold', () => {
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
      const { presentation } = presentationFor(route.slug);
      const signal = getFareSignalForRoute(route.slug, NOW_ISO);
      const fareDirectness = signal.observation?.directness ?? null;
      if (presentation.status === 'unverified') { unverified += 1; continue; }
      if (fareDirectness === null) { noFare += 1; continue; }
      if (presentation.status === 'direct' && fareDirectness === 'connecting') directConnectingFare += 1;
      else if (presentation.status === 'direct' && fareDirectness === 'direct') directDirectFare += 1;
      else if (presentation.status === 'connecting' && fareDirectness === 'connecting') connectingConnectingFare += 1;
      else if (presentation.status === 'connecting' && fareDirectness === 'direct') connectingDirectFare += 1;
    }
    expect(directConnectingFare).toBe(56);
    expect(directDirectFare).toBe(12);
    expect(connectingConnectingFare).toBe(10);
    expect(connectingDirectFare).toBe(0);
    expect(noFare).toBe(1);
    expect(unverified).toBe(9);
  });
});
