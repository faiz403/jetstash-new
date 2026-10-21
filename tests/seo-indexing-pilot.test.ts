import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getRouteBySlug, getRouteAirport, getRouteDestination, routes, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import {
  SEO_PILOT_PAGE_SLUGS,
  SEO_PRIORITY_LINK_TARGET_SLUGS,
  getQuickAnswersContent,
  getSeoRouteLinks,
  isRouteEligibleForSeoLink,
  isSeoPilotPage,
} from '@/lib/seo-indexing-pilot';
import { RouteQuickAnswers } from '@/components/route/route-quick-answers';
import { SeoRouteLinks } from '@/components/route/seo-route-links';

// Fixed dates only: the day the pilot was built, each review date (inclusive),
// the day after it, and the day after Birmingham-Delhi's review.
const BUILT = '2026-10-21';
const MANCHESTER_REVIEW_DAY = '2026-11-16';
const AFTER_MANCHESTER_REVIEWS = '2026-11-17';
const MANCHESTER_DUBAI_REVIEW_DAY = '2027-01-19';
const AFTER_MANCHESTER_DUBAI_REVIEW = '2027-01-20';
const AFTER_BIRMINGHAM_DELHI_REVIEW = '2026-12-04';

/** Mirrors the route page: the block renders only from getQuickAnswersContent(). */
function renderQuickAnswers(route: Route, nowIso: string) {
  const content = getQuickAnswersContent(route, nowIso);
  if (!content) return '';
  return renderToStaticMarkup(createElement(RouteQuickAnswers, {
    route,
    content,
    airport: getRouteAirport(route)!,
    dest: getRouteDestination(route)!,
  }));
}

const route = (slug: string) => getRouteBySlug(slug)!;
/** The same route with a different verification check, e.g. an older or a later re-dated one. */
const withCheck = (slug: string, verifiedDate: string, reviewDueDate: string): Route => {
  const r = route(slug);
  return { ...r, verification: { ...r.verification!, verifiedDate, reviewDueDate } };
};

describe('SEO indexing pilot: scope', () => {
  it('improves exactly three pages, never the Lahore/Mumbai title-experiment pages', () => {
    expect([...SEO_PILOT_PAGE_SLUGS]).toEqual(['manchester-islamabad', 'manchester-dubai', 'birmingham-delhi']);
    expect(isSeoPilotPage('manchester-lahore')).toBe(false);
    expect(isSeoPilotPage('manchester-mumbai')).toBe(false);
    expect(getQuickAnswersContent(route('manchester-lahore'), BUILT)).toBeNull();
  });

  it('only lists route slugs that exist', () => {
    for (const slug of SEO_PRIORITY_LINK_TARGET_SLUGS) expect(getRouteBySlug(slug), slug).toBeDefined();
  });

  it('renders the pilot blocks from the route page only behind the gates, with no FAQ schema', () => {
    const page = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
    expect(page).toContain('isSeoPilotPage(route.slug) && isRouteEligibleForSeoLink(route, nowIso)');
    expect(page).toContain('getQuickAnswersContent(route, nowIso)');
    expect(page).not.toContain('FAQPage');
  });
});

describe('SEO indexing pilot: link eligibility (fail-closed)', () => {
  it('links every chosen target while its route verification is current', () => {
    expect(getSeoRouteLinks(BUILT).map((l) => l.slug)).toEqual([...SEO_PRIORITY_LINK_TARGET_SLUGS]);
  });

  it('keeps the Manchester pages on their review date and drops them the day after', () => {
    expect(getSeoRouteLinks(MANCHESTER_REVIEW_DAY).map((l) => l.slug)).toContain('manchester-islamabad');
    const later = getSeoRouteLinks(AFTER_MANCHESTER_REVIEWS).map((l) => l.slug);
    expect(later).not.toContain('manchester-islamabad');
    expect(later).toContain('manchester-dubai');
    expect(later).toContain('birmingham-delhi');
    expect(getSeoRouteLinks(MANCHESTER_DUBAI_REVIEW_DAY).map((l) => l.slug)).toContain('manchester-dubai');
    expect(getSeoRouteLinks(AFTER_MANCHESTER_DUBAI_REVIEW).map((l) => l.slug)).not.toContain('manchester-dubai');
  });

  it('drops Birmingham-Delhi after its review even though its page still reads Connecting', () => {
    expect(getEffectiveRoutePresentation(route('birmingham-delhi'), routeStatusEvents, AFTER_BIRMINGHAM_DELHI_REVIEW).status).toBe('connecting');
    expect(isRouteEligibleForSeoLink(route('birmingham-delhi'), AFTER_BIRMINGHAM_DELHI_REVIEW)).toBe(false);
  });

  it('never promotes a pending, service-ended or lapsed-review route', () => {
    // Connecting shape kept after its review date lapsed (5 Oct / 18 Oct 2026).
    expect(isRouteEligibleForSeoLink(route('birmingham-islamabad'), BUILT)).toBe(false);
    expect(isRouteEligibleForSeoLink(route('manchester-amritsar'), BUILT)).toBe(false);
    expect(isRouteEligibleForSeoLink(route('manchester-ahmedabad'), BUILT)).toBe(false);
    // Service ended, and verification pending.
    expect(isRouteEligibleForSeoLink(route('manchester-delhi'), BUILT)).toBe(false);
    expect(isRouteEligibleForSeoLink(route('london-gatwick-amritsar'), BUILT)).toBe(false);
  });

  it('agrees with the Route Status gate for every route on the build date', () => {
    for (const r of routes) {
      const status = getEffectiveRoutePresentation(r, routeStatusEvents, BUILT).status;
      if (isRouteEligibleForSeoLink(r, BUILT)) expect(['direct', 'connecting'], r.slug).toContain(status);
    }
  });

  it('renders nothing rather than an empty heading when no target is eligible', () => {
    expect(renderToStaticMarkup(createElement(SeoRouteLinks, { links: [], heading: 'Route guides' }))).toBe('');
  });

  it('uses a real heading, decorative icons and codes plus status beside each link', () => {
    const html = renderToStaticMarkup(createElement(SeoRouteLinks, { links: getSeoRouteLinks(BUILT), heading: 'Route guides' }));
    expect(html).toContain('<h3');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('href="/routes/manchester-dubai"');
    expect(html).toContain('MAN → DXB · Direct');
    expect(html).toContain('BHX → DEL · Connecting');
  });
});

describe('SEO indexing pilot: Quick answers state only what the cited source supports', () => {
  it('Manchester-Islamabad: nonstop and operator from Manchester Airport, no operating days claimed', () => {
    const html = renderQuickAnswers(route('manchester-islamabad'), BUILT);
    expect(html).toContain('Manchester to Islamabad (MAN → ISB): quick answers');
    expect(html).toContain('PIA flies direct to Islamabad');
    expect(html).toContain('does not list operating days');
    expect(html).not.toContain('Mon, Tue, Thu');
    expect(html).not.toContain('How long is the journey?');
    expect(html).toContain('which supports PIA as the operator and the nonstop service');
  });

  it('promises withdrawal of the added answers, never a status change', () => {
    for (const slug of ['manchester-islamabad', 'birmingham-delhi']) {
      const html = renderQuickAnswers(route(slug), BUILT);
      expect(html, slug).toContain('quick answers and the route links below are withdrawn from this page');
      expect(html, slug).not.toContain('Verification pending');
    }
  });

  it('Birmingham-Delhi: self-contained, names AI118 via Amritsar, never claims nonstop', () => {
    const html = renderQuickAnswers(route('birmingham-delhi'), BUILT);
    expect(html).toContain('Not nonstop.');
    expect(html).toContain('AI118 service flies via Amritsar (ATQ)');
    expect(html).toContain('not a self-transfer');
    expect(html).not.toContain('see note');
    expect(renderQuickAnswers(route('birmingham-delhi'), AFTER_BIRMINGHAM_DELHI_REVIEW)).toBe('');
  });

  it('Manchester-Dubai: withheld against the outdated 18 Aug check', () => {
    expect(getQuickAnswersContent(withCheck('manchester-dubai', '2026-08-18', '2026-11-16'), BUILT)).toBeNull();
  });

  it('Manchester-Dubai: renders Emirates timings from the recorded 21 Oct check', () => {
    expect(route('manchester-dubai').verification?.verifiedDate).toBe('2026-10-21');
    const html = renderQuickAnswers(route('manchester-dubai'), BUILT);
    expect(html).toContain('7h 05m to 7h 50m');
    expect(html).toContain('7h 45m to 8h 10m back to Manchester');
    expect(html).toContain('21 flights per week');
    expect(html).not.toContain('8h direct');
  });

  it('withdraws the block if a route is re-verified with a check these answers were not written for', () => {
    expect(renderQuickAnswers(withCheck('manchester-islamabad', '2026-10-28', '2026-11-27'), BUILT)).toBe('');
  });

  it('withdraws the block after expiry', () => {
    expect(renderQuickAnswers(route('manchester-islamabad'), AFTER_MANCHESTER_REVIEWS)).toBe('');
  });

  it('carries no price', () => {
    for (const slug of ['manchester-islamabad', 'manchester-dubai', 'birmingham-delhi']) expect(renderQuickAnswers(route(slug), BUILT)).not.toContain('£');
  });
});
