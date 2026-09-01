import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  fareObservations,
  getPublishableObservationsByRoute,
  getObservationsByRoute,
} from '@/data/fare-observations';
import {
  isPoorItinerarySuitability,
  selectRepresentativeObservation,
  getFareSignalForRoute,
} from '@/lib/fare-signal';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';
import { FareSignal } from '@/components/route/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { getJourneyChoiceForRoute, JOURNEY_CHOICE_PILOT_ROUTE_SLUGS } from '@/lib/journey-choice-route-adapter';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';

/**
 * Manchester-Dubai representative-direct-fare pilot (1 September 2026,
 * founder-approved). Following the 31 Aug 2026 Fare Signal poor-itinerary
 * suppression fix and the 1 Sep 2026 Fare History coherence fix,
 * manchester-dubai's existing cheapest-visible-candidate series
 * (manchester-dubai-economy-1adult-baseline-v1) had, three checks running,
 * surfaced only self-transfer/connecting itineraries -- correctly
 * suppressed, but leaving the route showing "no current fare tracked"
 * despite Emirates verifiably operating the route direct 21x/week. This
 * pilot adds one genuinely representative direct Emirates observation
 * under a deliberately NEW, separate profileId (never the baseline one --
 * see FARE_OBSERVATION_ARCHIVE.md's "Manchester-Dubai representative-
 * direct-fare pilot" section for the full evidence and reasoning) and
 * proves it flows through every downstream surface correctly, without any
 * product code change anywhere.
 */

const NEW_OBS_ID = 'obs-man-dxb-economy-20260901-representative-direct-v1';
const OLD_BASELINE_OBS_ID = 'obs-man-dxb-economy-20260825-8w-v1';
const BASELINE_PROFILE_ID = 'manchester-dubai-economy-1adult-baseline-v1';
const REPRESENTATIVE_DIRECT_PROFILE_ID = 'manchester-dubai-economy-1adult-representative-direct-v1';

// Fixed, literal reference date -- deliberately not the live clock (see the
// determinism standard established in tests/fare-history-coherence.test.ts
// and tests/fare-signal-poor-itinerary-suppression.test.ts). Chosen to
// equal the new observation's own observedDate: fare-observation selection
// has no observedDate-vs-nowIso gate (a pre-existing characteristic of
// getFareSignalForRoute, confirmed while building this pilot -- not
// something this pilot changed), so every assertion below would hold
// identically at any fixed date; this one is simply the most natural,
// permanently-reproducible choice.
const FIXED_TODAY = '2026-09-01';

describe('1. The new observation is preserved correctly in the archive', () => {
  const obs = fareObservations.find((o) => o.id === NEW_OBS_ID);

  it('exists with the exact recorded fields', () => {
    expect(obs).toBeDefined();
    expect(obs!.routeSlug).toBe('manchester-dubai');
    expect(obs!.cabin).toBe('Economy');
    expect(obs!.price).toBe(755);
    expect(obs!.source).toBe('Emirates');
    expect(obs!.observedDate).toBe('2026-09-01');
    expect(obs!.departureDate).toBe('2026-10-20');
    expect(obs!.returnDate).toBe('2026-11-03');
    expect(obs!.currency).toBe('GBP');
  });

  it('directness = direct, both legs', () => {
    expect(obs!.fareDirectness).toBe('direct');
    expect(obs!.outboundDirectness).toBe('direct');
    expect(obs!.returnDirectness).toBe('direct');
  });

  it('outboundStops = 0, returnStops = 0', () => {
    expect(obs!.outboundStops).toBe(0);
    expect(obs!.returnStops).toBe(0);
  });

  it('self-transfer = false (isPoorItinerarySuitability sees no self-transfer wording)', () => {
    expect(isPoorItinerarySuitability(obs!)).toBe(false);
  });

  it('baggage is recorded as explicitly evidenced, never assumed', () => {
    expect(obs!.baggage).toMatch(/1 free carry-on/);
    expect(obs!.baggage).toMatch(/1st checked bag free/);
  });
});

describe('2. The new profileId is a deliberately separate series from the cheapest-visible baseline', () => {
  it('the new observation carries a different profileId than every existing manchester-dubai Economy observation', () => {
    const newObs = fareObservations.find((o) => o.id === NEW_OBS_ID)!;
    expect(newObs.profileId).toBe(REPRESENTATIVE_DIRECT_PROFILE_ID);
    expect(newObs.profileId).not.toBe(BASELINE_PROFILE_ID);
  });

  it('the baseline series observations are completely untouched -- still exactly 3 with the baseline profileId', () => {
    const baselineSeries = fareObservations.filter(
      (o) => o.routeSlug === 'manchester-dubai' && o.cabin === 'Economy' && o.profileId === BASELINE_PROFILE_ID
    );
    expect(baselineSeries).toHaveLength(3);
    expect(baselineSeries.map((o) => o.price).sort((a, b) => a - b)).toEqual([314, 350, 480]);
  });

  it('the representative-direct series has exactly one observation', () => {
    const representativeSeries = fareObservations.filter(
      (o) => o.routeSlug === 'manchester-dubai' && o.cabin === 'Economy' && o.profileId === REPRESENTATIVE_DIRECT_PROFILE_ID
    );
    expect(representativeSeries).toHaveLength(1);
    expect(representativeSeries[0].id).toBe(NEW_OBS_ID);
  });
});

describe('3. Fare Signal selects the new representative observation -- Fare Signal no longer fails closed for manchester-dubai', () => {
  it('getFareSignalForRoute now returns state "current", backed by the new observation', () => {
    const signal = getFareSignalForRoute('manchester-dubai', FIXED_TODAY);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
    expect(signal.observation!.id).toBe(NEW_OBS_ID);
    expect(signal.observation!.price).toBe(755);
    expect(signal.observation!.airline).toBe('Emirates');
    expect(signal.observation!.directness).toBe('direct');
    expect(signal.observation!.outboundStops).toBe(0);
    expect(signal.observation!.returnStops).toBe(0);
    expect(signal.observation!.isSelfTransfer).toBe(false);
  });

  it('selectRepresentativeObservation resolves the same way when fed the route\'s own publishable observations directly', () => {
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    const { observation, state } = selectRepresentativeObservation(observations, FIXED_TODAY);
    expect(state).toBe('current');
    expect(observation?.id).toBe(NEW_OBS_ID);
  });
});

describe('4. Poor historical observations remain archived -- suppression is a selection-time decision, never a data mutation', () => {
  it('the raw baseline-series entries, including the poor-itinerary one, are byte-for-byte unchanged', () => {
    const oldObs = fareObservations.find((o) => o.id === OLD_BASELINE_OBS_ID);
    expect(oldObs).toBeDefined();
    expect(oldObs!.price).toBe(314);
    expect(oldObs!.outboundStops).toBe(2);
    expect(oldObs!.returnStops).toBe(2);
    expect(oldObs!.profileId).toBe(BASELINE_PROFILE_ID);
  });

  it('the old £314 observation, evaluated entirely on its own, is STILL correctly flagged poor-itinerary -- the suppression rule itself is completely unweakened', () => {
    const oldObs = fareObservations.find((o) => o.id === OLD_BASELINE_OBS_ID)!;
    expect(isPoorItinerarySuitability(oldObs)).toBe(true);
  });

  it('selecting a representative observation from ONLY the old baseline series (excluding the new pilot observation) still fails closed to "no current fare" -- proving the pilot\'s new "current" result comes from genuinely new evidence, not from the suppression gate being loosened', () => {
    const baselineOnly = getObservationsByRoute('manchester-dubai').filter((o) => o.profileId === BASELINE_PROFILE_ID);
    const { observation, state } = selectRepresentativeObservation(baselineOnly, FIXED_TODAY);
    expect(observation).toBeNull();
    expect(state).toBe('none');
  });
});

describe('5. Route-vs-fare mismatch does not render for the new direct fare', () => {
  function renderFareSignalForRoute(slug: string): string {
    const route = getRouteBySlug(slug)!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    const airlines = getAirlinesBySlugs(presentation.airlineSlugs);
    const signal = getFareSignalForRoute(slug, FIXED_TODAY);
    const html = renderToStaticMarkup(
      FareSignal({
        signal,
        tripComUrl: getTripComRouteUrl(slug),
        routeSlug: slug,
        routeDirectness: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null,
        routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
        routeAirlineLabel: airlines.length > 0 ? airlines.map((a) => a.name).join(', ') : null,
        routeServiceConnections: route.routeServiceConnections ?? null,
      })
    );
    return html.replace(/\s+/g, ' ');
  }

  it('renders the new current Fare Signal with no "Route service" mismatch callout -- the route\'s verified direct status now matches the fare\'s own direct evidence', () => {
    const presentation = getEffectiveRoutePresentation(getRouteBySlug('manchester-dubai')!, routeStatusEvents, FIXED_TODAY);
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('manchester-dubai', FIXED_TODAY);
    expect(signal.observation!.directness).toBe('direct');

    const html = renderFareSignalForRoute('manchester-dubai');
    expect(html).toContain('£755');
    expect(html).toContain('Emirates');
    expect(html).not.toContain('Route service');
    expect(html).not.toContain('different, connecting journey');
    expect(html).not.toContain('different, direct journey');
  });
});

describe('6. Fare History remains intact', () => {
  it('every publishable observation -- old and new -- still renders in FareHistoryPanel', () => {
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    expect(observations.length).toBe(4);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    for (const price of [314, 350, 480, 755]) {
      expect(html, `£${price}`).toContain(`£${price}`);
    }
  });

  it('FareHistoryPanel rows are unaffected by this pilot -- same row structure, same fields, as any other route', () => {
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toContain('Checked');
    expect(html).toContain('Travel dates:');
    expect(html).toContain('comparable check');
  });
});

describe('7. Fare Watcher does not mix the two profileId series as comparable', () => {
  it('generateFareWatcherCandidates groups strictly by (routeSlug, cabin, profileId) -- the new observation can never be compared against, or produce a candidate alongside, the baseline series', () => {
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    const candidates = generateFareWatcherCandidates(observations, FIXED_TODAY);
    // No candidate should ever be anchored to the new representative-direct
    // observation being compared against the baseline series' history --
    // its own profileId group has exactly one member, which is structurally
    // insufficient-baseline and produces no qualifying candidate at all.
    const candidateForNewObs = candidates.find((c) => c.verifiedObservation.id === NEW_OBS_ID);
    expect(candidateForNewObs).toBeUndefined();
  });
});

describe('8. Standout Fare remains unchanged', () => {
  it('no Standout Fare approval exists for manchester-dubai', () => {
    expect(standoutFareApprovals.some((a) => a.routeSlug === 'manchester-dubai' && !a.revokedDate)).toBe(false);
  });

  it('getApprovedStandoutFare returns null for manchester-dubai, regardless of this pilot\'s new evidence', () => {
    expect(getApprovedStandoutFare('manchester-dubai', 'Economy', fareObservations, FIXED_TODAY)).toBeNull();
  });
});

describe('9. Journey Choice remains unchanged -- scoped to manchester-islamabad only, by construction', () => {
  it('manchester-dubai is not a Journey Choice pilot route', () => {
    expect(JOURNEY_CHOICE_PILOT_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
    expect(getJourneyChoiceForRoute('manchester-dubai', FIXED_TODAY)).toBeNull();
  });

  it('manchester-islamabad\'s own Journey Choice is completely unaffected by this pilot', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', FIXED_TODAY);
    expect(journeyChoice).not.toBeNull();
  });
});
