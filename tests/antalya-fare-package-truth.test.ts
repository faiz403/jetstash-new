import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { deals, isBundledProductDeal } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { fareObservations } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getDestinationBySlug } from '@/data/destinations';
import { DealCard } from '@/components/ui/deal-card';

/**
 * Antalya fare/package truth fix (PR #144, August 2026).
 *
 * Root cause, proven from source: `isBundledProductDeal(deal)` forces
 * DealCard's `range` to null for every package/Umrah deal, REGARDLESS of
 * whether the underlying route has genuine, current flight fare evidence
 * (see data/deals.ts's own doc comment — a package's real price is
 * structurally different from a flight-only fare, so a route-level match
 * alone is never counted as package evidence). The old fallback copy,
 * "No fare checks logged yet — check the live price below", was written for
 * the genuinely-no-evidence case and doesn't distinguish "no flight fare
 * checks at all" from "flight fare checks exist, but they don't count as
 * this package's price" — both hit the exact same branch.
 *
 * Proof case: bhx-ayt-package (Birmingham → Antalya, category 'package').
 * The Antalya destination page (app/destinations/[slug]/page.tsx) renders
 * DestinationFlightGuides near the top, which shows Birmingham-Antalya's
 * real, current Fare Signal ("Fare observed: £201 return · checked 13
 * August 2026", from obs-bhx-ayt-economy-20260813-8w-v1) — then, in the
 * last section of the same page, bhx-ayt-package's own DealCard used to say
 * "No fare checks logged yet." Same page, same route, an apparent
 * contradiction a customer has no way to resolve without knowing JetStash's
 * internal Deal-vs-FareObservation-vs-package-price data model.
 *
 * This is a copy-only fix: isBundledProductDeal, hasTrackedFare, the fare
 * archive, and every resolver stay untouched — see the "unchanged" tests
 * below.
 */

const nowIso = '2026-08-17';

describe('1. Root cause proof: Birmingham-Antalya has current flight fare evidence, shown elsewhere on the Antalya page', () => {
  it('obs-bhx-ayt-economy-20260813-8w-v1 exists, is current, and its price is £201', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-bhx-ayt-economy-20260813-8w-v1');
    expect(obs).toBeDefined();
    expect(obs!.price).toBe(201);
    expect(obs!.comparisonEligibility).toBe('current');
  });

  it('getFareSignalForRoute confirms birmingham-antalya is a live, current Fare Signal', () => {
    const signal = getFareSignalForRoute('birmingham-antalya', nowIso);
    expect(signal.state).toBe('current');
    expect(signal.observation?.price).toBe(201);
  });

  it('DestinationFlightGuides (rendered near the top of the Antalya page) shows this exact fare to the customer', () => {
    const antalya = getDestinationBySlug('antalya')!;
    const entries = getDestinationFlightGuideEntries(antalya, nowIso);
    const bhx = entries.find((e) => e.airport.slug === 'birmingham');
    expect(bhx?.fareSignal?.observation?.price).toBe(201);
    expect(bhx?.fareSignal?.state).toBe('current');
  });
});

describe('2. bhx-ayt-package is a bundled deal, so its DealCard range is always null regardless of the route\'s own fare evidence', () => {
  const dealDef = deals.find((d) => d.id === 'bhx-ayt-package')!;

  it('the deal exists, targets Antalya, category package', () => {
    expect(dealDef).toBeDefined();
    expect(dealDef.category).toBe('package');
    expect(isBundledProductDeal(dealDef)).toBe(true);
  });

  it('the underlying route (birmingham-antalya) genuinely resolves', () => {
    const route = getRouteByAirportAndDestination(dealDef.fromAirportSlug, dealDef.toDestinationSlug);
    expect(route?.slug).toBe('birmingham-antalya');
  });
});

describe('3. DealCard no longer claims "no fare checks" for a package deal — it names the actually-missing evidence', () => {
  function renderText(deal: (typeof deals)[number]): string {
    const html = renderToStaticMarkup(DealCard({ deal }));
    return html;
  }

  it('bhx-ayt-package (Antalya) renders "No package price tracked yet." — not "No fare checks logged yet"', () => {
    const dealDef = deals.find((d) => d.id === 'bhx-ayt-package')!;
    const html = renderText(dealDef);
    expect(html).toContain('No package price tracked yet.');
    expect(html).not.toMatch(/No fare checks logged yet/);
  });

  it('every bundled (package/umrah) deal site-wide gets the same accurate wording — this is a shared-component fix, not Antalya-only', () => {
    const bundled = deals.filter((d) => isBundledProductDeal(d));
    expect(bundled.length).toBeGreaterThanOrEqual(6); // 2 umrah + 4 package, confirmed from data/deals.ts
    for (const dealDef of bundled) {
      const html = renderText(dealDef);
      expect(html, `${dealDef.id} should not claim "no fare checks"`).not.toMatch(/No fare checks logged yet/);
      expect(html, `${dealDef.id} should name the missing package price`).toContain('No package price tracked yet.');
    }
  });

  it('the replacement wording never invents a package price — it only states one is not yet tracked', () => {
    const dealDef = deals.find((d) => d.id === 'bhx-ayt-package')!;
    const html = renderText(dealDef);
    expect(html).not.toMatch(/£\d/); // no price figure anywhere on this card
  });
});

describe('4. A genuinely no-evidence flight-only deal keeps the accurate, cabin-scoped wording (fallback boundary is preserved, not collapsed)', () => {
  it('a non-bundled deal whose route has no matching Airport/Destination (so no fare evidence can possibly exist) still renders the flight-fallback copy, not the package one', () => {
    // Synthetic, non-bundled deal pointing at slugs with no real match — the
    // exact behavioural case the original copy was written for. This proves
    // the fix is additive (a new branch for bundled deals) rather than a
    // rewrite that could have silently changed the honest-no-evidence case too.
    //
    // Participant 1 defect follow-up (21 Aug 2026): the flight-fallback
    // sentence itself became cabin-specific (data/deals.ts's `cabin` field
    // is now named in the sentence, e.g. "No Economy fare checks logged
    // yet") — see tests/dealcard-order-and-hydration-fix.test.ts for the
    // full root-cause story. This test still proves what it always proved
    // (the package/flight fallback boundary is intact), just against the
    // current exact string.
    const syntheticDeal = {
      id: 'synthetic-no-evidence',
      category: 'flight' as const,
      cabin: 'Economy' as const,
      fromAirportSlug: 'does-not-exist',
      toDestinationSlug: 'does-not-exist',
      fromCity: 'Nowhere',
      toCity: 'Nowhere',
      toCountry: 'Nowhere',
      airline: 'Test Airline',
    };
    expect(isBundledProductDeal(syntheticDeal)).toBe(false);
    const html = renderToStaticMarkup(DealCard({ deal: syntheticDeal }));
    expect(html).toContain('No Economy fare checks logged yet — check the live price below');
    expect(html).not.toContain('No package price tracked yet.');
  });
});

describe('5. Nothing about the underlying evidence model moved', () => {
  it('isBundledProductDeal keeps gating range to null regardless of route fare evidence (never inherits a flight fare as package proof)', () => {
    // birmingham-antalya has a current Fare Signal (§1), yet the package deal's
    // own range must still be null — the fix never makes the card show a price.
    const html = renderToStaticMarkup(DealCard({ deal: deals.find((d) => d.id === 'bhx-ayt-package')! }));
    expect(html).not.toMatch(/£201/);
  });

  it('obs-bhx-ayt-economy-20260813-8w-v1 is unchanged (still £201, still current)', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-bhx-ayt-economy-20260813-8w-v1')!;
    expect(obs.price).toBe(201);
    expect(obs.observedDate).toBe('2026-08-13');
    expect(obs.comparisonEligibility).toBe('current');
  });
});
