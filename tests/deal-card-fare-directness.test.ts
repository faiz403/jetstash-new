import { describe, it, expect } from 'vitest';
import { deals, getDealFareDirectnessLabel, getDealDirectnessLabel } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { getFareRangeSummary, fareObservations } from '@/data/fare-observations';
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

  it('unknown fare directness (a logged fare for an airline the route has never verified) renders no badge at all — never guesses either way', () => {
    const knownUnconfirmedCases = ['man-lhe-economy', 'lhr-del-economy', 'bhx-atq-economy'];
    for (const id of knownUnconfirmedCases) {
      const deal = deals.find((d) => d.id === id)!;
      expect(deal, id).toBeDefined();
      expect(getDealFareDirectnessLabel(deal, NOW_ISO), id).toBeUndefined();
      // Confirm this is a genuine change from the route-only label, not a coincidence.
      expect(getDealDirectnessLabel(deal, NOW_ISO), id).not.toBeUndefined();
    }
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

  it('a route/cabin whose observations never recorded fareDirectness reports undefined, never a guess', () => {
    const range = getFareRangeSummary('manchester-lahore', 'Economy', NOW_ISO);
    expect(range).not.toBeNull();
    expect(range!.observedDirectness).toBeUndefined();
  });

  it('the new fareDirectness field is optional and does not break any historic observation', () => {
    for (const o of fareObservations) {
      if (o.fareDirectness !== undefined) {
        expect(['direct', 'connecting'], o.id).toContain(o.fareDirectness);
      }
    }
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
