import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { hasAnyObservationAmongRoutes } from '@/data/fare-observations';
import { getRoutesByAirport } from '@/data/routes';
import { hasCurrentFareSignalAmongRoutes } from '@/lib/fare-signal';
import AirportPage from '@/app/airports/[slug]/page';

/**
 * "Checked before" no-fare wording (3 November 2026). When every fare expired at once, the Glasgow, Edinburgh and Newcastle
 * airport pages said "We haven't logged a tracked fare … yet" although the archive holds their checks. Pages are rendered on
 * 3 November 2026, when those airports had no current fare; observations logged later are not publishable on that date, so
 * new data cannot change these results.
 */
const DAY = '2026-11-03';
const norm = (html: string) => html.replace(/&#x27;/g, "'").replace(/<!-- -->/g, '');

describe('NoFareFallback wording', () => {
  it('says it has checked before when the scope has logged checks', () => {
    const html = norm(renderToStaticMarkup(NoFareFallback({ cityLabel: 'Glasgow Airport', hasCheckedFaresBefore: true })));
    expect(html).toContain("JetStash has checked fares for Glasgow Airport before, but there isn't a current one we can safely show.");
    expect(html).not.toMatch(/haven't logged/);
  });

  it('keeps the "haven\'t logged" wording only when nothing was ever logged', () => {
    const html = norm(renderToStaticMarkup(NoFareFallback({ cityLabel: 'Liverpool John Lennon Airport' })));
    expect(html).toContain("We haven't logged a tracked fare for Liverpool John Lennon Airport yet.");
  });

  it('still prefers the "evidence on the route guides" wording when a current fare exists elsewhere', () => {
    const html = norm(renderToStaticMarkup(NoFareFallback({ cityLabel: 'Glasgow Airport', hasFareSignalElsewhere: true, hasCheckedFaresBefore: true })));
    expect(html).toMatch(/tracked fare evidence is available on the individual route guides/);
    expect(html).not.toMatch(/checked fares for/);
  });
});

describe('hasAnyObservationAmongRoutes', () => {
  it('is true for a scope with logged checks and false for routes with none', () => {
    expect(hasAnyObservationAmongRoutes(getRoutesByAirport('glasgow').map((r) => r.slug))).toBe(true);
    expect(hasAnyObservationAmongRoutes([])).toBe(false);
    expect(hasAnyObservationAmongRoutes(['not-a-real-route'])).toBe(false);
  });
});

describe('real airport pages with no current fare on 3 November 2026', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${DAY}T12:00:00.000Z`));
  });
  afterEach(() => vi.useRealTimers());

  it.each(['glasgow', 'edinburgh', 'newcastle'])('%s says it has checked before, never that nothing was logged', async (slug) => {
    const routeSlugs = getRoutesByAirport(slug).map((r) => r.slug);
    expect(hasCurrentFareSignalAmongRoutes(routeSlugs, DAY), slug).toBe(false);
    const html = norm(renderToStaticMarkup(await AirportPage({ params: Promise.resolve({ slug }) })));
    expect(html, slug).not.toMatch(/logged a tracked fare/);
    expect(html, slug).toMatch(/JetStash has checked fares for .+ before, but there isn't a current one we can safely show\./);
  });
});
