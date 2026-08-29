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
 * Deliberately scoped to ONLY the count === 1 case. An earlier version of
 * this fix also turned the count > 1 paragraph into a real link; founder
 * review (23 Aug 2026, PR #168) found that changed 29 additional live
 * cards today — an undisclosed blast radius far beyond the approved scope
 * ("fix the missing route-guide link on all 5 single-observation
 * DealCards"), none of them related to this batch's actual subject — so it
 * was reverted. The count > 1 paragraph stays plain, non-link text, exactly
 * as before this fix; see the full three-way blast-radius breakdown this
 * suite proves below.
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
  const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW_ISO }));
  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug)!;
  const routeHref = `/routes/${route.slug}`;
  const hasRouteGuideLink = html.includes(`href="${routeHref}"`);
  return { html, hasRouteGuideLink, routeHref };
}

describe('DealCard route-guide link — full blast-radius breakdown, scoped fix', () => {
  it('confirms today\'s real, derived (not hardcoded) affected-card counts in all three shapes', () => {
    const { zero, one, twoPlus } = dealsByObservationCount();
    expect(zero.length, 'expected at least one no-fare Deal today').toBeGreaterThan(0);
    expect(one.length, 'expected at least one single-observation Deal today').toBeGreaterThan(0);
    expect(twoPlus.length, 'expected at least one 2+-observation Deal today').toBeGreaterThan(0);
  });

  it('bucket A (count === 1, genuinely fixed) is exactly today\'s 6 single-observation cards, including the three new Business Fare Evidence Batch 1 cards and the later Manchester-Karachi Business Deal (23 Aug product-completion PR) — the flagship case this fix exists for', () => {
    const { one } = dealsByObservationCount();
    expect(one.sort()).toEqual(
      ['lba-isb-economy', 'lhr-business-lhe', 'lhr-doh-business', 'man-khi-business', 'man-khi-economy', 'man-lhe-business'].sort()
    );
  });

  it('bucket A: every count === 1 card now gets a real "View route guide" link — the defect fixed here', () => {
    const { one } = dealsByObservationCount();
    for (const id of one) {
      const { html, hasRouteGuideLink, routeHref } = renderDealLinks(id);
      expect(hasRouteGuideLink, `${id} -> ${routeHref}`).toBe(true);
      expect(html, id).toContain('View route guide');
    }
  });

  it('bucket B (count > 1) is deliberately UNCHANGED — stays plain, non-link text, not part of this fix\'s approved scope', () => {
    const { twoPlus } = dealsByObservationCount();
    // Sanity: today's bucket B is large (29 cards) and spans routes with no
    // relationship to this batch's Lahore/Doha/Karachi subject (Barcelona,
    // Rome, Athens, Dhaka, etc.) — exactly why founder review asked for it
    // to be excluded rather than silently included.
    expect(twoPlus.length).toBeGreaterThan(20);
    for (const id of twoPlus) {
      const { html, hasRouteGuideLink } = renderDealLinks(id);
      expect(hasRouteGuideLink, id).toBe(false);
      expect(html, id).toContain('See the full history on the route guide.');
      expect(html, id).not.toMatch(/<a[^>]*>See the full history on the route guide/);
    }
  });

  it('bucket C (no fare at all) keeps its existing, pre-existing route-guide link ("More on the route guide" / "Booking-window guidance on the route guide") — unaffected by this fix', () => {
    const { zero } = dealsByObservationCount();
    for (const id of zero) {
      const { hasRouteGuideLink, routeHref } = renderDealLinks(id);
      expect(hasRouteGuideLink, `${id} -> ${routeHref}`).toBe(true);
    }
  });

  it('every fixed (bucket A) and pre-existing (bucket C) route-guide link points at its own matched route, not some other route', () => {
    const { zero, one } = dealsByObservationCount();
    for (const id of [...zero, ...one]) {
      const deal = deals.find((d) => d.id === id)!;
      const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug)!;
      const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW_ISO }));
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
