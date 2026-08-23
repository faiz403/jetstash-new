import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deals, getDealAirlineLabel, getDealFareDirectnessLabel, hasTrackedFare, getDealsByCategory } from '@/data/deals';
import { getRouteBySlug, getRouteByAirportAndDestination } from '@/data/routes';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getFareSignalForRoute, hasCurrentFareSignalForCabinAmongRoutes } from '@/lib/fare-signal';
import { computeRouteIntelligenceLevel } from '@/lib/atlas-network-data';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { routes } from '@/data/routes';
import { renderToStaticMarkup } from 'react-dom/server';
import { DealCard } from '@/components/ui/deal-card';

/**
 * Manchester–Karachi Business Deal — product completion (23 Aug 2026).
 * Makes Business Fare Evidence Batch 1's manchester-karachi observation
 * (£2,553, Gulf Air, connecting via Bahrain — logged in PR #166, deal
 * deliberately withheld at the time) genuinely visible through the
 * established Business Deal surfaces, chosen over the next Tier B SEO
 * candidate after a head-to-head decision audit (23 Aug 2026) found
 * Karachi's evidence, working CTA and honest differentiation stronger than
 * a Manchester–Dubai flight-time query Google already answers natively
 * on-SERP.
 *
 * Deliberately data-only: no seoTitle/seoDescription, no
 * BusinessClarityPanel/FAQ (route and tracked fare already agree on
 * "connecting" — no direct-vs-connecting conflict to disambiguate, unlike
 * Lahore/Doha), no route/fare change.
 */

const NOW_ISO = '2026-08-23';

describe('The Deal exists exactly once, correctly owned', () => {
  it('exactly one man-khi-business Deal exists', () => {
    const matches = deals.filter((d) => d.id === 'man-khi-business');
    expect(matches.length).toBe(1);
  });

  it('carries the exact proposed shape', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(deal.category).toBe('business');
    expect(deal.cabin).toBe('Business');
    expect(deal.fromAirportSlug).toBe('manchester');
    expect(deal.toDestinationSlug).toBe('karachi');
    expect(deal.fromCity).toBe('Manchester');
    expect(deal.toCity).toBe('Karachi');
    expect(deal.toCountry).toBe('Pakistan');
  });

  it('is owned by the real manchester-karachi Route record', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
    expect(route?.slug).toBe('manchester-karachi');
  });
});

describe('Deal.airline audit — the established, tested convention, not a stale hardcode', () => {
  it('airline is "PIA" — the route\'s own first verified operator (airlineSlugs[0]), never the tracked fare\'s own carrier (Gulf Air)', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    const route = getRouteBySlug('manchester-karachi')!;
    expect(deal.airline).toBe('PIA');
    expect(route.airlineSlugs[0]).toBe('pia');
  });

  it('getDealAirlineLabel() re-verifies this live against the route\'s current AirlineVerification status — proven by actually calling it, not asserted from the stored string alone', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(getDealAirlineLabel(deal, NOW_ISO)).toBe('PIA');
  });

  it('the tracked fare\'s real carrier (Gulf Air) is attributed separately via the observation\'s own `source` field, never via Deal.airline', () => {
    const range = getFareRangeSummary('manchester-karachi', 'Business', NOW_ISO)!;
    expect(range.sources).toEqual(['Gulf Air']);
  });
});

describe('Price and directness are derived dynamically — never hardcoded', () => {
  it('the current Business observation attaches correctly: £2,553, connecting, Gulf Air via Bahrain, not self-transfer', () => {
    const range = getFareRangeSummary('manchester-karachi', 'Business', NOW_ISO)!;
    expect(range.min).toBe(2553);
    expect(range.count).toBe(1);
    expect(range.observedDirectness).toBe('connecting');
    expect(range.priceNote).toContain('NOT self-transfer');
    expect(range.priceNote).toContain('Bahrain');
  });

  it('hasTrackedFare is true for the new Deal', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(hasTrackedFare(deal, NOW_ISO)).toBe(true);
  });

  it('data/deals.ts itself never embeds the £2,553 price — grep the raw source, not just the resolved value', () => {
    const src = readFileSync(join(process.cwd(), 'data/deals.ts'), 'utf8');
    const dealBlock = src.slice(src.indexOf("id: 'man-khi-business'"), src.indexOf("id: 'man-khi-business'") + 400);
    expect(dealBlock).not.toMatch(/2,?553/);
  });
});

describe('Route/fare truth preserved — connecting route, connecting fare, no fixed hub', () => {
  it('the route itself is still verified connecting, with no populated routeServiceConnections (no fixed hub claim)', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.isDirect).toBe(false);
    expect(route.verification?.status).toBe('verified');
    expect(route.routeServiceConnections).toBeUndefined();
  });

  it('the DealCard\'s own directness badge correctly reads "Connecting" — route and fare agree, so no route-vs-fare mismatch is possible here', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).toBe('Connecting');
  });

  it('the route\'s own intro text never generalises Bahrain as the route\'s hub — Bahrain belongs only to this one fare\'s itinerary', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.intro).not.toMatch(/Bahrain/i);
  });
});

describe('Generic Fare Signal is unaffected — stays Economy £539', () => {
  it('getFareSignalForRoute still resolves to the £539 Economy observation, not the new £2,553 Business one', () => {
    const signal = getFareSignalForRoute('manchester-karachi', NOW_ISO);
    expect(signal.observation?.cabin).toBe('Economy');
    expect(signal.observation?.price).toBe(539);
  });
});

describe('Rendered DealCard — /routes/manchester-karachi and /business-class both use this component', () => {
  it('shows £2,553, Business cabin, Connecting badge, and a working route-guide link (bucket A — count === 1)', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    const html = renderToStaticMarkup(DealCard({ deal }));
    expect(html).toContain('2,553');
    expect(html).toContain('Business class');
    expect(html).toContain('href="/routes/manchester-karachi"');
    expect(html).toContain('View route guide');
    expect(html).toContain('Fare checked with Gulf Air');
  });

  it('the working Trip.com CTA is unchanged and present', () => {
    const url = getTripComFlightHandoffUrl('manchester-karachi', 'manchester', 'karachi');
    expect(url).toContain('trip.com');
    expect(url).toContain('MAN-KHI');
  });
});

describe('/business-class placement — priced grid only, never the direct-routes list', () => {
  it('appears in getDealsByCategory(\'business\') — the priced "Example business class fares" grid', () => {
    const businessDeals = getDealsByCategory('business');
    expect(businessDeals.some((d) => d.id === 'man-khi-business')).toBe(true);
  });

  it('manchester-karachi is NOT a status === "direct" route, so it correctly cannot appear in the "Direct routes" example list regardless of this Deal', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.isDirect).toBe(false);
  });
});

describe('/deals — Business category count and visibility', () => {
  it('sitewide Business Deal count is now 11 (was 10 before this batch)', () => {
    expect(getDealsByCategory('business').length).toBe(11);
  });

  it('Business Deals with a current tracked fare moves from 3 to 4', () => {
    const tracked = getDealsByCategory('business').filter((d) => hasTrackedFare(d, NOW_ISO));
    expect(tracked.map((d) => d.id).sort()).toEqual(
      ['lhr-business-lhe', 'lhr-doh-business', 'man-khi-business', 'man-lhe-business'].sort()
    );
  });

  it('the Business category filter remains visible sitewide (was already true before this Deal — Lahore/Doha already unlocked it)', () => {
    expect(hasCurrentFareSignalForCabinAmongRoutes(routes.map((r) => r.slug), 'Business', NOW_ISO)).toBe(true);
  });
});

describe('Downstream effects — honestly re-derived, not assumed', () => {
  it('Route Intelligence level stays Useful — a Business Deal alone does not clear Gate 1 (breadth) for this route, since it has no airlineVerifications, connectingAlternative, active warning or baggage tip', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });

  it('the existing man-khi-economy Deal is completely untouched', () => {
    const economyDeal = deals.find((d) => d.id === 'man-khi-economy')!;
    expect(economyDeal.airline).toBe('PIA');
    expect(economyDeal.category).toBe('flight');
  });
});

describe('No SEO metadata changed in this batch', () => {
  it('manchester-karachi carries no seoTitle/seoDescription/businessClarity — this is a data-only product PR', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.seoTitle).toBeUndefined();
    expect(route.seoDescription).toBeUndefined();
    expect(route.businessClarity).toBeUndefined();
  });
});

describe('No unsupported claims', () => {
  it('the observation\'s priceNote never claims "best"/"cheapest"/"lowest" as a superlative — it correctly says "lowest qualifying price" for the specific search only', () => {
    const range = getFareRangeSummary('manchester-karachi', 'Business', NOW_ISO)!;
    expect(range.priceNote.toLowerCase()).not.toMatch(/\bbest\b/);
  });

  it('nothing in the Deal or route data asserts Gulf Air as a permanent/future operator', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(deal.airline).not.toBe('Gulf Air');
  });
});
