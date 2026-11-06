import { createElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { FareSignal, firstScreenStatesConnectingFare } from '@/components/route/fare-signal';
import { DealCard } from '@/components/ui/deal-card';
import { deals } from '@/data/deals';
import { routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import {
  ENDED_SERVICE_FARE_CARD_LEAD,
  getFlightTimeDisplay,
  getRouteHeroBadgeLabel,
  shouldShowRouteHeroBadge,
} from '@/lib/route-first-screen-copy';

/**
 * Route-page PR D (November 2026, CEO-approved): first-screen action clarity and duplication.
 *  1. A "not verified" / "varies" flight-time sentence is no longer a hero line (it is still the Flight time row in the route facts).
 *  2. A service-ended hero no longer shows a badge that repeats its own "Direct service ended" status line.
 *  3. The first-screen fare card no longer carries a separate "Connecting fare, not nonstop" pill: the "· connecting" qualifier on the price
 *     line, the routing line and the Route service explanation already say it.
 *  4. The fare section's card on the same page no longer repeats that explanation word for word (it keeps its pill and its dated evidence).
 *  5. The airline, cabin and checked date read as one line on a phone.
 *  6. The ended-service fare card no longer restates the ending a third time.
 * Presentation only: no price, airline, observed date, route status, verification, fare classification or Trip.com behaviour changes.
 */
const TODAY = '2026-11-06';
const render = async (slug: string) => renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const EXPLANATION = 'Nonstop services are listed for this route, but this tracked fare is for a connecting journey. It is not a nonstop fare.';
const heroOf = (html: string) => html.slice(0, html.indexOf('id="fare-signal-heading"'));
const fareCardOf = (html: string) => {
  const start = html.indexOf('id="fare-signal-heading"');
  return html.slice(start, html.indexOf('</section>', start));
};

describe('route-page PR D', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true'); // Production runs with the Trip.com pause on
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('1. hero flight-time line', () => {
    it('a replaced value has no hero line but keeps its row value; a verified duration keeps its hero line', () => {
      const replaced = getFlightTimeDisplay('Direct; check PIA for the scheduled duration');
      expect(replaced.heroLine).toBeNull();
      expect(replaced.rowValue).toBe("Typical flight time not verified. Check the airline's current schedule.");
      expect(replaced.replaced).toBe(true);
      const kept = getFlightTimeDisplay('8h 45m direct');
      expect(kept).toEqual({ heroLine: 'Typical flight time: 8h 45m direct', rowValue: '8h 45m direct', replaced: false });
    });

    it('every direct or connecting page: a replaced value is absent from the hero and present in the route facts; a duration stays in both', async () => {
      let replacedPages = 0;
      let durationPages = 0;
      for (const route of routes) {
        const p = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
        if (p.status !== 'direct' && p.status !== 'connecting') continue;
        const d = getFlightTimeDisplay(p.flightTime);
        const html = await render(route.slug);
        const hero = plain(heroOf(html));
        const rest = plain(html.slice(heroOf(html).length));
        if (d.replaced) {
          replacedPages++;
          expect(hero, route.slug).not.toContain(d.rowValue);
          expect(hero, route.slug).not.toContain('Typical flight time');
          expect(rest, route.slug).toContain(d.rowValue);
        } else {
          durationPages++;
          expect(hero, route.slug).toContain(d.heroLine!);
          expect(rest, route.slug).toContain(d.rowValue);
        }
      }
      expect(replacedPages).toBeGreaterThanOrEqual(14);
      expect(durationPages).toBeGreaterThan(15);
    });
  });

  describe('2. service-ended hero badge', () => {
    it('the badge helper hides the badge only for a service-ended route', () => {
      expect(shouldShowRouteHeroBadge('service-ended')).toBe(false);
      for (const s of ['direct', 'connecting', 'unverified', 'unspecified']) expect(shouldShowRouteHeroBadge(s), s).toBe(true);
      expect(getRouteHeroBadgeLabel('direct', 'Direct')).toBe('Direct service'); // PR C wording unchanged
    });

    it.each(['manchester-delhi', 'manchester-mumbai'])('%s: the status is stated once in the hero, with the approved heading and supporting text', async (slug) => {
      const hero = heroOf(await render(slug));
      expect(hero.split('Direct service ended').length - 1).toBe(1);
      expect(hero).toContain('The former nonstop service has ended. Connecting alternatives may be available. Check current flights, stops and total journey times for your dates before booking.');
      expect(hero).not.toMatch(/Usually \d stop|12 to 15h|Connecting flights available/);
    });

    it('every other page keeps its hero badge', async () => {
      for (const route of routes) {
        const p = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
        if (p.status === 'service-ended') continue;
        const hero = heroOf(await render(route.slug));
        expect(plain(hero), route.slug).toContain(`>${getRouteHeroBadgeLabel(p.status, p.statusLabel)}<`);
      }
    });
  });

  describe('3 and 4. the connecting-fare explanation', () => {
    it('no first-screen fare card carries the separate pill; the explanation, qualifier and routing line stay on every qualifying page', async () => {
      let qualifying = 0;
      for (const route of routes) {
        const html = await render(route.slug);
        const card = fareCardOf(html);
        expect(card, route.slug).not.toContain('Connecting fare, not nonstop');
        if (card.includes('· connecting</span>')) {
          qualifying++;
          expect(card, route.slug).toContain(EXPLANATION);
          expect(card, route.slug).toContain('Route service');
          expect(card, route.slug).toMatch(/Connecting (?:outbound|·|return)|stops? each way|stop outbound/);
        }
      }
      expect(qualifying).toBeGreaterThanOrEqual(10);
    });

    it('the fare section card on the same page keeps its pill and dated evidence but not the repeated sentence', async () => {
      const html = await render('manchester-islamabad');
      expect(html.split(EXPLANATION).length - 1).toBe(1);
      const afterCard = html.slice(html.indexOf('id="fare-history"'));
      expect(afterCard).toContain('Connecting fare, not nonstop');
      expect(afterCard).toContain('Fare checked with Saudia');
      expect(afterCard).toContain('Travel 29 December 2026');
      expect(afterCard).toContain('>Connecting<'); // the card's own top-right badge
    });

    it('DealCard: the sentence is dropped only when the page says it is already shown, and only for a direct route with a connecting fare', () => {
      const deal = deals.find((d) => d.id === 'man-dxb-economy')!;
      const normal = renderToStaticMarkup(DealCard({ deal, nowIso: '2026-10-20' }));
      const dropped = renderToStaticMarkup(DealCard({ deal, nowIso: '2026-10-20', connectingExplanationShownAbove: true }));
      expect(normal).toContain(EXPLANATION);
      expect(normal).toContain('Connecting fare, not nonstop');
      expect(dropped).not.toContain(EXPLANATION);
      expect(dropped).toContain('Connecting fare, not nonstop');
      // a card with no mismatch is identical either way
      const plainDeal = deals.find((d) => !renderToStaticMarkup(DealCard({ deal: d, nowIso: '2026-10-20' })).includes('Connecting fare, not nonstop'))!;
      expect(renderToStaticMarkup(DealCard({ deal: plainDeal, nowIso: '2026-10-20', connectingExplanationShownAbove: true }))).toBe(
        renderToStaticMarkup(DealCard({ deal: plainDeal, nowIso: '2026-10-20' }))
      );
    });

    it('the page flag is true only where the first-screen card states the explanation (explicit fixtures, including the fallback cases)', () => {
      const obs = (directness: 'direct' | 'connecting' | null) => ({ directness });
      const cases: [string, string, 'current' | 'recent' | 'none', 'direct' | 'connecting' | null | 'no-observation', boolean][] = [
        ['direct route, connecting fare, current', 'direct', 'current', 'connecting', true],
        ['direct route, connecting fare, recent', 'direct', 'recent', 'connecting', true],
        ['direct route, no first-screen fare (state none): the lower card keeps its sentence', 'direct', 'none', 'connecting', false],
        ['direct route, observation missing', 'direct', 'current', 'no-observation', false],
        ['direct route, direct fare: nothing to explain', 'direct', 'current', 'direct', false],
        ['direct route, fare directness unknown', 'direct', 'current', null, false],
        ['connecting route, connecting fare', 'connecting', 'current', 'connecting', false],
        ['connecting route, direct fare (its own explanation, not this one)', 'connecting', 'current', 'direct', false],
        ['service-ended route', 'service-ended', 'current', 'connecting', false],
        ['unverified route', 'unverified', 'current', 'connecting', false],
      ];
      for (const [label, status, state, directness, expected] of cases) {
        const signal = { state, observation: directness === 'no-observation' ? null : obs(directness) };
        expect(firstScreenStatesConnectingFare(status, signal), label).toBe(expected);
      }
    });

    it('a "last tracked fare" (recent) first-screen card keeps the qualifier and the explanation, with no separate pill', () => {
      const live = getFareSignalForRoute('manchester-islamabad', TODAY);
      expect(live.observation).toBeTruthy();
      const html = renderToStaticMarkup(
        createElement(FareSignal, {
          signal: { ...live, state: 'recent' },
          nowIso: TODAY,
          tripComUrl: null,
          routeSlug: 'manchester-islamabad',
          routeDirectness: 'direct',
          routeStatusLabel: 'Direct',
          routeAirlineLabel: 'PIA',
        })
      );
      expect(html).toContain('Last tracked fare');
      expect(html).toMatch(/return<span[^>]*>· connecting<\/span>/);
      expect(html).toContain(EXPLANATION);
      expect(html).toContain('Route service');
      expect(html).not.toContain('Connecting fare, not nonstop');
    });

    it('on every real page, a lower card pill is accompanied by the explanation exactly once on the page (the fallback itself is covered by the fixtures above)', async () => {
      for (const route of routes) {
        const html = await render(route.slug);
        const card = fareCardOf(html);
        const after = html.slice(html.indexOf('id="fare-signal-heading"') + card.length);
        // whenever a lower card shows the pill, the explanation is on the page exactly once: in the first-screen card or in that card
        if (after.includes('Connecting fare, not nonstop')) expect(html.split(EXPLANATION).length - 1, route.slug).toBe(1);
      }
    });
  });

  describe('5. airline, cabin and checked date on one line', () => {
    it('stay in one paragraph on a phone and split from sm up, with every word unchanged', async () => {
      const card = fareCardOf(await render('manchester-islamabad'));
      expect(card).toContain('Saudia · Economy<span class="sm:hidden"> · </span><span class="sm:mt-1 sm:block">Checked 3 November 2026</span>');
    });
  });

  describe('6. ended-service fare card', () => {
    it.each(['manchester-delhi', 'manchester-mumbai'])('%s: leads with what the card adds, keeps the Google action and note, and never restates the ending', async (slug) => {
      const card = fareCardOf(await render(slug));
      expect(card).toContain('Find connecting alternatives');
      expect(card).toContain(ENDED_SERVICE_FARE_CARD_LEAD);
      expect(card).toContain('Search connecting flights on Google Flights');
      expect(card).toContain('It does not fill in your search: enter your airports and travel dates there.');
      expect(card).not.toContain('The former nonstop service on this route has ended.');
    });
  });

  describe('fare evidence is preserved on every page', () => {
    it('every current fare keeps its price, airline, cabin, checked date and travel dates; the "Fare spotted" count equals the number of current signals', async () => {
      let current = 0;
      let spotted = 0;
      for (const route of routes) {
        const signal = getFareSignalForRoute(route.slug, TODAY);
        const card = plain(fareCardOf(await render(route.slug)));
        if (card.includes('Fare spotted') || card.includes('Standout Fare')) spotted++;
        if (signal.state === 'current' && signal.observation) {
          current++;
          const o = signal.observation;
          expect(card, route.slug).toContain(`£${o.price.toLocaleString('en-GB')} return`);
          expect(card, route.slug).toContain(`${o.airline} · ${o.cabin}`);
          expect(card, route.slug).toMatch(/Checked \d{1,2} [A-Z][a-z]+ \d{4}/);
        }
      }
      expect(spotted).toBe(current);
      expect(current).toBeGreaterThan(15);
    });

    it('the Trip.com pause stays on: no Trip.com text on any route page', async () => {
      for (const route of routes) expect(await render(route.slug), route.slug).not.toMatch(/Trip\.com/);
    });
  });
});
