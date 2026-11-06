import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';

/**
 * Route-page PR B (November 2026): the Travel Ready Check moves below the fare history.
 *
 * The 6 November mobile audit measured the check (a five-field form, about 1,350px tall on a phone) sitting between the first-screen
 * fare card and the fare history, which pushed the fare evidence 3,200-6,500px down a 390px-wide page. Nothing about the check was
 * removed or reworded: it still renders in full, in its own section after the fare section, and one pointer line stays where it used
 * to be. These tests pin the new order, the preserved content, the anchors and the shared Book-By signal.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const pageSrc = read('app/routes/[slug]/page.tsx');
const panelSrc = read('components/route/route-readiness-panel.tsx');
const bookBySrc = read('components/route/book-by-countdown.tsx');
const checkSrc = read('components/travel-ready/travel-ready-check.tsx');

const render = async (slug: string) => renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
const CHECK_HEADING = 'Can you actually travel on these dates, with the documents you have?';
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('source order', () => {
  it('pointer line, then fare section (history and Route Watch), then the Travel Ready section, then the connecting alternative', () => {
    const pointer = pageSrc.indexOf('href="#travel-ready"');
    const fareHeading = pageSrc.indexOf('{fareSectionCopy.heading}');
    const routeWatch = pageSrc.indexOf('id="route-watch"');
    const section = pageSrc.indexOf('<section id="travel-ready"');
    const connecting = pageSrc.indexOf('canShowConnectingAlternative && route.connectingAlternative');
    for (const i of [pointer, fareHeading, routeWatch, section, connecting]) expect(i).toBeGreaterThan(-1);
    expect(pointer).toBeLessThan(fareHeading);
    expect(fareHeading).toBeLessThan(section);
    expect(routeWatch).toBeLessThan(section);
    expect(section).toBeLessThan(connecting);
  });

  it('the old position holds only the pointer: the Travel Ready Check component is no longer called before the fare section', () => {
    const fareHeading = pageSrc.indexOf('{fareSectionCopy.heading}');
    const slotCalls = [...pageSrc.matchAll(/<TravelReadySlot\b/g)].map((m) => m.index!);
    expect(slotCalls).toHaveLength(1);
    expect(slotCalls[0]).toBeGreaterThan(fareHeading);
    expect(pageSrc).not.toMatch(/<TravelReadyCheck\b/);
  });

  it('the Travel Ready Check component itself is untouched by this PR: still the same heading and a scope note', () => {
    expect(checkSrc).toContain(CHECK_HEADING);
    expect(checkSrc).toContain('A private readiness check, not a price check');
  });
});

describe('rendered pages', () => {
  it.each(['manchester-islamabad', 'manchester-doha', 'london-heathrow-dubai', 'manchester-delhi'])(
    '%s: fare history and Route Watch come before the Travel Ready Check, which renders in full exactly once',
    async (slug) => {
      const html = await render(slug);
      const section = html.indexOf('id="travel-ready"');
      expect(section, slug).toBeGreaterThan(-1);
      expect(count(html, CHECK_HEADING), slug).toBe(1);
      expect(html.indexOf('id="route-watch"'), slug).toBeGreaterThan(-1);
      expect(html.indexOf('id="route-watch"'), slug).toBeLessThan(section);
      const fareHistory = html.indexOf('id="fare-history"');
      if (fareHistory > -1) expect(fareHistory, slug).toBeLessThan(section);
      // the heading sits inside the moved section, not in the old position
      expect(html.indexOf(CHECK_HEADING), slug).toBeGreaterThan(section);
    }
  );

  it.each(['manchester-islamabad', 'manchester-doha'])('%s: the pointer line links to the section that exists, and appears before the fare evidence', async (slug) => {
    const html = await render(slug);
    expect(count(html, 'href="#travel-ready"'), slug).toBeGreaterThanOrEqual(1);
    expect(count(html, 'id="travel-ready"'), slug).toBe(1);
    expect(html.indexOf('href="#travel-ready"'), slug).toBeLessThan(html.indexOf('id="route-watch"'));
    expect(html).toContain('below the fare history');
  });

  it('a route whose country the check does not cover renders neither the check, the section, nor the pointer (unchanged behaviour)', async () => {
    const html = await render('manchester-barcelona');
    expect(html).not.toContain('id="travel-ready"');
    expect(html).not.toContain('href="#travel-ready"');
    expect(html).not.toContain(CHECK_HEADING);
  });

  it('every in-page anchor the route components use still has a target on the flagship page', async () => {
    const html = await render('manchester-islamabad');
    const hrefs = [...new Set([...html.matchAll(/href="#([A-Za-z0-9_-]+)"/g)].map((m) => m[1]))];
    expect(hrefs).toContain('travel-ready');
    for (const id of hrefs) expect(html, `#${id} has no target`).toContain(`id="${id}"`);
  });

  it('the Book-By panel stays above the fare section on the priority routes', async () => {
    const html = await render('manchester-islamabad');
    const bookBy = html.indexOf('When to book');
    expect(bookBy).toBeGreaterThan(-1);
    expect(bookBy).toBeLessThan(html.indexOf('id="fare-history"'));
  });
});

describe('Book-By still folds in the Travel Ready result, now across the page', () => {
  it('both slots use one shared context: TravelReadySlot publishes the signal, BookByPanel reads it', () => {
    expect(panelSrc).toContain('createContext');
    expect(panelSrc).toMatch(/onResult=\{shared\?\.setSignal\}/);
    expect(panelSrc).toMatch(/travelReadySignal=\{shared\?\.signal \?\? null\}/);
    expect(pageSrc).toMatch(/<RouteReadinessProvider>[\s\S]*<\/RouteReadinessProvider>/);
    expect(pageSrc.indexOf('<RouteReadinessProvider>')).toBeLessThan(pageSrc.indexOf('<BookByPanel'));
    expect(pageSrc.indexOf('</RouteReadinessProvider>')).toBeGreaterThan(pageSrc.indexOf('<TravelReadySlot'));
  });

  it('the slot still suppresses the duplicate inline Route Watch and passes the route\'s own destination and airport', () => {
    const call = panelSrc.match(/<TravelReadyCheck[\s\S]*?\/>/)![0];
    expect(call).toContain('defaultDestinationSlug={destinationSlug}');
    expect(call).toContain('airportSlugForCta={airportSlug}');
    expect(call).toContain('showInlineRouteWatch={false}');
  });

  it('when the check raises a note, Book-By points at the section instead of saying "see below"', () => {
    expect(bookBySrc).toContain('href="#travel-ready"');
    expect(bookBySrc).toContain("warningReasons.every((r) => r.source === 'travel-ready-check')");
    expect(bookBySrc).toContain("'see below before you book.'"); // route-warning notes keep their existing wording
  });
});
