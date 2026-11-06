import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import TravelReadyCheckPage from '@/app/travel-ready-check/page';
import { isTravelReadyHash, isTravelReadyHref } from '@/components/travel-ready/travel-ready-disclosure';
import { getRouteBySlug, routes, getRoutesByDestination } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';

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
const H2 = 'Can you actually travel on these dates, with the documents you have?';

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
    it('every route page that carries the check renders it inside a CLOSED native details; pages that do not carry it are unchanged', async () => {
      let withCheck = 0;
      let without = 0;
      for (const route of routes) {
        const dest = getDestinationBySlug(route.destinationSlug)!;
        const html = await render(route.slug);
        const has = html.includes('id="travel-ready"');
        if (has) {
          withCheck++;
          const start = html.indexOf('<details');
          expect(start, route.slug).toBeGreaterThan(-1);
          const tag = html.slice(html.lastIndexOf('<details', html.indexOf('data-travel-ready-disclosure')), html.indexOf('>', html.indexOf('data-travel-ready-disclosure')) + 1);
          expect(tag, route.slug).toContain('data-travel-ready-disclosure');
          expect(tag, route.slug).not.toMatch(/\sopen(?:=|\s|>)/); // closed by default
          expect(html.split('data-travel-ready-disclosure').length - 1, route.slug).toBe(1);
        } else {
          without++;
          expect(html, route.slug).not.toContain('data-travel-ready-disclosure');
          expect(html, route.slug).not.toContain(H2);
          expect(TRAVEL_READY_SUPPORTED_COUNTRIES.includes(dest.country), route.slug).toBe(false);
        }
      }
      expect(withCheck).toBe(72);
      expect(without).toBe(17);
    });

    it('the summary carries the check\'s own eyebrow, heading and scope line (so the heading, outline and wording are unchanged) and a real <summary> button', async () => {
      const html = await render('manchester-islamabad');
      const mark = html.indexOf('data-travel-ready-disclosure'); // other details elements exist on the page (fare history)
      const details = html.slice(mark, html.indexOf('</details>', mark));
      const summary = details.slice(details.indexOf('<summary'), details.indexOf('</summary>'));
      expect(summary).toContain('Travel Ready Check');
      expect(summary).toContain(`>${H2}</h2>`);
      expect(summary).toMatch(/<h2 /);
      expect(plain(summary)).toContain('A private readiness check, not a price check');
      expect(summary).toContain('Show the check');
      expect(summary).toContain('Hide the check');
      expect(summary).not.toMatch(/role=|tabindex=/); // native semantics, no ARIA overrides
      expect(summary).toMatch(/<svg[^>]*aria-hidden="true"/); // the chevron is decorative
      expect(html.split(`>${H2}<`).length - 1).toBe(1); // the heading appears exactly once
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
    });

    it('the route page passes collapsible only through TravelReadySlot, and the shared signal to Book-By is still wired', () => {
      const slot = read('components/route/route-readiness-panel.tsx');
      expect(slot).toMatch(/onResult=\{shared\?\.setSignal\}\s*collapsible/);
      expect(slot).toContain('travelReadySignal={shared?.signal ?? null}');
      const check = read('components/travel-ready/travel-ready-check.tsx');
      expect(check).toContain('collapsible = false'); // default off
      // the check's state lives in TravelReadyCheck itself, rendered inside the details even when closed: the details element only wraps it
      expect(check).toMatch(/<TravelReadyDisclosure summary=\{heading\}>\{body\}<\/TravelReadyDisclosure>/);
    });

    describe('opening behaviour (pure helpers and source contract)', () => {
      it('recognises the fragment and in-page links, and nothing else', () => {
        expect(isTravelReadyHash('#travel-ready')).toBe(true);
        expect(isTravelReadyHash('')).toBe(false);
        expect(isTravelReadyHash('#route-watch')).toBe(false);
        expect(isTravelReadyHash('#travel-ready-extra')).toBe(false);
        expect(isTravelReadyHref('#travel-ready')).toBe(true);
        expect(isTravelReadyHref('/routes/manchester-islamabad#travel-ready')).toBe(true);
        expect(isTravelReadyHref('#route-watch')).toBe(false);
        expect(isTravelReadyHref('/travel-ready-check')).toBe(false);
        expect(isTravelReadyHref(null)).toBe(false);
      });

      it('opens on mount, on hashchange and on a click in the capture phase; never closes by itself; cleans up its listeners', () => {
        const src = read('components/travel-ready/travel-ready-disclosure.tsx');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).toContain('openIfTargeted();'); // on mount: a direct URL fragment
        expect(code).toContain("window.addEventListener('hashchange', openIfTargeted)");
        expect(code).toContain("document.addEventListener('click', onClick, true)"); // capture, so a second click on the same hash still opens it
        expect(code).toContain("window.removeEventListener('hashchange', openIfTargeted)");
        expect(code).toContain("document.removeEventListener('click', onClick, true)");
        expect(code).toContain('ref.current.open = true');
        expect(code).not.toMatch(/\.open\s*=\s*false/);
        expect(code).not.toMatch(/history\.(push|replace)State|preventDefault/); // browser history and navigation are left alone
      });
    });

  });

  describe('2. Other UK airports as compact rows', () => {
    it('every route page with alternatives renders a list with one row per alternative route, keeping status, heading, service line and link', async () => {
      let pages = 0;
      for (const route of routes) {
        const dest = getDestinationBySlug(route.destinationSlug)!;
        const alternatives = getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug);
        const html = plain(await render(route.slug));
        if (alternatives.length === 0) {
          expect(html, route.slug).not.toContain(`Other UK airports for ${dest.city}`);
          continue;
        }
        pages++;
        const start = html.indexOf(`Other UK airports for ${dest.city}`);
        expect(start, route.slug).toBeGreaterThan(-1);
        const section = html.slice(start, html.indexOf('</section>', start));
        expect(section.split('<li>').length - 1, route.slug).toBe(alternatives.filter((r) => getAirportBySlug(r.airportSlug)).length);
        for (const alt of alternatives) {
          const airport = getAirportBySlug(alt.airportSlug);
          if (!airport) continue;
          const p = getEffectiveRoutePresentation(alt, routeStatusEvents, TODAY);
          expect(section, `${route.slug} -> ${alt.slug} link`).toContain(`href="/routes/${alt.slug}"`);
          expect(section, `${route.slug} -> ${alt.slug} heading`).toContain(`${airport.city} → ${dest.city}</h3>`);
          expect(section, `${route.slug} -> ${alt.slug} status`).toContain(p.statusLabel);
          expect(section, `${route.slug} -> ${alt.slug} link text`).toContain('Compare this route'); // visible from sm up, always in the accessible name
        }
        expect(section, route.slug).toContain('<ul');
      }
      expect(pages).toBeGreaterThan(60);
    });

    it('route status and service wording are exactly as before for unverified, service-ended and verified alternatives', async () => {
      // Mumbai lists Manchester-Delhi (service ended); find pages exercising each branch from real data instead of hard-coding
      const seen = { unverified: false, ended: false, verified: false };
      for (const route of routes) {
        const dest = getDestinationBySlug(route.destinationSlug)!;
        const alternatives = getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug);
        if (alternatives.length === 0) continue;
        const html = plain(await render(route.slug));
        const section = html.slice(html.indexOf(`Other UK airports for ${dest.city}`));
        for (const alt of alternatives) {
          const p = getEffectiveRoutePresentation(alt, routeStatusEvents, TODAY);
          if (p.status === 'unverified') { expect(section).toContain('Verification in progress — check directly before booking'); seen.unverified = true; }
          if (p.status === 'service-ended') { expect(section).toContain('Direct service ended — check current options before booking'); seen.ended = true; }
          if (p.status === 'direct' || p.status === 'connecting') { expect(section).toContain(p.flightTime); seen.verified = true; }
        }
      }
      expect(seen).toEqual({ unverified: true, ended: true, verified: true });
    });

    it('the row is one link with a decorative arrow, a list for assistive technology, and keeps the card look from sm up', async () => {
      const html = await render('london-heathrow-dubai');
      const section = html.slice(html.indexOf('Other UK airports for Dubai'));
      expect(section).toContain('<ul class="');
      expect(section).toMatch(/<li><a [^>]*href="\/routes\/[^"]+"/);
      expect(section).toContain('sr-only sm:not-sr-only'); // the words stay available to screen readers on a phone
      expect(section).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(section).toContain('sm:rounded-md sm:border'); // card treatment is kept from sm up
      expect(section).not.toContain('grid gap-5 sm:grid-cols-2 lg:grid-cols-3"'); // the old card grid container is gone
    });
  });

  describe('SEO and content integrity', () => {
    it('the three SEO pilot pages keep their headings, Quick answers, title and the Travel Ready heading exactly once', async () => {
      for (const slug of ['manchester-islamabad', 'manchester-dubai', 'birmingham-delhi']) {
        const route = getRouteBySlug(slug)!;
        const html = await render(slug);
        const headings = [...html.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => plain(m[2].replace(/<[^>]+>/g, '')).trim());
        expect(headings.filter((h) => h === H2), slug).toHaveLength(1);
        expect(headings.some((h) => h.startsWith('Other UK airports for')), slug).toBe(true);
        expect((html.match(/<h1\b/g) || []).length, slug).toBe(1);
        expect(route.slug).toBe(slug);
      }
      const islamabad = await render('manchester-islamabad');
      expect(plain(islamabad)).toContain('quick answers');
    });
  });
});
