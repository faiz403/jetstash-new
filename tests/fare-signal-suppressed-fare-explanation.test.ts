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
  // MAN-ISB fare-evidence check (13 Sept 2026, founder-approved): a fresh,
  // genuine, non-suppressed direct PIA observation was appended, so this
  // route is no longer part of the suppressed-fare-explanation control set
  // it belonged to on 2 Sept. Its own dedicated regression coverage now
  // lives in tests/journey-choice-freeze-and-pia-fare.test.ts; this file
  // keeps a control here proving the OPPOSITE, equally important fact —
  // once suppressed evidence is replaced by a genuinely suitable one, the
  // ordinary "Fare spotted" template returns, exactly like manchester-dubai
  // below, never the suppressed-fare explanatory copy.
  it('MAN→ISB: no longer poor-itinerary-suppressed since the 13 September direct-PIA append; renders the ordinary Fare Signal, not the suppressed-fare explanation', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.noneReason).toBeNull();
    // 22 September 2026: the weekly sweep appended a newer suitable
    // observation (£533, Etihad, 1 stop), which the selector now prefers
    // over the 13 September direct-PIA fare. The point of this control is
    // unchanged — a suitable observation yields the ordinary template.
    expect(signal.observation?.price).toBe(533);
    expect(signal.observation?.airline).toBe('Etihad');

    const html = renderFareSignalForRoute('manchester-islamabad');
    expect(html).toContain('533');
    expect(html).not.toContain('Recent fares checked');
    expect(html).not.toContain('No current fare tracked');
  });

  // 16 Sept 2026 UPDATE (suitability walk — see
  // docs/project-control/fare-evidence/full-portfolio-controlled-batch-2026-09-15.md):
  // MAN→LHE's newest observation (25 Aug, £547, self-transfer) is STILL
  // poor and still archived exactly as before, but it is no longer the
  // whole story -- the selector now walks past it to an older, equally
  // current, suitable 18 August observation instead of failing the whole
  // route closed. See tests/fare-signal-poor-itinerary-suppression.test.ts
  // block 6/7 for the dedicated regression coverage of this exact route.
  it('MAN→LHE: resolves to its older suitable 18 August observation, not the suppressed-fare explanation -- the poor 25 August recheck stays in history but is skipped for representative selection', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.noneReason).toBeNull();
    // 22 September 2026: superseded by a newer suitable observation
    // (£650, Etihad). The 18 August fare stays in history; only the
    // selector's current choice moved forward.
    expect(signal.observation?.price).toBe(650);

    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).toContain('650');
    expect(html).not.toContain('Recent fares checked');
    expect(html).not.toContain('No current fare tracked.');
  });

  it('BHX→ATQ: same resolution -- its 19 August £603 observation is suitable and still current, so the selector walks to it instead of failing closed on the poor newest one', () => {
    const signal = getFareSignalForRoute('birmingham-amritsar', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.noneReason).toBeNull();
    // 22 September 2026: superseded by a newer suitable observation
    // (£1114, KLM/IndiGo). The 19 August fare stays in history.
    expect(signal.observation?.price).toBe(1114);

    const html = renderFareSignalForRoute('birmingham-amritsar');
    // Rendered with a thousands separator once the fare passes £999.
    expect(html).toContain('1,114');
    expect(html).not.toContain('Recent fares checked');
    expect(html).not.toContain('No current fare tracked.');
  });

  // MAN→DXB now also has a genuine, more-recent 16 Sept poor observation
  // (£267, founder decision, tracked in canonical history) -- the selector
  // correctly walks past it to the same suitable 8 September observation
  // this control has always checked, never surfacing the poor one and
  // never falling back further than the current-Economy pool allows.
  it('MAN→DXB control: still resolves to the real £420 current Fare Signal -- untouched by the newly-archived £267 poor observation, no suppressed-fare copy', () => {
    const signal = getFareSignalForRoute('manchester-dubai', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.noneReason).toBeNull();
    // 22 September 2026: now resolves to the first strict exact-airport
    // Manchester-Dubai fare (£379, genuinely landing at DXB). The £267
    // Sharjah record it used to walk past is methodology-excluded outright
    // as of that date, so it can no longer reach any public surface.
    expect(signal.observation?.price).toBe(379);

    const html = renderFareSignalForRoute('manchester-dubai');
    expect(html).toContain('379');
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
  // MAN-ISB fare-evidence check (13 Sept 2026): now un-suppressed, so
  // Book-By's own selection agrees with the generic Fare Signal on the
  // OPPOSITE fact from before — both now show a real observation, not a
  // suppression reason. Still the exact same "Book-By matches Fare Signal
  // exactly" invariant this describe block exists to prove.
  it('MAN→ISB (a Book-By priority route): latestObservation matches the generic Fare Signal\'s newly-swept £533 Etihad fare exactly, no suppression reason', () => {
    const snapshot = computeBookBySnapshot('manchester-islamabad', new Date(`${NOW_ISO}T12:00:00Z`));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.latestObservationNoneReason).toBeNull();
    expect(snapshot!.latestObservation?.price).toBe(533);

    const genericSignal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(snapshot!.latestObservation?.price).toBe(genericSignal.observation?.price);
    expect(snapshot!.latestObservationNoneReason).toBe(genericSignal.noneReason);
  });

  it('MAN→LHE (a Book-By priority route): same agreement -- both Book-By and Fare Signal now resolve to the same newly-swept £650 observation, no suppression reason', () => {
    const snapshot = computeBookBySnapshot('manchester-lahore', new Date(`${NOW_ISO}T12:00:00Z`));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.latestObservationNoneReason).toBeNull();
    expect(snapshot!.latestObservation?.price).toBe(650);
  });

  it('BHX→ATQ (a Book-By priority route): same agreement -- both resolve to the same newly-swept £1114 observation', () => {
    const snapshot = computeBookBySnapshot('birmingham-amritsar', new Date(`${NOW_ISO}T12:00:00Z`));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.latestObservationNoneReason).toBeNull();
    expect(snapshot!.latestObservation?.price).toBe(1114);
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
