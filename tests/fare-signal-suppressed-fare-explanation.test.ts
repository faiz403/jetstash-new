import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FareObservation } from '@/data/fare-observations';
import { getFareSignalForRoute, deriveFareSignal, selectRepresentativeObservation } from '@/lib/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';

function fixtureObservation(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    observedDate: '2026-08-25',
    price: 500,
    priceNote: 'return, per person, one adult',
    source: 'Example Airline',
    currency: 'GBP',
    departureDate: '2026-10-01',
    returnDate: '2026-10-15',
    comparisonEligibility: 'current',
    fareDirectness: 'connecting',
    ...overrides,
  };
}

/**
 * Suppressed-fare explanation (2 Sep 2026, founder-approved, traveller-POV
 * live product review). The review's strongest finding wasn't that JetStash
 * lacks fare data — it's that JetStash correctly refuses to promote poor
 * itinerary evidence (isPoorItinerarySuitability(), lib/fare-signal.ts) but
 * then explained that refusal badly: "No current fare tracked" reads, to a
 * first-time visitor, as "JetStash has no recent price data", when the
 * truth is closer to "JetStash checked recent fares, but the latest options
 * were poor multi-stop/self-transfer journeys, so it deliberately declined
 * to present them as representative."
 *
 * This is a copy/UX fix only: FareSignalNoneReason distinguishes the two
 * 'none' causes so both Fare Signal and Book-By can explain the specific
 * one, without changing isPoorItinerarySuitability(), Fare Signal
 * selection, Fare History contents, Fare Watcher, Standout Fare, or
 * Journey Choice. Fail-closed behaviour is unchanged either way — no price
 * is ever fabricated or promoted; only the explanation improves.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);

function renderFareSignalForRoute(slug: string, nowIso = NOW_ISO): string {
  const signal = getFareSignalForRoute(slug, nowIso);
  const html = renderToStaticMarkup(
    FareSignal({ signal, tripComUrl: getTripComRouteUrl(slug), routeSlug: slug })
  );
  return html.replace(/\s+/g, ' ');
}

describe('lib/fare-signal.ts — FareSignalNoneReason is tagged only when isPoorItinerarySuitability() is the actual cause', () => {
  it('a poor-itinerary current-Economy candidate is tagged poor-itinerary-suppressed', () => {
    const poor = fixtureObservation({ priceNote: 'self-transfer', outboundStops: 2, returnStops: 3 });
    const result = selectRepresentativeObservation([poor], NOW_ISO);
    expect(result.state).toBe('none');
    expect(result.noneReason).toBe('poor-itinerary-suppressed');
  });

  it('a poor-itinerary fallback (non-Economy / not-current) candidate is also tagged poor-itinerary-suppressed -- the second branch this file\'s own comment describes', () => {
    const poorBusinessOnly = fixtureObservation({ cabin: 'Business', priceNote: 'self-transfer', outboundStops: 2, returnStops: 0 });
    const result = selectRepresentativeObservation([poorBusinessOnly], NOW_ISO);
    expect(result.state).toBe('none');
    expect(result.noneReason).toBe('poor-itinerary-suppressed');
  });

  it('genuinely no observations at all leaves noneReason null -- never a false "recent fares checked" claim', () => {
    const result = selectRepresentativeObservation([], NOW_ISO);
    expect(result.state).toBe('none');
    expect(result.observation).toBeNull();
    expect(result.noneReason).toBeNull();
  });

  it('a clean (non-poor) observation is never tagged -- noneReason only ever accompanies state "none"', () => {
    const clean = fixtureObservation({ priceNote: 'single ticket, no self-transfer notice', outboundStops: 0, returnStops: 0 });
    const result = selectRepresentativeObservation([clean], NOW_ISO);
    expect(result.state).toBe('current');
    expect(result.noneReason).toBeNull();
  });

  it('deriveFareSignal threads noneReason through identically to selectRepresentativeObservation', () => {
    const poor = fixtureObservation({ priceNote: 'self-transfer', outboundStops: 3, returnStops: 3 });
    const signal = deriveFareSignal([poor], NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.noneReason).toBe('poor-itinerary-suppressed');
  });
});

describe('Live control cases against the real archive (2 Sep 2026)', () => {
  it('MAN→ISB: real archive is poor-itinerary-suppressed today, and the rendered Fare Signal explains why instead of claiming no data exists', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.noneReason).toBe('poor-itinerary-suppressed');

    const html = renderFareSignalForRoute('manchester-islamabad');
    expect(html).toContain('Recent fares checked');
    expect(html).toContain('extra stops or self-transfers');
    expect(html).toContain('href="#fare-history"');
    expect(html).toContain('See recent fare checks');
    expect(html).not.toContain('No current fare tracked.');
    // Never exposes internal terminology.
    expect(html.toLowerCase()).not.toMatch(/poor.itinerary|selector|fare watcher|representativeobservation|lifecycle/);
  });

  it('MAN→LHE: identical treatment -- architectural, not route-specific', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.noneReason).toBe('poor-itinerary-suppressed');

    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).toContain('Recent fares checked');
    expect(html).toContain('href="#fare-history"');
    expect(html).not.toContain('No current fare tracked.');
  });

  it('BHX→ATQ: same explanation applies -- its current state is caused by the identical poor-itinerary rule', () => {
    const signal = getFareSignalForRoute('birmingham-amritsar', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.noneReason).toBe('poor-itinerary-suppressed');

    const html = renderFareSignalForRoute('birmingham-amritsar');
    expect(html).toContain('Recent fares checked');
    expect(html).not.toContain('No current fare tracked.');
  });

  it('MAN→DXB control: the real £336 current Fare Signal is completely untouched -- no suppressed-fare copy, no methodology change', () => {
    const signal = getFareSignalForRoute('manchester-dubai', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.noneReason).toBeNull();
    expect(signal.observation?.price).toBe(336);

    const html = renderFareSignalForRoute('manchester-dubai');
    expect(html).toContain('336');
    expect(html).not.toContain('Recent fares checked');
    expect(html).not.toContain('No current fare tracked');
  });

  it('genuine no-evidence control (birmingham-ahmedabad): retains the plain "No current fare tracked" copy -- never falsely claims recent fares were checked', () => {
    const signal = getFareSignalForRoute('birmingham-ahmedabad', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.noneReason).toBeNull();

    const html = renderFareSignalForRoute('birmingham-ahmedabad');
    expect(html).toContain('No current fare tracked.');
    expect(html).not.toContain('Recent fares checked');
  });
});

describe('lib/booking-intelligence.ts — Book-By carries the identical reason for the same shared selection', () => {
  it('MAN→ISB (a Book-By priority route): latestObservationNoneReason is poor-itinerary-suppressed, matching the generic Fare Signal exactly', () => {
    const snapshot = computeBookBySnapshot('manchester-islamabad', new Date(`${NOW_ISO}T12:00:00Z`));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.latestObservation).toBeNull();
    expect(snapshot!.latestObservationNoneReason).toBe('poor-itinerary-suppressed');

    const genericSignal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(snapshot!.latestObservationNoneReason).toBe(genericSignal.noneReason);
  });

  it('MAN→LHE (a Book-By priority route): same agreement', () => {
    const snapshot = computeBookBySnapshot('manchester-lahore', new Date(`${NOW_ISO}T12:00:00Z`));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.latestObservationNoneReason).toBe('poor-itinerary-suppressed');
  });

  it('BHX→ATQ (a Book-By priority route): same agreement', () => {
    const snapshot = computeBookBySnapshot('birmingham-amritsar', new Date(`${NOW_ISO}T12:00:00Z`));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.latestObservationNoneReason).toBe('poor-itinerary-suppressed');
  });

  it('a synthetic snapshot with a genuine (non-suppressed) verified observation carries a null reason', () => {
    // Pure unit check on the shared selector, independent of any real
    // route's current archive state.
    const clean = fixtureObservation({ priceNote: 'single ticket, no self-transfer notice', outboundStops: 0, returnStops: 0 });
    const result = selectRepresentativeObservation([clean], NOW_ISO);
    expect(result.observation).not.toBeNull();
    expect(result.noneReason).toBeNull();
  });
});
