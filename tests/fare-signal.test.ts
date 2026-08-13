import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/data/routes';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import type { FareObservation } from '@/data/fare-observations';
import { deriveFareSignal, getFareSignalForRoute } from '@/lib/fare-signal';
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
    expect(signal.observation?.price).toBe(601);
    expect(signal.observation?.airline).toBe('Etihad');
    expect(signal.observation?.observedDate).toBe('2026-08-11');
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
    const signal = getFareSignalForRoute('birmingham-lahore', '2026-08-11');
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
    expect(text).toContain('601');
    expect(text).toContain('Etihad');
    expect(text).toContain('Checked 11 August 2026');
    expect(text).toContain('Check current price');
    expect(text).toContain('Partner link, opens Trip.com in a new tab.');
    expect(text).not.toMatch(/baggage|£0|deal|cheap|cheapest|below average|good value|save/i);
  });

  it('renders a recent fare without calling it current or a deal', () => {
    const signal = deriveFareSignal([recentFixture], '2026-08-11');
    const text = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: 'fixture-route' }));
    expect(text).toContain('Last tracked fare');
    expect(text).toContain('Price may have changed.');
    expect(text).not.toContain('Fare spotted');
    expect(text).not.toMatch(/deal|cheap|cheapest|below average|good value|save/i);
  });

  it('renders no CTA when the route has no safe exact Trip.com link', () => {
    const signal = getFareSignalForRoute('london-heathrow-mumbai', '2026-08-11');
    const text = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('london-heathrow-mumbai'), routeSlug: 'london-heathrow-mumbai' }));
    expect(getTripComRouteUrl('london-heathrow-mumbai')).toBeNull();
    expect(text).not.toContain('Check current price');
    expect(text).not.toContain('Trip.com');
  });

  it('keeps the Fare Signal above Smart Fare Comparison and leaves the stricter verdict private', () => {
    const signalIndex = routePageSrc.indexOf('<FareSignal');
    const smartIndex = routePageSrc.indexOf('<SmartFareComparison');
    const historyIndex = routePageSrc.indexOf('<FareHistoryPanel');
    expect((routePageSrc.match(/<FareSignal/g) ?? []).length).toBe(1);
    expect(signalIndex).toBeLessThan(smartIndex);
    expect(smartIndex).toBeLessThan(historyIndex);
    expect(routePageSrc).toContain('getFareSignalForRoute(route.slug, nowIso)');
    expect(routePageSrc).not.toContain('deriveTripValueVerdict');
    expect(routePageSrc).not.toContain('True Trip Cost');
    expect(routePageSrc).not.toContain('Value Verdict');
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
  it('reports 22 routes with a current publishable fare and 66 without one at the current archive date. london-heathrow-mumbai\'s obs-lhr-bom-economy-2 (Virgin Atlantic, £491, observed 24 July 2026) has complete dates and passes isPubliclyPublishable(), so it counts toward the homepage\'s looser "23 of 88" stat (getPublishableObservationsByRoute) — but it predates the currency field becoming a standard part of every new observation (it was this project\'s very first FARE-001 pilot entry, before Batch A\'s field standard existed; see FARE_OBSERVATION_ARCHIVE.md\'s "migration accommodation" note on optional fields). No contemporaneous evidence note, source capture or archived source configuration for this entry states its currency, so `currency: \'GBP\'` was deliberately NOT added here — that would be retrospective inference from UK departure, not verified evidence, which the fare-observation standard does not allow. It stays a non-displayable "none" in Fare Signal until a real currency fact is confirmed.', () => {
    const signals = routes.map((route) => getFareSignalForRoute(route.slug, '2026-08-11'));
    expect(signals.filter((signal) => signal.state === 'current')).toHaveLength(22);
    expect(signals.filter((signal) => signal.state === 'recent')).toHaveLength(0);
    expect(signals.filter((signal) => signal.state === 'none')).toHaveLength(66);
    expect(routes.filter((route) => getTripComRouteUrl(route.slug)).length).toBe(45);
  });
});
