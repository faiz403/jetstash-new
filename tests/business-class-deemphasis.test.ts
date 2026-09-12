import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { deals } from '@/data/deals';
import { hasPresentableBusinessFare, shouldRenderRouteDealCard } from '@/lib/business-class-presentation';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';

const NOW_ISO = '2026-09-11';

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
    const page = await RoutePage({ params: Promise.resolve({ slug: 'manchester-lahore' }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain('3,051');
    expect(html).not.toContain('Tracked Business fare');
  });

  it('does not affect an Economy card on the same presentation path', () => {
    const deal = deals.find((item) => item.id === 'man-lhe-economy');
    expect(deal).toBeDefined();
    expect(shouldRenderRouteDealCard(deal!, NOW_ISO)).toBe(true);
  });
});

describe('Route-page priority remains answer-first', () => {
  it('keeps MAN→ISB Journey Choice available and renders it ahead of lower fare-card content', async () => {
    expect(getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)).not.toBeNull();
    const page = await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) });
    const html = renderToStaticMarkup(page);
    expect(html.indexOf('Journey Choice')).toBeGreaterThan(-1);
    expect(html.indexOf('Journey Choice')).toBeLessThan(html.indexOf('id="route-watch"'));
  });

  it('preserves Manchester→Mumbai service-ended route status (Commercial Funnel Fix, 12 Sept 2026, allows a current-connecting Trip.com CTA — see tests/service-ended-commercial-funnel.test.ts)', async () => {
    const page = await RoutePage({ params: Promise.resolve({ slug: 'manchester-mumbai' }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain('Direct service ended');
  });
});
