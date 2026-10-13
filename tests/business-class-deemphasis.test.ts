import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { deals } from '@/data/deals';
import { hasPresentableBusinessFare, shouldRenderRouteDealCard } from '@/lib/business-class-presentation';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';

const NOW_ISO = '2026-09-11';

async function renderRouteAt(slug: string, day: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date(`${day}T12:00:00.000Z`));
    return renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
  } finally {
    vi.useRealTimers();
  }
}

describe('Business Class presentation guard', () => {
  it('keeps a dated, usable Business observation available', () => {
    const deal = deals.find((item) => item.id === 'man-khi-business');
    expect(deal).toBeDefined();
    expect(hasPresentableBusinessFare(deal!, NOW_ISO)).toBe(true);
  });

  it('does not give a self-transfer, three-stop Business itinerary a full-size premium card', () => {
    const deal = deals.find((item) => item.id === 'man-lhe-business');
    expect(deal).toBeDefined();
    expect(hasPresentableBusinessFare(deal!, NOW_ISO)).toBe(false);
    expect(shouldRenderRouteDealCard(deal!, NOW_ISO)).toBe(false);
  });

  it('keeps the poor Manchester→Lahore fare in history without rendering its separate promotional Business panel', async () => {
    const html = await renderRouteAt('manchester-lahore', NOW_ISO);
    expect(html).toContain('3,051');
    expect(html).not.toContain('Tracked Business fare');
  });

  it('withholds Lahore history once its route verification expires on 15 October', async () => {
    const valid = await renderRouteAt('manchester-lahore', '2026-10-14');
    expect(valid).toContain('3,051');
    expect(valid).not.toContain('Tracked Business fare');
    const expired = await renderRouteAt('manchester-lahore', '2026-10-15');
    expect(expired).not.toContain('3,051');
    expect(expired).not.toContain('Tracked Business fare');
    expect(expired).not.toContain('Fare spotted');
  });

  it('does not affect an Economy card on the same presentation path', () => {
    const deal = deals.find((item) => item.id === 'man-lhe-economy');
    expect(deal).toBeDefined();
    expect(shouldRenderRouteDealCard(deal!, NOW_ISO)).toBe(true);
  });
});

describe('Route-page priority remains answer-first', () => {
  // Journey Choice Round 1 closure (14 Sept 2026, founder-approved): the
  // manchester-islamabad pilot was retired from the live page — see
  // lib/journey-choice-route-adapter.ts's own doc comment — so the
  // answer-first position this test protects is now the route's own
  // Fare Signal, not Journey Choice. Its fare routing is separate from PIA service.
  it('no longer renders Journey Choice for MAN→ISB, and the Fare Check content takes the answer-first position instead', async () => {
    expect(getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)).toBeNull();
    const html = await renderRouteAt('manchester-islamabad', '2026-10-12');
    expect(html).not.toContain('Journey Choice');
    expect(html.indexOf('Fare spotted')).toBeGreaterThan(-1);
    expect(html.indexOf('id="route-watch"')).toBeGreaterThan(-1);
    expect(html.indexOf('Fare spotted')).toBeLessThan(html.indexOf('id="route-watch"'));
  });

  it('does not keep the positive fare panel after MAN→ISB verification expires', async () => {
    const html = await renderRouteAt('manchester-islamabad', '2026-10-13');
    expect(html).not.toContain('Fare spotted');
    expect(html).not.toContain('Journey Choice');
    const fallback = 'JetStash has checked this route before';
    expect(html.indexOf(fallback)).toBeGreaterThan(-1);
    expect(html.indexOf('id="route-watch"')).toBeGreaterThan(-1);
    expect(html.indexOf(fallback)).toBeLessThan(html.indexOf('id="route-watch"'));
  });

  it('preserves Manchester→Mumbai service-ended route status (Commercial Funnel Fix, 12 Sept 2026, allows a current-connecting Trip.com CTA — see tests/service-ended-commercial-funnel.test.ts)', async () => {
    const page = await RoutePage({ params: Promise.resolve({ slug: 'manchester-mumbai' }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain('Direct service ended');
  });
});
