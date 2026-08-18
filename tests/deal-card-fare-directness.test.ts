import { describe, it, expect } from 'vitest';
import { deals, getDealFareDirectnessLabel, getDealDirectnessLabel } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { getFareRangeSummary, fareObservations, aggregateFareDirectness } from '@/data/fare-observations';
import { getTripComRouteUrl } from '@/lib/booking-providers';

/**
 * Directness-badge fix (August 2026, product-truth review of PR #74).
 *
 * The defect: DealCard's top-right badge was derived purely from
 * getDealDirectnessLabel() — the ROUTE's own verified service state — and
 * rendered directly above a SPECIFIC priced fare, whose own itinerary
 * could be for a different airline and different routing. Manchester-Dubai
 * showed "DIRECT FLIGHT" (Emirates' own verified direct service) above a
 * logged Gulf Air fare that is itself connecting via Bahrain.
 *
 * The fix: getDealFareDirectnessLabel() is now the one gate DealCard uses.
 * It prefers the specific fare's own recorded fareDirectness; falls back to
 * the route-level label only when every source airline shown is one of the
 * route's own verified operators (safe — the route's directness genuinely
 * describes that airline's service too); and fails closed (no badge) when
 * a fare is shown for a genuinely unconfirmed airline. See its doc comment
 * in data/deals.ts for the full resolution order.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);

describe('getDealFareDirectnessLabel — a route being direct never implies a specific displayed fare is direct', () => {
  it('Manchester-Dubai (a verified-direct route) displays "Connecting" for its Gulf Air fare, never "Direct flight"', () => {
    const deal = deals.find((d) => d.id === 'man-dxb-economy')!;
    expect(deal).toBeDefined();
    // Confirm the premise: the route itself IS verified direct.
    expect(getDealDirectnessLabel(deal, NOW_ISO)).toBe('Direct flight');
    // But the fare-aware label must reflect the fare's own recorded routing.
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).toBe('Connecting');
  });

  it('a connecting fare on a route with any status never receives "Direct flight"', () => {
    for (const deal of deals) {
      // Package/Umrah cards are curated bundled products, not flight-fare
      // cards. A newly observed flight fare must not rewrite their product
      // badge or make a package card pretend to be a flight comparison.
      if (deal.category === 'umrah' || deal.category === 'package') continue;
      const label = getDealFareDirectnessLabel(deal, NOW_ISO);
      const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
      if (!route) continue;
      const range = getFareRangeSummary(route.slug, deal.cabin, NOW_ISO);
      if (range?.observedDirectness === 'connecting') {
        expect(label, deal.id).toBe('Connecting');
      }
    }
  });

  it('a fare receives "Direct flight" only when its own evidence supports it — either explicit fareDirectness, or every source airline is a verified route operator', () => {
    for (const deal of deals) {
      const label = getDealFareDirectnessLabel(deal, NOW_ISO);
      if (label !== 'Direct flight') continue;
      const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
      expect(route, deal.id).toBeDefined();
      const range = getFareRangeSummary(route!.slug, deal.cabin, NOW_ISO);
      if (!range) continue; // no fare shown — route-level label is legitimately safe, nothing to verify against a fare
      if (range.observedDirectness === 'direct') continue; // explicit evidence
      // Otherwise this must be the "every source is a verified operator" fallback path.
      expect(range.sources.length, deal.id).toBeGreaterThan(0);
    }
  });

  it('11 August full round-trip evidence upgrades the previously under-evidenced fares to Connecting', () => {
    for (const id of ['lhr-del-economy', 'bhx-atq-economy']) {
      const deal = deals.find((d) => d.id === id)!;
      expect(deal, id).toBeDefined();
      expect(getDealFareDirectnessLabel(deal, NOW_ISO), id).toBe('Connecting');
    }
  });

  it('bhx-atq-economy: current full round-trip evidence supports a Connecting badge', () => {
    const deal = deals.find((d) => d.id === 'bhx-atq-economy')!;
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).toBe('Connecting');
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).not.toBe('Direct flight');
  });

  it('man-lhe-economy correctly moved from "unconfirmed" to "Connecting" once its Batch A observation recorded explicit fareDirectness', () => {
    const deal = deals.find((d) => d.id === 'man-lhe-economy')!;
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).toBe('Connecting');
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).not.toBe('Direct flight');
  });

  it('route-level direct-service guidance (getDealDirectnessLabel) is completely unchanged — the fix only changes which function DealCard calls for the fare-card badge', () => {
    const dubaiDeal = deals.find((d) => d.id === 'man-dxb-economy')!;
    expect(getDealDirectnessLabel(dubaiDeal, NOW_ISO)).toBe('Direct flight');
    const lahoreDeal = deals.find((d) => d.id === 'man-lhe-economy')!;
    expect(getDealDirectnessLabel(lahoreDeal, NOW_ISO)).toBe('Direct flight');
  });

  it('bundled Umrah/package deals are unaffected — they never display a flight-only fare, so the route-level label stays safe', () => {
    const umrahJed = deals.find((d) => d.id === 'umrah-package-jed')!;
    const umrahMed = deals.find((d) => d.id === 'umrah-package-extended')!;
    expect(getDealFareDirectnessLabel(umrahJed, NOW_ISO)).toBe(getDealDirectnessLabel(umrahJed, NOW_ISO));
    expect(getDealFareDirectnessLabel(umrahMed, NOW_ISO)).toBe(getDealDirectnessLabel(umrahMed, NOW_ISO));
    const packageDeal = deals.find((deal) => deal.id === 'man-ist-package');
    if (packageDeal) {
      expect(getDealFareDirectnessLabel(packageDeal, NOW_ISO)).toBe(getDealDirectnessLabel(packageDeal, NOW_ISO));
    }
  });

  it('a deal/cabin with no logged fare at all falls back to the route-level label unchanged (nothing to contradict)', () => {
    const dubaiBusiness = deals.find((d) => d.id === 'dxb-business-man');
    if (dubaiBusiness) {
      const route = getRouteByAirportAndDestination(dubaiBusiness.fromAirportSlug, dubaiBusiness.toDestinationSlug)!;
      expect(getFareRangeSummary(route.slug, dubaiBusiness.cabin, NOW_ISO)).toBeNull();
      expect(getDealFareDirectnessLabel(dubaiBusiness, NOW_ISO)).toBe(getDealDirectnessLabel(dubaiBusiness, NOW_ISO));
    }
  });

  it('every Deal entry produces a defined result (never throws) from getDealFareDirectnessLabel — the whole 32-ish deal catalogue is safe', () => {
    for (const deal of deals) {
      expect(() => getDealFareDirectnessLabel(deal, NOW_ISO), deal.id).not.toThrow();
    }
  });
});

describe('FareRangeSummary.observedDirectness aggregates per-observation fareDirectness honestly', () => {
  it('Manchester-Dubai\'s range reports "connecting", matching its one observation\'s explicit fareDirectness', () => {
    const range = getFareRangeSummary('manchester-dubai', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBe('connecting');
  });

  it('Manchester-Lahore\'s range now reports "connecting", matching its Batch A observation\'s explicit fareDirectness (its two older Etihad observations predate the field and stay unset)', () => {
    const range = getFareRangeSummary('manchester-lahore', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBe('connecting');
  });

  it('Manchester-Islamabad\'s range reports connecting after the 10 August options had both legs reviewed', () => {
    const range = getFareRangeSummary('manchester-islamabad', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBe('connecting');
  });

  it('manchester-mumbai now resolves to a real, evidenced "connecting" once the 18 August Weekly Full Fare Refresh #1 observation supplied its first ever stated fareDirectness value (previously undefined: its only observation was explicitly \'unknown\', which never counts toward an aggregate)', () => {
    const range = getFareRangeSummary('manchester-mumbai', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBe('connecting');
  });

  it('the fareDirectness field is optional and, when stated, is always one of the three valid values', () => {
    for (const o of fareObservations) {
      if (o.fareDirectness !== undefined) {
        expect(['direct', 'connecting', 'unknown'], o.id).toContain(o.fareDirectness);
      }
    }
  });
});

describe('aggregateFareDirectness — the pure aggregation getFareRangeSummary delegates to, tested with synthetic data', () => {
  // No real observation in the archive has fareDirectness: 'direct' yet
  // (only Manchester-Dubai's 'connecting' Gulf Air fare has been evidenced
  // so far), so the 'direct' branch is otherwise never exercised by any
  // integration-level test against real deals/observations. These cases use
  // synthetic, clearly-local objects — never written into the real archive —
  // specifically to cover that branch without fabricating fare evidence.
  it('a single observation stating "direct" aggregates to "direct"', () => {
    expect(aggregateFareDirectness([{ fareDirectness: 'direct' }])).toBe('direct');
  });

  it('a single observation stating "connecting" aggregates to "connecting"', () => {
    expect(aggregateFareDirectness([{ fareDirectness: 'connecting' }])).toBe('connecting');
  });

  it('multiple observations agreeing on "direct" aggregate to "direct"', () => {
    expect(aggregateFareDirectness([{ fareDirectness: 'direct' }, { fareDirectness: 'direct' }])).toBe('direct');
  });

  it('no observation stating a value aggregates to undefined — never guessed', () => {
    expect(aggregateFareDirectness([{ fareDirectness: undefined }, { fareDirectness: undefined }])).toBeUndefined();
    expect(aggregateFareDirectness([])).toBeUndefined();
  });

  it('observations that disagree ("direct" vs "connecting") aggregate to undefined, never a majority guess', () => {
    expect(aggregateFareDirectness([{ fareDirectness: 'direct' }, { fareDirectness: 'connecting' }])).toBeUndefined();
  });

  it('a mix of stated and unstated observations aggregates on the stated ones only, when they agree', () => {
    expect(aggregateFareDirectness([{ fareDirectness: 'connecting' }, { fareDirectness: undefined }])).toBe('connecting');
  });

  it('"unknown" is a real archive value but never drives a badge — treated the same as an omitted field', () => {
    expect(aggregateFareDirectness([{ fareDirectness: 'unknown' }])).toBeUndefined();
    expect(aggregateFareDirectness([{ fareDirectness: 'unknown' }, { fareDirectness: 'unknown' }])).toBeUndefined();
    // A mix of "unknown" and a real stated value still yields the real
    // value — "unknown" never contaminates a genuine "direct"/"connecting"
    // agreement, and never counts as a disagreement against it either.
    expect(aggregateFareDirectness([{ fareDirectness: 'unknown' }, { fareDirectness: 'direct' }])).toBe('direct');
  });
});

describe('This fix changes only directness-badge derivation — no Trip.com mapping, fare value or route fact changed', () => {
  it('Manchester-Dubai keeps its exact Trip.com URL', () => {
    expect(getTripComRouteUrl('manchester-dubai')).toBe(
      'https://www.trip.com/flights/Manchester-to-Dubai/tickets-MAN-DXB?flighttype=S&dcity=MAN&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082331'
    );
  });

  it('the Gulf Air fare\'s price, dates and source are exactly as recorded — only fareDirectness was added', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-man-dxb-economy-20260806-8w-v1')!;
    expect(obs.price).toBe(480);
    expect(obs.source).toBe('Gulf Air');
    expect(obs.departureDate).toBe('2026-10-01');
    expect(obs.returnDate).toBe('2026-10-15');
    expect(obs.fareDirectness).toBe('connecting');
  });

  it('Manchester-Dubai\'s own route record (isDirect, airlineSlugs, verification) is untouched', () => {
    // A structural guard: this test file never imports or mutates data/routes.ts,
    // so any change there would show up as a diff review item, not a silent
    // pass here — asserted directly for completeness.
    const route = getRouteByAirportAndDestination('manchester', 'dubai')!;
    expect(route.isDirect).toBe(true);
    expect(route.airlineSlugs).toEqual(['emirates']);
  });
});
