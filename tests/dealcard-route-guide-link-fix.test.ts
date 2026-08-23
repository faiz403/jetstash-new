import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { deals, isBundledProductDeal } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { getFareRangeSummary } from '@/data/fare-observations';
import { DealCard } from '@/components/ui/deal-card';

/**
 * DealCard route-guide link root fix — SEO Domination Batch 1B (23 Aug
 * 2026). Confirmed via a read-only audit (not assumed): components/ui/deal-
 * card.tsx's route-guide link only ever rendered inside the `{range ? (...)
 * : (...)}` ternary's "no range" branch, or inside a separate
 * `{range && range.count > 1}` paragraph — neither condition covered
 * `range` truthy AND `count === 1`, the exact shape of a brand-new
 * -baseline-v1 series with its first observation. That's precisely what
 * all three new Business Fare Evidence Batch 1 cards are, so they (and any
 * other card in the same shape) silently lost their route-guide path
 * entirely. This was a boolean-coverage gap, not a design choice — the
 * surrounding code already had two deliberate link variants (no-fare,
 * fare-history), the single-check case was simply never given one.
 *
 * NOW_ISO deliberately matches the live archive's own "today" so this
 * suite proves the fix against real production data, not synthetic
 * fixtures — and per the founder's own instruction, the affected-card list
 * below is *derived* from getFareRangeSummary()/getRouteByAirportAndDestination()
 * at test time, never hardcoded, so it stays correct as the archive grows.
 */

const NOW_ISO = '2026-08-23';

function dealsByObservationCount() {
  const zero: string[] = [];
  const one: string[] = [];
  const twoPlus: string[] = [];
  for (const deal of deals) {
    if (isBundledProductDeal(deal)) continue; // separate, already-correct concern — not this fix's scope
    const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
    if (!route) continue;
    const range = getFareRangeSummary(route.slug, deal.cabin, NOW_ISO);
    if (!range) zero.push(deal.id);
    else if (range.count === 1) one.push(deal.id);
    else twoPlus.push(deal.id);
  }
  return { zero, one, twoPlus };
}

function renderDealLinks(dealId: string) {
  const deal = deals.find((d) => d.id === dealId)!;
  const html = renderToStaticMarkup(DealCard({ deal }));
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug)!;
  const routeHref = `/routes/${route.slug}`;
  const hasRouteGuideLink = html.includes(`href="${routeHref}"`);
  return { html, hasRouteGuideLink, routeHref };
}

describe('DealCard route-guide link — all three observation-count shapes retain a real link', () => {
  it('confirms today\'s real, derived (not hardcoded) affected-card counts — sanity that this suite is exercising genuine data in all three shapes', () => {
    const { zero, one, twoPlus } = dealsByObservationCount();
    expect(zero.length, 'expected at least one no-fare Deal today').toBeGreaterThan(0);
    expect(one.length, 'expected at least one single-observation Deal today').toBeGreaterThan(0);
    expect(twoPlus.length, 'expected at least one 2+-observation Deal today').toBeGreaterThan(0);
  });

  it('the exact three new Business Fare Evidence Batch 1 cards are among today\'s single-observation set — the flagship case this fix exists for', () => {
    const { one } = dealsByObservationCount();
    for (const id of ['man-lhe-business', 'lhr-business-lhe', 'lhr-doh-business']) {
      expect(one, id).toContain(id);
    }
  });

  it('zero-observation cards keep their existing route-guide link ("More on the route guide" / "Booking-window guidance on the route guide") — unaffected by this fix', () => {
    const { zero } = dealsByObservationCount();
    for (const id of zero) {
      const { hasRouteGuideLink, routeHref } = renderDealLinks(id);
      expect(hasRouteGuideLink, `${id} -> ${routeHref}`).toBe(true);
    }
  });

  it('single-observation cards now get a real route-guide link ("View route guide") — the defect fixed here', () => {
    const { one } = dealsByObservationCount();
    for (const id of one) {
      const { html, hasRouteGuideLink, routeHref } = renderDealLinks(id);
      expect(hasRouteGuideLink, `${id} -> ${routeHref}`).toBe(true);
      expect(html, id).toContain('View route guide');
    }
  });

  it('2+-observation cards keep a route-guide link too — previously inert "See the full history on the route guide" text with no href, now a real link, same visible wording', () => {
    const { twoPlus } = dealsByObservationCount();
    for (const id of twoPlus) {
      const { html, hasRouteGuideLink, routeHref } = renderDealLinks(id);
      expect(hasRouteGuideLink, `${id} -> ${routeHref}`).toBe(true);
      expect(html, id).toContain('See the full history on the route guide');
    }
  });

  it('every affected card\'s route-guide link points at its own matched route, not some other route', () => {
    const { zero, one, twoPlus } = dealsByObservationCount();
    for (const id of [...zero, ...one, ...twoPlus]) {
      const deal = deals.find((d) => d.id === id)!;
      const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug)!;
      const html = renderToStaticMarkup(DealCard({ deal }));
      expect(html, id).toContain(`href="/routes/${route.slug}"`);
    }
  });

  it('the package/Umrah bundled-product fallback is untouched — a separate, already-correct concern this fix does not touch', () => {
    const bundled = deals.find((d) => isBundledProductDeal(d));
    expect(bundled, 'expected at least one bundled-product deal to exist').toBeTruthy();
    const html = renderToStaticMarkup(DealCard({ deal: bundled! }));
    expect(html).toContain('No package price tracked yet.');
  });
});
