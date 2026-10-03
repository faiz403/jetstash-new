import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, getRouteAirport, getRouteDestination, routes } from '@/data/routes';
import { getTripComFlightHandoffUrl, GENERIC_FLIGHT_SEARCH_URL, SERVICE_ENDED_CTA_LABEL, NO_VERIFIED_PARTNER_LINK_NOTE } from '@/lib/booking-providers';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { FareSignal, checkPricesHeading } from '@/components/route/fare-signal';
import RoutePage from '@/app/routes/[slug]/page';

/**
 * First-screen buying fix (3 Oct 2026, founder-approved). A real traveller asked for
 * Manchester to Delhi; the page opened on a dead-looking "No current fare tracked." with the
 * useful answer several screens down. These tests pin the new first-screen behaviour:
 * the fare/price block leads, the no-fare state is a route-specific helpful lead (never a
 * fabricated fare, never a live-price claim, never a directness claim JetStash cannot back),
 * service-ended routes say connecting flights are available first, and no affiliate URL,
 * disclosure or fare-selection behaviour changed.
 */

const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const NOW_ISO = '2026-10-03';
const norm = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function renderPage(slug: string) {
  return norm(renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) })));
}

function renderSignal(slug: string, opts: { isServiceEnded?: boolean; withUrl?: boolean; routeLabel?: string | null; connecting?: boolean; routeContext?: boolean } = {}) {
  const route = getRouteBySlug(slug)!;
  const airport = getRouteAirport(route)!;
  const dest = getRouteDestination(route)!;
  const url = opts.withUrl === false ? null : getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
  const signal = getFareSignalForRoute(route.slug, NOW_ISO);
  return {
    url,
    html: norm(
      renderToStaticMarkup(
        FareSignal({
          signal,
          tripComUrl: url,
          routeSlug: route.slug,
          isServiceEnded: opts.isServiceEnded ?? false,
          ...(opts.routeContext ? { routeDirectness: 'direct' as const, routeStatusLabel: 'Direct', routeAirlineLabel: 'Emirates' } : {}),
          routeLabel: opts.routeLabel === undefined ? `${airport.city} to ${dest.city}` : opts.routeLabel,
          connectingSummary: opts.connecting ? { stops: 1, hubs: ['Dubai', 'Doha'], journeyTime: '12 to 15h total' } : null,
        })
      )
    ),
  };
}

describe('the fare / price block comes before the secondary share and evidence content', () => {
  it('WhatsApp Share is no longer inside the hero; it renders after the fare block, with the same condition and analytics source', () => {
    const heroStart = routePageSrc.indexOf('<section className="relative overflow-hidden bg-ink-900');
    const heroEnd = routePageSrc.indexOf('</section>', heroStart);
    expect(routePageSrc.slice(heroStart, heroEnd)).not.toContain('<WhatsAppShareButton');
    expect(routePageSrc.indexOf('<FareSignal')).toBeGreaterThan(heroEnd);
    expect(routePageSrc.indexOf('<WhatsAppShareButton')).toBeGreaterThan(routePageSrc.indexOf('<FareSignal'));
    expect(routePageSrc).toContain('source="route-hero"');
    expect(routePageSrc).toMatch(/\{!bookBySnapshot && \(\s*<div className="mt-5">\s*<WhatsAppShareButton/);
  });

  it('on a rendered page the fare block precedes the share button and the long Route Status evidence', async () => {
    const html = await renderPage('manchester-delhi');
    expect(html.indexOf('Fare check')).toBeGreaterThan(-1);
    expect(html.indexOf('Fare check')).toBeLessThan(html.indexOf('Share on WhatsApp'));
    expect(html.indexOf('Fare check')).toBeLessThan(html.indexOf('Post-effective-date verification'));
  });
});

describe('no fare + a safe handoff: a helpful, honest lead instead of a dead-looking line', () => {
  it('birmingham-ahmedabad (verification pending, exact Trip.com handoff): route-specific heading, neutral wording, the Trip.com CTA and its disclosure', () => {
    const { html, url } = renderSignal('birmingham-ahmedabad');
    expect(url).not.toBeNull();
    expect(html).toContain("Check today's Birmingham → Ahmedabad prices");
    expect(html).toContain("JetStash hasn't logged a current fare for this route yet.");
    expect(html).toContain('Compare flights on Trip.com');
    expect(html).toContain('Ad · Affiliate link.');
    expect(html).toContain('JetStash earns commission on eligible bookings through this link');
    // an unverified route never gets a directness claim it cannot back
    expect(html).not.toContain('Connecting flights available');
    expect(html).not.toContain('Route service');
  });

  it('the heading is derived from the route label, never typed per route', () => {
    expect(checkPricesHeading('Manchester to Delhi')).toBe("Check today's Manchester → Delhi prices");
    expect(checkPricesHeading(null)).toBe("Check today's prices");
  });

  it('does not claim a live price, a discount or urgency', () => {
    const { html } = renderSignal('birmingham-ahmedabad');
    expect(html).not.toMatch(/\b(live|real-time|right now|instant)\b/i);
    expect(html).not.toMatch(/\b(deal|save|cheap|hurry|limited time)\b/i);
    expect(html).not.toMatch(/£\s?\d/);
  });
});

describe('service-ended routes: connecting flights are available, said first', () => {
  for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
    it(`${slug}: the top of the fare block says connecting flights are available, the former direct service ended, the typical pattern and shows the connecting CTA`, async () => {
      const html = await renderPage(slug);
      const route = getRouteBySlug(slug)!;
      const alt = route.connectingAlternative!;
      expect(alt).toBeTruthy();
      const lead = html.indexOf('Connecting flights available');
      expect(lead).toBeGreaterThan(-1);
      expect(html).toContain('The former direct service has ended.');
      expect(html).toContain(`Usually ${alt.typicalStops} stop`);
      expect(html).toContain(alt.typicalJourneyTime);
      for (const hub of alt.hubAirports) expect(html).toContain(hub);
      expect(html).toContain(SERVICE_ENDED_CTA_LABEL);
      expect(html).toContain("JetStash hasn't logged a current fare for this route yet.");
      // the long historical explanation stays, but below the lead
      expect(html).toContain('Direct service ended');
      expect(html.indexOf('Post-effective-date verification')).toBeGreaterThan(lead);
      // the route page still shows the same connecting block and still never invents a fare
      expect(html).toContain('You can still fly this route with a connection');
      expect(html).not.toContain('Standout Fare');
      expect(html).not.toContain('Fare spotted');
    });
  }

  it('a service-ended route with no exact handoff keeps the exact fail-closed sentence and makes no connecting-availability promise', () => {
    const { html } = renderSignal('birmingham-ahmedabad', { isServiceEnded: true, withUrl: false });
    expect(html).toContain(NO_VERIFIED_PARTNER_LINK_NOTE);
    expect(html).not.toContain('Connecting flights available');
    expect(html).not.toContain('Search current flights');
  });
});

describe('exact Trip.com handoffs and the London Google Flights fallback are unchanged', () => {
  it('every Trip.com handoff URL still renders byte-for-byte as before (no URL was edited)', () => {
    let checked = 0;
    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      const url = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
      if (!url) continue;
      const { html } = renderSignal(route.slug, { isServiceEnded: false });
      expect(html, route.slug).toContain(url.replace(/&amp;/g, '&'));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('london-heathrow-dhaka: no Trip.com link is fabricated; the Google Flights fallback is a prominent button that is still plainly not a partner link', () => {
    const { html, url } = renderSignal('london-heathrow-dhaka');
    expect(url).toBeNull();
    expect(html).toContain("Check today's London → Dhaka prices");
    expect(html).toContain('Search current flights');
    expect(html).toContain(`href="${GENERIC_FLIGHT_SEARCH_URL}"`);
    expect(html).toContain('does not earn commission');
    expect(html).not.toContain('trip.com');
    expect(html).not.toContain('Ad · Affiliate link.');
    expect(html).toContain('min-h-12');
    expect(html).not.toContain('rel="nofollow sponsored');
  });

  it('london-gatwick-athens keeps the same fallback (no monetised handoff invented)', () => {
    const { html, url } = renderSignal('london-gatwick-athens');
    expect(url).toBeNull();
    expect(html).toContain('Search current flights');
    expect(html).not.toContain('trip.com');
  });
});

describe('routes with a current fare keep the fare, the date and the affiliate disclosure', () => {
  it('manchester-dubai shows the fare, a checked date and the disclosure next to a prominent Trip.com button', () => {
    const { html, url } = renderSignal('manchester-dubai', { routeContext: true });
    expect(url).not.toBeNull();
    expect(html).toMatch(/Fare spotted|Standout Fare|Last tracked fare/);
    expect(html).toMatch(/£[\d,]+ return/);
    expect(html).toMatch(/Checked \d{1,2} \w+ \d{4}/);
    expect(html).toContain('Compare flights on Trip.com');
    expect(html).toContain('Ad · Affiliate link.');
    expect(html).toContain('min-h-12');
    expect(html).toContain('Route service');
  });
});
