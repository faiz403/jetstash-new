import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import TravelReadyCheckPage from '@/app/travel-ready-check/page';
import { TravelReadyCheck } from '@/components/travel-ready/travel-ready-check';
import {
  attachTravelReadyOpeners,
  isTravelReadyHash,
  isTravelReadyHref,
  type ClickEventLike,
  type DisclosureLike,
  type OpenerDocumentLike,
  type OpenerWindowLike,
} from '@/components/travel-ready/travel-ready-disclosure';
import { routes, getRoutesByDestination } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';

/**
 * Route-page PR E (November 2026, CEO-approved changes 1 and 2): shorten the page without removing anything.
 *  1. The Travel Ready Check sits behind a native <details> disclosure on route pages (the standalone /travel-ready-check page is unchanged).
 *  2. "Other UK airports" cards become compact rows with the same status label, route heading, service line and link.
 * Everything stays in the page; the check's state and Book-By's connection are unaffected by collapsing it.
 */
const TODAY = '2026-11-06';
const render = async (slug: string) => renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const text = (html: string) => plain(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const H2 = 'Can you actually travel on these dates, with the documents you have?';
const PAGE = 'https://jetstash.co.uk/routes/manchester-islamabad';

/** The pages that carry the check, derived from the data exactly as the route page derives it (the five Book-By priority routes always carry it). */
function carriesTravelReady(slug: string): boolean {
  const route = routes.find((r) => r.slug === slug)!;
  const dest = getDestinationBySlug(route.destinationSlug)!;
  return Boolean(computeBookBySnapshot(slug, new Date())) || TRAVEL_READY_SUPPORTED_COUNTRIES.includes(dest.country);
}

describe('route-page PR E', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('1. Travel Ready Check disclosure', () => {
    it('every route page that carries the check renders it inside exactly one CLOSED native details; pages that do not carry it are unchanged', async () => {
      let withCheck = 0;
      let without = 0;
      for (const route of routes) {
        const html = await render(route.slug);
        const expected = carriesTravelReady(route.slug);
        expect(html.includes('id="travel-ready"'), route.slug).toBe(expected);
        if (expected) {
          withCheck++;
          const mark = html.indexOf('data-travel-ready-disclosure');
          expect(mark, route.slug).toBeGreaterThan(-1);
          const tag = html.slice(html.lastIndexOf('<details', mark), html.indexOf('>', mark) + 1);
          expect(tag, route.slug).not.toMatch(/\sopen(?:=|\s|>)/); // closed by default
          expect(html.split('data-travel-ready-disclosure').length - 1, route.slug).toBe(1);
        } else {
          without++;
          expect(html, route.slug).not.toContain('data-travel-ready-disclosure');
          expect(html, route.slug).not.toContain(H2);
        }
      }
      expect(withCheck).toBeGreaterThan(0);
      expect(without).toBeGreaterThan(0);
    });

    it('the summary holds only phrasing content plus the h2 (HTML content model), carries the check\'s eyebrow, heading and scope line, and is a real summary', async () => {
      const html = await render('manchester-islamabad');
      const mark = html.indexOf('data-travel-ready-disclosure');
      const details = html.slice(mark, html.indexOf('</details>', mark));
      const summary = details.slice(details.indexOf('<summary'), details.indexOf('</summary>'));
      expect(summary).toContain('Travel Ready Check');
      expect(summary).toContain(`>${H2}</h2>`);
      expect(plain(summary)).toContain('A private readiness check, not a price check');
      expect(summary).toContain('Show the check');
      expect(summary).toContain('Hide the check');
      expect(summary).not.toMatch(/role=|tabindex=/); // native semantics, no ARIA overrides
      expect(summary).toMatch(/<svg[^>]*aria-hidden="true"/); // the chevron is decorative
      expect(summary).not.toMatch(/<(?:div|p|ul|ol|form|section)\b/); // no flow content inside the summary
      expect(html.split(`>${H2}<`).length - 1).toBe(1); // the heading appears exactly once on the page
    });

    it('collapsing changes only presentation: the text of the check is identical open or standalone, apart from the two toggle labels', () => {
      const plainCheck = renderToStaticMarkup(createElement(TravelReadyCheck, { defaultDestinationSlug: 'lahore', showInlineRouteWatch: false }));
      const collapsed = renderToStaticMarkup(createElement(TravelReadyCheck, { defaultDestinationSlug: 'lahore', showInlineRouteWatch: false, collapsible: true }));
      expect(plainCheck).not.toContain('<details');
      expect(collapsed).toContain('<details');
      expect(text(collapsed).replace('Show the check', '').replace('Hide the check', '').replace(/\s+/g, ' ')).toBe(text(plainCheck).replace(/\s+/g, ' '));
      // every control of the standalone check is present in the collapsed markup
      const ids = (h: string) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]).sort();
      expect(ids(collapsed)).toEqual(ids(plainCheck));
      expect(collapsed.match(/<input\b/g)?.length).toBe(plainCheck.match(/<input\b/g)?.length);
      expect(collapsed.match(/<select\b/g)?.length).toBe(plainCheck.match(/<select\b/g)?.length);
      expect(collapsed.match(/<button\b/g)?.length).toBe(plainCheck.match(/<button\b/g)?.length);
    });

    it('nothing is removed: every field, the scope note, the privacy sentence and the submit button are in the page while it is closed', async () => {
      const html = plain(await render('manchester-islamabad'));
      const after = html.slice(html.indexOf('data-travel-ready-disclosure'));
      for (const id of ['ready-destination', 'ready-departure', 'ready-arrival', 'ready-return', 'ready-passport-expiry']) expect(after, id).toContain(`id="${id}"`);
      expect(after).toContain('Check my travel readiness');
      expect(after).toContain("We don't ask for or store passport numbers, dates of birth, or any other document details");
      expect(after).toContain('Currently covers Pakistan, India, Bangladesh, Saudi Arabia, UAE, Qatar, Turkey and Morocco only');
    });

    it('the section keeps id="travel-ready" OUTSIDE the details (so every fragment still resolves), and the pointer and Book-By links are unchanged', async () => {
      const html = await render('manchester-islamabad');
      const sectionIdx = html.indexOf('<section id="travel-ready"');
      expect(sectionIdx).toBeGreaterThan(-1);
      expect(html.indexOf('data-travel-ready-disclosure')).toBeGreaterThan(sectionIdx);
      expect(html).toContain('href="#travel-ready"');
      expect(read('components/route/book-by-countdown.tsx')).toContain('href="#travel-ready"');
      expect(read('app/routes/[slug]/page.tsx')).toContain('href="#travel-ready"');
    });

    it('the standalone /travel-ready-check page is unchanged: the full check, no disclosure', async () => {
      const html = renderToStaticMarkup(await TravelReadyCheckPage({ searchParams: Promise.resolve({}) }));
      expect(html).not.toContain('data-travel-ready-disclosure');
      expect(html).not.toContain('<details');
      expect(html).toContain(`>${H2}<`);
      expect(html).toContain('id="ready-destination"');
      expect(html).toContain('<div class="flex items-center gap-2.5">'); // the original eyebrow div and scope p are kept
      expect(html).toMatch(/<p class="mt-2 max-w-2xl text-sm text-ink-500">A private readiness check/);
    });

    it('the route page passes collapsible only through TravelReadySlot, and the shared signal to Book-By is still wired', () => {
      const slot = read('components/route/route-readiness-panel.tsx');
      expect(slot).toMatch(/onResult=\{shared\?\.setSignal\}\s*collapsible/);
      expect(slot).toContain('travelReadySignal={shared?.signal ?? null}');
      const check = read('components/travel-ready/travel-ready-check.tsx');
      expect(check).toContain('collapsible = false'); // default off
      expect(check).toMatch(/<TravelReadyDisclosure summary=\{heading\}>\{body\}<\/TravelReadyDisclosure>/);
    });

    describe('opening behaviour (executed against a minimal fake window and document)', () => {
      type Listener = (event?: never) => void;
      function setup(hash: string, href = PAGE + hash) {
        const details: DisclosureLike = { open: false };
        const hashListeners: Listener[] = [];
        const clickListeners: ((e: ClickEventLike) => void)[] = [];
        const captures: boolean[] = [];
        const win: OpenerWindowLike & { location: { hash: string; href: string } } = {
          location: { hash, href },
          addEventListener: (_t, l) => void hashListeners.push(l as Listener),
          removeEventListener: (_t, l) => void hashListeners.splice(hashListeners.indexOf(l as Listener), 1),
        };
        const doc: OpenerDocumentLike = {
          addEventListener: (_t, l, capture) => { clickListeners.push(l); captures.push(capture); },
          removeEventListener: (_t, l) => void clickListeners.splice(clickListeners.indexOf(l), 1),
        };
        const cleanup = attachTravelReadyOpeners(() => details, win, doc);
        const link = (href: string | null, extra: Partial<ClickEventLike> = {}): ClickEventLike => ({ target: { closest: () => (href === null ? null : { getAttribute: () => href }) }, button: 0, ...extra });
        const click = (e: ClickEventLike) => clickListeners.forEach((l) => l(e));
        return { details, win, hashListeners, clickListeners, captures, cleanup, link, click };
      }

      it('opens on mount when the URL carries the fragment, and stays closed otherwise', () => {
        expect(setup('#travel-ready').details.open).toBe(true);
        expect(setup('').details.open).toBe(false);
        expect(setup('#route-watch').details.open).toBe(false);
      });

      it('opens on a hashchange to the fragment but not to another one', () => {
        const s = setup('');
        s.win.location.hash = '#route-watch'; s.hashListeners.forEach((l) => l());
        expect(s.details.open).toBe(false);
        s.win.location.hash = '#travel-ready'; s.hashListeners.forEach((l) => l());
        expect(s.details.open).toBe(true);
      });

      it('opens on a plain click on an in-page link to the section, including a second click when the hash is already set, in the capture phase', () => {
        const s = setup('#travel-ready');
        expect(s.captures).toEqual([true]);
        s.details.open = false; // the visitor closed it; the hash is unchanged
        s.click(s.link('#travel-ready'));
        expect(s.details.open).toBe(true);
        const t = setup('');
        t.click(t.link('/routes/manchester-islamabad#travel-ready')); // same-page path form
        expect(t.details.open).toBe(true);
      });

      it('does NOT open for another page\'s fragment, an external link, an unrelated link, a modified click, a non-primary click or a prevented click', () => {
        const s = setup('');
        for (const href of ['/another-page#travel-ready', 'https://example.org/#travel-ready', '#route-watch', '/travel-ready-check', null]) {
          s.click(s.link(href));
          expect(s.details.open, String(href)).toBe(false);
        }
        for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }] as Partial<ClickEventLike>[]) {
          s.click(s.link('#travel-ready', extra));
          expect(s.details.open, JSON.stringify(extra)).toBe(false);
        }
      });

      it('never closes it, and its cleanup removes both listeners', () => {
        const s = setup('#travel-ready');
        s.click(s.link('#route-watch'));
        s.hashListeners.forEach((l) => l());
        expect(s.details.open).toBe(true); // nothing the opener does can close it
        s.cleanup();
        expect(s.hashListeners).toHaveLength(0);
        expect(s.clickListeners).toHaveLength(0);
        const code = read('components/travel-ready/travel-ready-disclosure.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toMatch(/\.open\s*=\s*false/);
        expect(code).not.toMatch(/history\.(push|replace)State|preventDefault\(/); // browser history and navigation are left alone
      });

      it('recognises the fragment and same-page links, and nothing else', () => {
        expect(isTravelReadyHash('#travel-ready')).toBe(true);
        expect(isTravelReadyHash('#travel-ready-extra')).toBe(false);
        expect(isTravelReadyHash('')).toBe(false);
        expect(isTravelReadyHref('#travel-ready', PAGE)).toBe(true);
        expect(isTravelReadyHref(`${PAGE}#travel-ready`, PAGE)).toBe(true);
        expect(isTravelReadyHref('/routes/manchester-islamabad#travel-ready', PAGE)).toBe(true);
        expect(isTravelReadyHref(`${PAGE}?x=1#travel-ready`, PAGE)).toBe(false); // different query
        expect(isTravelReadyHref('/routes/manchester-lahore#travel-ready', PAGE)).toBe(false);
        expect(isTravelReadyHref('http://[bad', PAGE)).toBe(false);
        expect(isTravelReadyHref('', PAGE)).toBe(false);
        expect(isTravelReadyHref(undefined, PAGE)).toBe(false);
      });
    });
  });

  describe('2. Other UK airports as compact rows', () => {
    it('every route page with alternatives renders a list with one row per alternative route, keeping each row\'s status, heading, link and service line', async () => {
      let pages = 0;
      let expectedPages = 0;
      for (const route of routes) {
        const dest = getDestinationBySlug(route.destinationSlug)!;
        const alternatives = getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug && getAirportBySlug(r.airportSlug));
        const html = plain(await render(route.slug));
        if (alternatives.length === 0) {
          expect(html, route.slug).not.toContain(`Other UK airports for ${dest.city}`);
          continue;
        }
        expectedPages++;
        pages++;
        const start = html.indexOf(`Other UK airports for ${dest.city}`);
        expect(start, route.slug).toBeGreaterThan(-1);
        const section = html.slice(start, html.indexOf('</section>', start));
        const rows = section.split('<li>').slice(1);
        expect(rows.length, route.slug).toBe(alternatives.length);
        for (const alt of alternatives) {
          const airport = getAirportBySlug(alt.airportSlug)!;
          const row = rows.find((r) => r.includes(`href="/routes/${alt.slug}"`));
          expect(row, `${route.slug} -> ${alt.slug} row`).toBeTruthy();
          const p = getEffectiveRoutePresentation(alt, routeStatusEvents, TODAY);
          expect(row, `${route.slug} -> ${alt.slug} heading`).toContain(`${airport.city} → ${dest.city}</h3>`);
          expect(row, `${route.slug} -> ${alt.slug} status`).toContain(p.statusLabel);
          expect(row, `${route.slug} -> ${alt.slug} link text`).toContain('Compare this route'); // visible from sm up, always in the accessible name
          // the service line, per status, within THIS row
          if (p.status === 'unverified') expect(row).toContain('Verification in progress — check directly before booking');
          else if (p.status === 'service-ended') expect(row).toContain('Direct service ended — check current options before booking');
          else expect(row, `${route.slug} -> ${alt.slug} service line`).toContain(p.flightTime);
        }
      }
      expect(pages).toBe(expectedPages);
      expect(pages).toBeGreaterThan(0);
    });

    it('every service-line branch (unverified, service ended, verified) is exercised by real pages', async () => {
      const seen = { unverified: false, ended: false, verified: false };
      for (const route of routes) {
        const dest = getDestinationBySlug(route.destinationSlug)!;
        for (const alt of getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug)) {
          const status = getEffectiveRoutePresentation(alt, routeStatusEvents, TODAY).status;
          if (status === 'unverified') seen.unverified = true;
          else if (status === 'service-ended') seen.ended = true;
          else if (status === 'direct' || status === 'connecting') seen.verified = true;
        }
      }
      expect(seen).toEqual({ unverified: true, ended: true, verified: true });
    });

    it('the row is one link with a decorative arrow in a list for assistive technology, and keeps the card look from sm up', async () => {
      const html = await render('london-heathrow-dubai');
      const section = html.slice(html.indexOf('Other UK airports for Dubai'));
      expect(section).toContain('<ul role="list" class="');
      expect(section).toMatch(/<li><a [^>]*href="\/routes\/[^"]+"/);
      expect(section).toContain('sr-only sm:not-sr-only'); // the words stay available to screen readers on a phone
      expect(section).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(section).toContain('sm:rounded-md sm:border'); // card treatment is kept from sm up
      expect(section).not.toContain('grid gap-5 sm:grid-cols-2 lg:grid-cols-3"'); // the old card grid container is gone
      const row = section.slice(section.indexOf('<li>'), section.indexOf('</li>'));
      expect(row).not.toMatch(/<span class="min-w-0">/); // block content (h3, p) is not wrapped in a span inside the link
      expect(row).toMatch(/<div class="min-w-0">[\s\S]*<h3[\s\S]*<p[\s\S]*<\/div>/);
    });
  });

  describe('SEO and content integrity', () => {
    it('the three SEO pilot pages keep exactly one h1, the Travel Ready heading exactly once, the airports heading, and Islamabad keeps its Quick answers', async () => {
      for (const slug of ['manchester-islamabad', 'manchester-dubai', 'birmingham-delhi']) {
        const html = await render(slug);
        const headings = [...html.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => plain(m[2].replace(/<[^>]+>/g, '')).trim());
        expect(headings.filter((h) => h === H2), slug).toHaveLength(1);
        expect(headings.some((h) => h.startsWith('Other UK airports for')), slug).toBe(true);
        expect((html.match(/<h1\b/g) || []).length, slug).toBe(1);
      }
      expect(plain(await render('manchester-islamabad'))).toContain('quick answers');
    });

    it('the only text a route page gains is the two toggle labels (the check\'s own text is unchanged)', async () => {
      const html = await render('manchester-islamabad');
      const mark = html.indexOf('data-travel-ready-disclosure');
      const withLabels = text(html.slice(mark, html.indexOf('</details>', mark)));
      expect(withLabels).toContain('Show the check');
      expect(withLabels).toContain('Hide the check');
      expect(read('app/routes/[slug]/page.tsx')).not.toMatch(/generateMetadata[\s\S]{0,200}Show the check/);
    });
  });
});
