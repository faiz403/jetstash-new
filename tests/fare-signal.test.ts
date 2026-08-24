import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/data/routes';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import type { FareObservation } from '@/data/fare-observations';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { deals, hasTrackedFare } from '@/data/deals';
import { deriveFareSignal, getFareSignalForRoute, shouldShowNoFareFallback } from '@/lib/fare-signal';
import { FareSignal } from '@/components/route/fare-signal';

const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const componentSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');

const recentFixture: FareObservation = {
  id: 'fixture-recent-fare',
  routeSlug: 'fixture-route',
  cabin: 'Economy',
  observedDate: '2026-01-01',
  price: 684,
  priceNote: 'return, per person',
  source: 'Example Airline',
  currency: 'GBP',
  departureDate: '2026-10-01',
  returnDate: '2026-10-15',
  fareDirectness: 'connecting',
  comparisonEligibility: 'current',
};

describe('universal Fare Signal derivation', () => {
  it('shows the latest current publishable fare without promoting the historical Etihad check', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', '2026-08-11');
    expect(signal.state).toBe('current');
    // 2026-08-18: Weekly Full Fare Refresh #1 added a newer, later-dated
    // observation for this route, which now becomes the latest — the
    // function selects the latest observedDate regardless of nowIso.
    expect(signal.observation?.price).toBe(630);
    expect(signal.observation?.airline).toBe('Etihad');
    expect(signal.observation?.observedDate).toBe('2026-08-18');
    expect(signal.observation?.id).not.toContain('ey-645');
    expect(signal.strongerSignal).toBeNull();
  });

  it('uses the shared ageing/stale model for a recent tracked fare', () => {
    const signal = deriveFareSignal([recentFixture], '2026-08-11');
    expect(signal.state).toBe('recent');
    expect(signal.observation?.price).toBe(684);
    expect(signal.freshness).toBe('stale');
  });

  it('never upgrades a historical-only observation into a current Fare Signal', () => {
    const signal = deriveFareSignal([{ ...recentFixture, observedDate: '2026-08-10', comparisonEligibility: 'historical' }], '2026-08-11');
    expect(signal.state).toBe('recent');
    expect(signal.observation?.price).toBe(684);
  });

  it('returns the explicit no-current-fare state when no publishable observation exists', () => {
    // birmingham-lahore was this fixture until Fare Coverage Batch 1 (22
    // August 2026) gave it a fresh, publishable observation. birmingham-
    // delhi was the next fixture, until Connecting Journey Structure +
    // BHX-DEL unlock (22 August 2026) unsuppressed its 13 August
    // observation and appended a fresh 22 August one — swapped to
    // birmingham-ahmedabad, one of the five routes still genuinely
    // verification-blocked (unverified), which has no publishable
    // observation for the same reason it has always had none: route
    // verification status, not fare-observation completeness.
    const signal = getFareSignalForRoute('birmingham-ahmedabad', '2026-08-11');
    expect(signal).toEqual({ state: 'none', observation: null, freshness: null, strongerSignal: null });
  });

  it('resolves a valid signal state for every public route', () => {
    const states = new Set(['current', 'recent', 'none']);
    for (const route of routes) {
      expect(states.has(getFareSignalForRoute(route.slug, '2026-08-11').state)).toBe(true);
    }
  });
});

describe('Fare Signal presentation and CTA boundaries', () => {
  it('renders an evidenced current fare and the approved exact partner disclosure', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', '2026-08-11');
    const text = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-islamabad'), routeSlug: 'manchester-islamabad' })).replace(/\s+/g, ' ');
    expect(text).toContain('Fare Signal');
    expect(text).toContain('Fare spotted');
    expect(text).toContain('630');
    expect(text).toContain('Etihad');
    expect(text).toContain('Checked 18 August 2026');
    expect(text).toContain('Check current price');
    expect(text).toContain('Ad · Affiliate link.</span> JetStash earns commission on eligible bookings through this link, at no extra cost to you.');
    // Route Page Scanability fix (21 Aug 2026): the former hero-only caveat
    // ("Check the itinerary, baggage allowance and booking terms before
    // paying.") now lives here, folded into the one complete CTA caveat —
    // so a mention of "baggage" is now expected and correct. It's still not
    // a stated allowance fact (no figure, no airline-specific claim), only
    // an instruction to check — the £0/deal/cheap-style fabrication guard
    // stays in force.
    expect(text).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
    expect(text).not.toMatch(/£0|deal|cheap|cheapest|below average|good value|save/i);
  });

  it('labels a connecting observed fare separately from the route-level direct context (Route Page Journey Clarity System, 20 Aug 2026)', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', '2026-08-11');
    const text = renderToStaticMarkup(FareSignal({
      signal,
      tripComUrl: getTripComRouteUrl('manchester-islamabad'),
      routeSlug: 'manchester-islamabad',
      routeDirectness: 'direct',
      routeStatusLabel: 'Direct',
      routeAirlineLabel: 'PIA',
    })).replace(/\s+/g, ' ');
    expect(text).toContain('Route service');
    expect(text).toContain('PIA · Direct');
    expect(text).toContain('This tracked fare is a different, connecting journey.');
  });

  it('renders a recent fare without calling it current or a deal', () => {
    const signal = deriveFareSignal([recentFixture], '2026-08-11');
    const text = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: 'fixture-route' }));
    expect(text).toContain('Last tracked fare');
    expect(text).toContain('Price may have changed.');
    expect(text).not.toContain('Fare spotted');
    expect(text).not.toMatch(/deal|cheap|cheapest|below average|good value|save/i);
  });

  it('renders the exact fail-closed sentence, not a CTA, when the route has no safe exact Trip.com link (Route Page Scanability fix, 21 Aug 2026 — this sentence used to live only in the hero, which no longer carries a CTA at all)', () => {
    const signal = getFareSignalForRoute('london-heathrow-mumbai', '2026-08-11');
    const text = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('london-heathrow-mumbai'), routeSlug: 'london-heathrow-mumbai' }));
    expect(getTripComRouteUrl('london-heathrow-mumbai')).toBeNull();
    expect(text).not.toContain('Check current price');
    expect(text).not.toContain('Trip.com');
    expect(text).toContain('Exact partner booking link is not currently verified for this route.');
  });

  it('keeps the Fare Signal above Journey Choice and leaves the stricter verdict private', () => {
    // Journey Choice MVP pilot (24 Aug 2026): the public route page renders
    // <JourneyChoice>, not <SmartFareComparison> — see
    // tests/journey-choice.test.ts and tests/smart-fare-route-pilot.test.ts.
    // Fare Signal's own position and behaviour are completely unchanged by
    // that swap, which is exactly what this test still guards.
    const signalIndex = routePageSrc.indexOf('<FareSignal');
    const journeyChoiceIndex = routePageSrc.indexOf('<JourneyChoice');
    const historyIndex = routePageSrc.indexOf('<FareHistoryPanel');
    expect((routePageSrc.match(/<FareSignal/g) ?? []).length).toBe(1);
    expect(routePageSrc).not.toContain('<SmartFareComparison');
    expect(signalIndex).toBeLessThan(journeyChoiceIndex);
    expect(journeyChoiceIndex).toBeLessThan(historyIndex);
    expect(routePageSrc).toContain('getFareSignalForRoute(route.slug, nowIso)');
    expect(routePageSrc).not.toContain('deriveTripValueVerdict');
    expect(routePageSrc).not.toContain('True Trip Cost');
    expect(routePageSrc).not.toContain('Value Verdict');
  });

  it('passes the verified route context into Fare Signal so materially different observed itineraries are labelled', () => {
    expect(routePageSrc).toContain('routeDirectness={presentation.status === \'direct\' || presentation.status === \'connecting\' ? presentation.status : null}');
  });

  it('does not carry unknown baggage or unsupported stronger-signal language in the reusable component', () => {
    expect(componentSrc).not.toContain('Baggage');
    expect(componentSrc).not.toContain('£0');
    expect(componentSrc).not.toContain('cheap');
    expect(componentSrc).not.toContain('below average');
    expect(componentSrc).not.toContain('good value');
    expect(componentSrc).not.toContain('save £');
    expect(getFareSignalForRoute('manchester-islamabad', '2026-08-11').strongerSignal).toBeNull();
  });
});

describe('Fare Signal production coverage counts', () => {
  it('reports 83 routes with a current publishable fare and 5 without one at the current archive date (updated 22 August 2026, Connecting Journey Structure + BHX-DEL unlock)', () => {
    // Was 78/10 as of 18 August 2026. COV-001 (21 August) then Fare
    // Coverage Batch 1 (22 August) together moved 4 routes into "current"
    // (leeds-bradford-bodrum, manchester-karachi, birmingham-lahore,
    // birmingham-islamabad), leaving birmingham-delhi held (82/6). Later the
    // same day, Connecting Journey Structure + BHX-DEL unlock unsuppressed
    // birmingham-delhi's 13 August observation and appended a fresh 22
    // August one, moving it into "current" too (83/5) — the "none" bucket
    // is now exactly the 5 still-unverified routes.
    const signals = routes.map((route) => getFareSignalForRoute(route.slug, '2026-08-14'));
    expect(signals.filter((signal) => signal.state === 'current')).toHaveLength(83);
    expect(signals.filter((signal) => signal.state === 'recent')).toHaveLength(0);
    expect(signals.filter((signal) => signal.state === 'none')).toHaveLength(5);
    expect(routes.filter((route) => getTripComRouteUrl(route.slug)).length).toBe(45);
  });

  it('does not backfill Heathrow-Mumbai’s incomplete historic record, while allowing the fresh complete observation to render', () => {
    const historic = fareObservations.find((observation) => observation.id === 'obs-lhr-bom-economy-2');
    expect(historic?.currency).toBeUndefined();
    // 2026-08-18: Weekly Full Fare Refresh #1 added a second complete
    // observation (Etihad, £450) for this route, alongside the 13 August
    // one (Gulf Air, £424) — both are complete and publishable.
    expect(getPublishableObservationsByRoute('london-heathrow-mumbai', '2026-08-13')).toHaveLength(2);
    expect(getFareSignalForRoute('london-heathrow-mumbai', '2026-08-13')).toMatchObject({ state: 'current', observation: { id: 'obs-lhr-bom-economy-20260818-8w-v1', price: 450 } });
    const deal = deals.find((entry) => entry.id === 'lhr-bom-economy');
    expect(deal).toBeDefined();
    expect(hasTrackedFare(deal!, '2026-08-13')).toBe(true);
  });

  it('uses one display-readiness standard for tracked coverage and non-empty Fare Signals', () => {
    const trackedRoutes = routes
      .filter((route) => getPublishableObservationsByRoute(route.slug, '2026-08-13').length > 0)
      .map((route) => route.slug);
    const signalledRoutes = routes
      .filter((route) => getFareSignalForRoute(route.slug, '2026-08-13').state !== 'none')
      .map((route) => route.slug);
    expect(trackedRoutes).toEqual(signalledRoutes);
  });
});

describe('Fare Signal and route-page no-fare fallback share one readiness boundary', () => {
  it('the route page gates NoFareFallback from the shared Fare Signal readiness helper, not Deal-card presence', () => {
    expect(routePageSrc).toContain('shouldShowNoFareFallback(fareSignal)');
    expect(routePageSrc).toContain(') : shouldShowNoFareFallback(fareSignal) ?');
  });

  it('Manchester-Antalya has a current signal and never shows the no-fare fallback', () => {
    const signal = getFareSignalForRoute('manchester-antalya', '2026-08-13');
    expect(signal.state).toBe('current');
    expect(shouldShowNoFareFallback(signal)).toBe(false);
  });

  it('Heathrow-Mumbai has a fresh complete signal and no longer shows the no-fare fallback', () => {
    const signal = getFareSignalForRoute('london-heathrow-mumbai', '2026-08-13');
    expect(signal.state).toBe('current');
    expect(shouldShowNoFareFallback(signal)).toBe(false);
  });

  it('no route can have a current Fare Signal and a no-fare fallback at the same time', () => {
    for (const route of routes) {
      const signal = getFareSignalForRoute(route.slug, '2026-08-13');
      expect(signal.state === 'current' && shouldShowNoFareFallback(signal), route.slug).toBe(false);
    }
  });
});
