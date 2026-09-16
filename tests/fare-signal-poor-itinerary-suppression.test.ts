import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FareObservation } from '@/data/fare-observations';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import {
  isPoorItinerarySuitability,
  selectRepresentativeObservation,
  deriveFareSignal,
  getFareSignalForRoute,
} from '@/lib/fare-signal';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';
import { FareSignal } from '@/components/route/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { hasCurrentFareSignalAmongRoutes } from '@/lib/fare-signal';
import { routes, getRoutesByAirport, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getJourneyChoiceForRoute, JOURNEY_CHOICE_PILOT_ROUTE_SLUGS } from '@/lib/journey-choice-route-adapter';
import { getComparableOptionsByObservationIds } from '@/lib/smart-fare-route-adapter';
import { deriveJourneyChoice } from '@/lib/journey-choice';
import { deriveFareWindowReconciliation } from '@/lib/fare-window-reconciliation';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';
import { getFareSectionCopy } from '@/lib/fare-section-copy';

/**
 * Fare Signal poor-itinerary suppression (31 Aug 2026, Users 3 & 4
 * real-user validation). See lib/fare-signal.ts's own doc comment
 * (isPoorItinerarySuitability, selectRepresentativeObservation) for the
 * full reasoning. This file is the durable regression guard: the rule
 * itself (synthetic fixtures), the exact real-world cases it was built
 * for, and its explicitly-checked independence from Journey Choice, Fare
 * Watcher, Standout Fare and fare history.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);

// 1 September 2026 Tuesday weekly batch update: manchester-dubai and
// london-heathrow-jeddah each got a newer, currently-current observation
// with fewer than 2 stops per leg, which the isPoorItinerarySuitability
// rule does not match, so both un-suppressed. manchester-islamabad's own
// newest evidence (self-transfer, 4/3 stops) newly matched the rule and
// joined the suppressed set at that point.
//
// 13 September 2026: manchester-islamabad moved back OUT of this set —
// a fresh, genuinely non-suppressed direct PIA observation (nonstop, no
// self-transfer) became its newest evidence, honestly restoring its Fare
// Signal — see describe block 12 below for the fuller, real-consequence
// account on the one live Journey Choice pilot route.
//
// 16 September 2026 UPDATE (full-portfolio selector-impact review — see
// docs/project-control/fare-evidence/full-portfolio-controlled-batch-2026-09-15.md):
// selectRepresentativeObservation() now walks its candidate pool for the
// first SUITABLE observation instead of failing the whole pool closed the
// instant the newest one is poor (see that function's own doc comment).
// Every one of the four routes below turned out to have an older,
// already-fresh, already-eligible Economy observation elsewhere in the
// SAME current-Economy pool, so none of them are suppressed any more —
// this was the founder-approved, intended effect of that fix, not a
// regression. The constant is kept, renamed, as a named historical
// regression set: these four routes' Fare Signal must now correctly
// resolve to that older suitable observation, never fail closed, and
// never silently reach for a DIFFERENT cabin or a stale/out-of-window one
// to do it (see lib/fare-signal.ts's own regression tests for that
// specific safety property). `london-gatwick-doha` (used from block 6
// onward) is the current, genuine example of a route whose ENTIRE
// current-Economy pool is poor with no suitable fallback anywhere in it —
// it has exactly one observation, ever, and that observation is
// self-transfer with 2/3 stops.
const FORMERLY_SUPPRESSED_NOW_RESOLVE_TO_OLDER_SUITABLE_ROUTES = [
  'manchester-lahore',
  'birmingham-amritsar',
  'london-gatwick-amritsar',
  'birmingham-delhi',
];
const GENUINELY_SUPPRESSED_ROUTE = 'london-gatwick-doha';

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

describe('isPoorItinerarySuitability() -- the one suppression rule', () => {
  it('1. self-transfer=true AND 2+ stops on the outbound leg alone is poor', () => {
    expect(isPoorItinerarySuitability({ priceNote: 'return; self-transfer', outboundStops: 2, returnStops: 0 })).toBe(true);
  });

  it('1b. self-transfer=true AND 2+ stops on the return leg alone is poor', () => {
    expect(isPoorItinerarySuitability({ priceNote: 'return; self-transfer', outboundStops: 0, returnStops: 3 })).toBe(true);
  });

  it('2. self-transfer=true but fewer than 2 stops on both legs is NOT suppressed by this rule alone', () => {
    expect(isPoorItinerarySuitability({ priceNote: 'return; self-transfer', outboundStops: 1, returnStops: 1 })).toBe(false);
    expect(isPoorItinerarySuitability({ priceNote: 'return; self-transfer', outboundStops: 0, returnStops: 0 })).toBe(false);
  });

  it('3. 2+ stops but NOT self-transfer is NOT suppressed by this rule alone', () => {
    expect(isPoorItinerarySuitability({ priceNote: 'return; single ticket, no self-transfer notice', outboundStops: 3, returnStops: 3 })).toBe(false);
  });

  it('4. missing stop/self-transfer evidence is never silently treated as suitable -- and never silently treated as poor either; it simply cannot match this rule\'s condition, so an observation with no priceNote self-transfer mention and unset stops passes through unaffected, exactly as before this fix', () => {
    expect(isPoorItinerarySuitability({ priceNote: 'return, per person, ordinary text with no self-transfer mention', outboundStops: undefined, returnStops: undefined })).toBe(false);
    // This is a documented evidence gap (see lib/fare-signal.ts's own doc
    // comment), not a suitability certification -- the 68 legacy
    // observations with no structured stop data remain genuinely
    // UNKNOWN quality, not "proven safe".
  });
});

describe('5. suitability walk (16 Sept 2026): a poor current-Economy candidate is skipped in favour of an older SUITABLE candidate already inside the SAME eligible/current pool, but the pool itself is never widened to reach it', () => {
  it('A/C. a poor newest Economy observation is skipped; an older, still-current, still-eligible, suitable Economy observation in the SAME pool becomes representative', () => {
    const poorRecent = fixtureObservation({ id: 'poor-recent', observedDate: '2026-08-25', priceNote: 'self-transfer', outboundStops: 3, returnStops: 3 });
    const suitableOlder = fixtureObservation({ id: 'suitable-older', observedDate: '2026-08-10', priceNote: 'single ticket, no self-transfer notice', outboundStops: 1, returnStops: 1 });
    const { observation, state } = selectRepresentativeObservation([poorRecent, suitableOlder], NOW_ISO);
    expect(observation?.id).toBe('suitable-older');
    expect(state).toBe('current');
  });

  it('B. when the newest Economy observation is already suitable, it remains representative exactly as before -- the walk never overrides a good newest pick', () => {
    const suitableRecent = fixtureObservation({ id: 'suitable-recent', observedDate: '2026-08-25', priceNote: 'single ticket, no self-transfer notice', outboundStops: 1, returnStops: 1 });
    const suitableOlder = fixtureObservation({ id: 'suitable-older', observedDate: '2026-08-10', priceNote: 'single ticket, no self-transfer notice', outboundStops: 0, returnStops: 0 });
    const { observation } = selectRepresentativeObservation([suitableRecent, suitableOlder], NOW_ISO);
    expect(observation?.id).toBe('suitable-recent');
  });

  it('D. every member of the current-Economy pool is poor (multiple poor observations, no suitable one anywhere in the pool) -- fails closed exactly as before, never guesses at the least-bad option', () => {
    const poorNewer = fixtureObservation({ id: 'poor-newer', observedDate: '2026-08-25', priceNote: 'self-transfer', outboundStops: 3, returnStops: 3 });
    const poorOlder = fixtureObservation({ id: 'poor-older', observedDate: '2026-08-10', priceNote: 'self-transfer', outboundStops: 2, returnStops: 2 });
    const { observation, state, noneReason } = selectRepresentativeObservation([poorNewer, poorOlder], NOW_ISO);
    expect(observation).toBeNull();
    expect(state).toBe('none');
    expect(noneReason).toBe('poor-itinerary-suppressed');
  });

  it('E. a suitable observation exists in the raw evidence but OUTSIDE the current-Economy pool\'s own existing eligibility (here: stale, past OBSERVATION_FRESH_DAYS) -- must NOT be surfaced merely to dodge suppression; the pool\'s existing freshness rule is never relaxed by this fix', () => {
    const poorFresh = fixtureObservation({ id: 'poor-fresh', observedDate: NOW_ISO, priceNote: 'self-transfer', outboundStops: 3, returnStops: 3 });
    const staleSuitable = fixtureObservation({ id: 'stale-suitable', observedDate: '2025-01-01', priceNote: 'single ticket, no self-transfer notice', outboundStops: 0, returnStops: 0 });
    const { observation, state, noneReason } = selectRepresentativeObservation([poorFresh, staleSuitable], NOW_ISO);
    expect(observation).toBeNull();
    expect(state).toBe('none');
    expect(noneReason).toBe('poor-itinerary-suppressed');
  });

  it('does not fall through to a different cabin either -- the current-Economy pool is Economy-only by construction, so a clean Business observation can never stand in for a poor Economy pool', () => {
    const poorEconomy = fixtureObservation({ id: 'poor-economy', cabin: 'Economy', priceNote: 'self-transfer', outboundStops: 2, returnStops: 2 });
    const cleanBusiness = fixtureObservation({ id: 'clean-business', cabin: 'Business', price: 3000, observedDate: '2026-08-20', priceNote: 'single ticket', outboundStops: 0, returnStops: 0 });
    const { observation } = selectRepresentativeObservation([poorEconomy, cleanBusiness], NOW_ISO);
    expect(observation).toBeNull();
  });

  it('deriveFareSignal itself also returns none, not the raw observation, when the whole current-Economy pool is poor -- and tags noneReason so callers can explain the suppression rather than claim no evidence exists', () => {
    const poor = fixtureObservation({ priceNote: 'self-transfer', outboundStops: 2, returnStops: 3 });
    const signal = deriveFareSignal([poor], NOW_ISO);
    expect(signal).toEqual({ state: 'none', observation: null, freshness: null, strongerSignal: null, noneReason: 'poor-itinerary-suppressed' });
  });

  it('deriveFareSignal surfaces the walked-to suitable observation, not the raw poor newest one, when an older suitable pool member exists', () => {
    const poorRecent = fixtureObservation({ id: 'poor-recent', observedDate: '2026-08-25', priceNote: 'self-transfer', outboundStops: 3, returnStops: 3 });
    const suitableOlder = fixtureObservation({ id: 'suitable-older', observedDate: '2026-08-10', priceNote: 'single ticket, no self-transfer notice', outboundStops: 1, returnStops: 1 });
    const signal = deriveFareSignal([poorRecent, suitableOlder], NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe('suitable-older');
    expect(signal.noneReason).toBeNull();
  });
});

describe('6. exact regression cases: MAN-LHE and BHX-ATQ correctly resolve to their older suitable observation, not a suppressed none -- their poor newest observation is real, current, and STILL the newest, but it is no longer the whole story', () => {
  it('manchester-lahore resolves to its 18 August £628 observation -- the poor 25 August recheck stays in history but is skipped for representative selection', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe('obs-man-lhe-economy-20260818-8w-v1');
    expect(signal.observation?.price).toBe(628);
    expect(signal.noneReason).toBeNull();
  });

  it('birmingham-amritsar resolves to its 19 August £603 observation for the same reason', () => {
    const signal = getFareSignalForRoute('birmingham-amritsar', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe('obs-bhx-atq-economy-20260819-8w-v1');
    expect(signal.observation?.price).toBe(603);
    expect(signal.noneReason).toBeNull();
  });
});

describe('7. the four originally-flagged routes now correctly resolve to an older suitable observation instead of failing closed -- and a genuinely fully-poor route (no suitable observation anywhere in its history) still fails closed exactly as before', () => {
  it.each(FORMERLY_SUPPRESSED_NOW_RESOLVE_TO_OLDER_SUITABLE_ROUTES)('%s has a current Fare Signal, not a suppressed one -- its poor newest observation was correctly skipped in favour of an older, still-eligible, suitable one from the same pool', (slug) => {
    const signal = getFareSignalForRoute(slug, NOW_ISO);
    expect(signal.state, slug).toBe('current');
    expect(signal.observation, slug).not.toBeNull();
    expect(signal.noneReason, slug).toBeNull();
  });

  it(`${GENUINELY_SUPPRESSED_ROUTE} has no current Fare Signal -- its only observation, ever, is self-transfer with 2+ stops per leg, so there is no suitable fallback anywhere in its own current-Economy pool`, () => {
    const signal = getFareSignalForRoute(GENUINELY_SUPPRESSED_ROUTE, NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
    expect(signal.noneReason).toBe('poor-itinerary-suppressed');
  });
});

// 1 September 2026 Tuesday weekly batch: this is the direct, symmetric
// counterpart to block 7 above for the two routes that moved OUT of
// KNOWN_SUPPRESSED_ROUTES this batch (manchester-dubai, london-heathrow-
// jeddah) -- explicit, dedicated coverage that they are genuinely current
// now, not merely inferred from their absence in block 7's it.each list.
describe('7b. manchester-dubai and london-heathrow-jeddah correctly un-suppressed on 1 September 2026 -- their newest evidence has fewer than 2 stops per leg', () => {
  it.each(['manchester-dubai', 'london-heathrow-jeddah'])('%s has a current Fare Signal whose observation does not match the poor-itinerary signature', (slug) => {
    const signal = getFareSignalForRoute(slug, NOW_ISO);
    expect(signal.state, slug).toBe('current');
    expect(signal.observation, slug).not.toBeNull();
    // FareSignalObservation (the projection getFareSignalForRoute returns)
    // exposes the already-derived isSelfTransfer boolean, not the raw
    // priceNote isPoorItinerarySuitability() itself reads -- reproducing
    // its exact stops/self-transfer formula here against that projection
    // proves the same real rule the representative-selection choke point
    // applies, without needing the raw FareObservation.
    const poor = signal.observation!.isSelfTransfer && ((signal.observation!.outboundStops ?? 0) >= 2 || (signal.observation!.returnStops ?? 0) >= 2);
    expect(poor, slug).toBe(false);
  });
});

describe('8. a representative unaffected route continues to show its existing Fare Signal', () => {
  it('manchester-antalya is untouched', () => {
    const signal = getFareSignalForRoute('manchester-antalya', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
  });
});

describe('9 & 10. fare history and underlying observations remain fully intact regardless of representative selection -- a poor observation is archived history, visible in Fare History, whether or not it happens to be the representative', () => {
  it.each([...FORMERLY_SUPPRESSED_NOW_RESOLVE_TO_OLDER_SUITABLE_ROUTES, GENUINELY_SUPPRESSED_ROUTE])('%s: publishable observations still exist and render in Fare History, regardless of what Fare Signal shows', (slug) => {
    const observations = getPublishableObservationsByRoute(slug, NOW_ISO);
    expect(observations.length, slug).toBeGreaterThan(0);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    // At least one price from the archive renders in the history panel.
    const anyPriceRendered = observations.some((o) => html.includes(`£${o.price.toLocaleString('en-GB')}`));
    expect(anyPriceRendered, slug).toBe(true);
  });

  it('the raw archive entries themselves are byte-for-byte unchanged -- suppression (and the suitability walk that replaced its old fails-closed-only behaviour) is a selection-time decision, never a data mutation. manchester-lahore\'s poor 25 August recheck is STILL in the archive, unedited, even though its 18 August observation is now the representative', () => {
    const manLhe = fareObservations.find((o) => o.id === 'obs-man-lhe-economy-20260825-recheck-v1');
    expect(manLhe).toBeDefined();
    expect(manLhe!.price).toBe(547);
    expect(manLhe!.outboundStops).toBe(2);
    expect(manLhe!.returnStops).toBe(3);
    // MAN→ISB £475 and MAN→DXB £267 (16 Sept 2026, founder decision: every
    // genuinely observed fare must be tracked in canonical history) are the
    // newest, most direct proof of this same principle -- both remain in
    // the archive exactly as observed, neither is the public representative.
    const manIsb = fareObservations.find((o) => o.id === 'obs-man-isb-economy-20260915-8w-v1');
    const manDxb = fareObservations.find((o) => o.id === 'obs-man-dxb-economy-20260915-8w-v1');
    expect(manIsb?.price).toBe(475);
    expect(manDxb?.price).toBe(267);
  });
});

describe('11. route-vs-fare mismatch behaviour', () => {
  // Mirrors tests/business-fare-evidence-batch-1.test.ts's and
  // tests/fare-signal-route-vs-fare-clarity.test.ts's own established
  // pattern: routeVsFareMismatch() only fires when routeDirectness,
  // routeStatusLabel and routeAirlineLabel are actually supplied -- a
  // render call missing these props can never produce a callout
  // regardless of whether a real mismatch exists, which would make a
  // "callout still fires" proof meaningless. This helper supplies them
  // from the same real route presentation the production page itself
  // uses.
  function renderFareSignalForRoute(slug: string): string {
    const route = getRouteBySlug(slug)!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    const airlines = getAirlinesBySlugs(presentation.airlineSlugs);
    const signal = getFareSignalForRoute(slug, NOW_ISO);
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

  it(`${GENUINELY_SUPPRESSED_ROUTE} no longer renders a Fare Signal or a mismatch callout -- there is nothing left to mismatch against`, () => {
    // Suppressed-fare explanation (2 Sep 2026, traveller-POV live product
    // review): a genuinely-suppressed route renders the explanatory
    // "Recent fares checked" copy instead of the plain "No current fare
    // tracked" it used to.
    const html = renderFareSignalForRoute(GENUINELY_SUPPRESSED_ROUTE);
    expect(html).toMatch(/Recent fares checked|Fare spotted/);
    expect(html).not.toContain('Route service');
  });

  it.each(FORMERLY_SUPPRESSED_NOW_RESOLVE_TO_OLDER_SUITABLE_ROUTES)('%s now renders its ordinary current Fare Signal (the suitability walk found it an older suitable observation) -- no longer the suppressed-fare explanation copy', (slug) => {
    const html = renderFareSignalForRoute(slug);
    expect(html, slug).toContain('Fare spotted');
    expect(html, slug).not.toContain('Recent fares checked');
  });

  it('an unaffected route (glasgow-bodrum, verified direct, matching direct fare) still renders its ordinary Fare Signal with no mismatch callout, exactly as before this fix', () => {
    const html = renderFareSignalForRoute('glasgow-bodrum');
    expect(html).toContain('Fare spotted');
    expect(html).not.toContain('Route service');
  });

  it('D. an unaffected route WITH a genuine, currently-live route-vs-fare mismatch (manchester-lahore: route verified direct, current suitable fare a connecting itinerary) still renders the full mismatch disclosure, unchanged by this fix', () => {
    // 16 Sept 2026 UPDATE: manchester-barcelona's own newest observation
    // (16 Sept, non-stop, direct) resolved its previous mismatch honestly,
    // so it no longer demonstrates one -- a real, evidence-driven
    // resolution, not a regression. manchester-lahore is a live substitute
    // with the same shape: verified direct, but its own representative
    // observation (18 August, the same one block 6 above proves) is
    // genuinely connecting, with no self-transfer/2+-stop signature, so it
    // is a real mismatch, not a poor-itinerary-suppressed one.
    const route = getRouteBySlug('manchester-lahore')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
    expect(signal.observation!.directness).toBe('connecting');
    // Confirms this route genuinely does not match the suppression
    // signature -- the mismatch case being proven here is a different,
    // pre-existing product concern, unaffected by this fix.
    const { isSelfTransfer, outboundStops, returnStops } = signal.observation!;
    expect(isSelfTransfer && ((outboundStops ?? 0) >= 2 || (returnStops ?? 0) >= 2)).toBe(false);

    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).toContain('Fare spotted');
    expect(html).toContain('Route service');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
  });
});

// Round 1 closure (14 Sept 2026, founder-approved): manchester-islamabad's
// pilot was retired from the live page — see lib/journey-choice-route-
// adapter.ts's own doc comment. The frozen derivation this block protects
// remains fully testable via the same frozen IDs directly.
const FROZEN_MAN_ISB_IDS = [
  'obs-man-isb-economy-20260811-8w-v1',
  'obs-man-isb-economy-20260810-tk-626-v1',
  'obs-man-isb-economy-20260810-tk-621-v1',
];
function frozenManIsbJourneyChoice(nowIso: string) {
  return deriveJourneyChoice(getComparableOptionsByObservationIds('manchester-islamabad', FROZEN_MAN_ISB_IDS, nowIso));
}

describe('12. MAN-ISB Journey Choice pilot: Journey Choice itself stays frozen throughout, independent of whatever its Fare Signal display is doing', () => {
  it('the pilot allowlist is empty today — Round 1 closed 14 Sept 2026, not deleted', () => {
    expect(JOURNEY_CHOICE_PILOT_ROUTE_SLUGS).toEqual([]);
    expect(getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)).toBeNull();
  });

  // Real-evidence arc: manchester-islamabad's Fare Signal was genuinely
  // current on 31 August (25 August Riyadh Air fare), genuinely suppressed
  // from 1 September (that batch's newest evidence was self-transfer,
  // 4/3 stops -- the exact "strong price movement, poor itinerary" case
  // the founder flagged when approving that batch), and genuinely current
  // again from 13 September (a fresh, non-suppressed direct PIA
  // observation -- see tests/journey-choice-freeze-and-pia-fare.test.ts
  // for that append's own dedicated coverage). None of these are
  // regressions; each is the suppression rule and the ordinary fare
  // archive correctly reflecting real, changing evidence.
  it('A. manchester-islamabad\'s Fare Signal has recovered from suppression -- its 13 September direct-PIA evidence no longer matches the suppression signature', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
    expect(signal.observation?.price).toBe(870);
    expect(signal.noneReason).toBeNull();
  });

  it('A. Journey Choice data for manchester-islamabad is unaffected -- it is derived entirely independently of Fare Signal (the ID-pinned frozen selection in lib/journey-choice-route-adapter.ts, never lib/fare-signal.ts)', () => {
    const journeyChoice = frozenManIsbJourneyChoice(NOW_ISO);
    expect(journeyChoice).not.toBeNull();
    expect(journeyChoice!.lowerFare).toBeDefined();
    expect(journeyChoice!.fasterJourney).toBeDefined();
  });

  // Founder-requested explicit before/after proof (originally PR #204,
  // extended 13 Sept 2026 with a third checkpoint): the whole journeyChoice
  // object -- lowerFare, fasterJourney, decision sentence, otherOptions,
  // baggageCostConfirmedForAllOptions -- is byte-for-byte identical at 31
  // August (before the 1 September suppression), at 8 September (while
  // still suppressed), and at NOW_ISO (after the 13 September recovery).
  // Its own frozen ID-pinned selection can never be affected by ANY of
  // this Fare Signal history -- proven directly here across all three
  // real, distinct evidence states, not just asserted in prose.
  it('A. Journey Choice data for manchester-islamabad is byte-for-byte identical across its Fare Signal\'s full suppressed-then-recovered arc -- lowerFare, fasterJourney, decision sentence, otherOptions, all unchanged', () => {
    const beforeSuppression = frozenManIsbJourneyChoice('2026-08-31');
    const whileSuppressed = frozenManIsbJourneyChoice('2026-09-08');
    const afterRecovery = frozenManIsbJourneyChoice(NOW_ISO);
    expect(beforeSuppression).not.toBeNull();
    expect(whileSuppressed).not.toBeNull();
    expect(afterRecovery).not.toBeNull();
    expect(JSON.stringify(whileSuppressed)).toBe(JSON.stringify(beforeSuppression));
    expect(JSON.stringify(afterRecovery)).toBe(JSON.stringify(beforeSuppression));
    expect(afterRecovery!.decision.sentence).toBe('£25 more saves 14h 15m of journey time.');
  });

  // Fare Window Reconciliation against a genuinely suppressed Fare Signal
  // is already covered generically in describe block B below (and against
  // manchester-lahore specifically) -- manchester-islamabad's own Fare
  // Signal is no longer suppressed, so it is no longer a fixture for that
  // specific null-observation case.

  // Proves the route page's own fare-section heading/caption (lib/fare-
  // section-copy.ts) now correctly takes its ordinary "has a current
  // representative fare" branch for manchester-islamabad, not the
  // suppressed-fare fallback it took between 1 and 13 September -- not new
  // copy invented for this route, not a contradiction next to Journey
  // Choice's own independent comparison below it on the page.
  it('A. the route page\'s fare-section copy now reflects the current £870 direct PIA fare, not the suppressed-fare fallback', () => {
    const fareObservations = getPublishableObservationsByRoute('manchester-islamabad', NOW_ISO);
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(fareObservations.length).toBeGreaterThan(0);
    expect(signal.state).not.toBe('none');
    const copy = getFareSectionCopy(fareObservations.length > 0, false, signal.state !== 'none');
    expect(copy).not.toEqual({
      heading: 'Fare history',
      caption: 'Previous tracked checks are shown for context. JetStash does not currently have a representative fare for this route.',
    });
  });
});

describe('B. Fare Window Reconciliation fails closed when a Fare Signal is absent/suppressed -- no reconciliation sentence is ever produced from a missing/suppressed observation', () => {
  it('a null first window (Fare Signal absent or suppressed) produces no reconciliation at all', () => {
    const result = deriveFareWindowReconciliation(null, { departureDate: '2026-10-01', returnDate: '2026-10-15' });
    expect(result).toBeNull();
  });

  it('a suppressed real route\'s own (null) Fare Signal observation, fed directly into the reconciliation function, produces no reconciliation', () => {
    const signal = getFareSignalForRoute(GENUINELY_SUPPRESSED_ROUTE, NOW_ISO);
    expect(signal.observation).toBeNull();
    const result = deriveFareWindowReconciliation(signal.observation, { departureDate: '2026-10-01', returnDate: '2026-10-15' });
    expect(result).toBeNull();
  });

  it('an undefined second window also produces no reconciliation (both sides must be present)', () => {
    const result = deriveFareWindowReconciliation({ departureDate: '2026-10-01', returnDate: '2026-10-15' }, undefined);
    expect(result).toBeNull();
  });
});

describe('C. customer-facing aggregate consequences honestly stop counting suppressed Fare Signals', () => {
  it('hasCurrentFareSignalAmongRoutes is false across a scope containing only genuinely-suppressed routes', () => {
    expect(hasCurrentFareSignalAmongRoutes([GENUINELY_SUPPRESSED_ROUTE], NOW_ISO)).toBe(false);
  });

  it('hasCurrentFareSignalAmongRoutes is true for an airport scope that includes at least one current route (Birmingham: every one of its routes now correctly resolves to a current Fare Signal after the suitability walk, birmingham-amritsar and birmingham-delhi included)', () => {
    const birminghamRoutes = getRoutesByAirport('birmingham').map((r) => r.slug);
    expect(birminghamRoutes.length).toBeGreaterThan(2);
    expect(hasCurrentFareSignalAmongRoutes(birminghamRoutes, NOW_ISO)).toBe(true);
  });
});

describe('13. Standout Fare is unaffected -- its own qualification path never calls deriveFareSignal/selectRepresentativeObservation', () => {
  // manchester-islamabad does have one raw, non-revoked approval record
  // (standout-manchester-islamabad-2026-08-25, data/standout-fare-
  // approvals.ts) -- so the "no approval record exists" version of this
  // assertion is no longer literally true and would be dishonest to keep.
  // The guarantee that actually matters -- that Fare Signal suppression (or
  // now, the suitability walk) isn't masking a Standout Fare that would
  // otherwise be live -- is proven directly below via the real function:
  // the approval's own detectionObservationId identity has been superseded
  // by newer evidence (Fare Watcher's pre-existing verified-candidate-
  // price-integrity mechanism, unrelated to this suppression rule), so it
  // already resolves to no live candidate regardless of Fare Signal's own
  // state. Keeping these two decisions separate -- Fare Signal selection
  // and Standout Fare's own supersession -- is exactly what this test now
  // checks, for the one route (manchester-islamabad) and the one
  // genuinely-suppressed route this file otherwise exercises.
  it('no Standout Fare approval among these routes resolves to a live candidate -- confirmed via the real function, not inferred from raw revokedDate', () => {
    const checkRouteSlugs = new Set([...FORMERLY_SUPPRESSED_NOW_RESOLVE_TO_OLDER_SUITABLE_ROUTES, GENUINELY_SUPPRESSED_ROUTE, 'manchester-islamabad']);
    for (const approval of standoutFareApprovals) {
      if (!checkRouteSlugs.has(approval.routeSlug) || approval.revokedDate) continue;
      const live = getApprovedStandoutFare(approval.routeSlug, approval.cabin, fareObservations, NOW_ISO);
      expect(live, approval.id).toBeNull();
    }
  });

  it('getApprovedStandoutFare() still correctly returns null for the three routes previously proven ordinary (manchester-lahore, london-heathrow-jeddah, birmingham-amritsar), exactly as before this fix -- see tests/standout-fare.test.ts for the full account, including the rendered-HTML proof', () => {
    for (const slug of ['manchester-lahore', 'london-heathrow-jeddah', 'birmingham-amritsar']) {
      expect(getApprovedStandoutFare(slug, 'Economy', fareObservations, NOW_ISO), slug).toBeNull();
    }
  });
});

describe('Coverage reconciliation, frozen at 2026-08-31 (the original audit\'s own evaluation date) -- deterministic, never the moving clock', () => {
  // Traces the exact 81-vs-83 discrepancy raised during review, with a
  // FIXED reference date rather than a live one, so this catalogue count
  // can never silently shift as real time passes.
  //
  // The original read-only Fare Signal audit (main @ c62399a) evaluated
  // coverage as of 2026-08-31 and found 81 current / 7 none. A later
  // implementation report incorrectly quoted tests/fare-signal.test.ts's
  // own separate fixed-reference-date (2026-08-14) count of 83/5 as if it
  // were that same figure -- it is a different, separately-correct fact
  // about a different, historical date, not a data change.
  //
  // UPDATE, 16 Sept 2026 (full-portfolio selector-impact review — see
  // docs/project-control/fare-evidence/full-portfolio-controlled-batch-2026-09-15.md):
  // this block used to also assert a SEPARATE "post-suppression" 74/15
  // figure, reconstructing what the 31 Aug fails-closed-on-newest-only
  // suppression policy did at this date. That policy no longer exists —
  // the suitability walk (see selectRepresentativeObservation()'s own doc
  // comment) skips a poor newest observation in favour of an older,
  // already-eligible, already-fresh-as-of-this-date suitable one from the
  // SAME candidate pool, rather than failing the whole pool closed
  // immediately. Recomputed directly against the real archive: every one
  // of the seven originally-flagged routes already had an older suitable
  // observation that was ALSO fresh as of 31 August 2026, so the corrected
  // algorithm does not suppress any of them even at this frozen historical
  // date — coverage at 31 August is now, correctly, identical to the
  // pre-suppression-era baseline (81 current / 8 none), not a separate
  // "post-suppression" figure. This is the suitability walk itself proving
  // out against real historical evidence, not a data change — no
  // observation dated on or before 31 August was added, removed or edited
  // by this session.
  const AUDIT_REFERENCE_DATE = '2026-08-31';

  // The seven routes the original 31 Aug policy flagged. Kept as its own
  // list (not the live, file-level KNOWN_SUPPRESSED_ROUTES constant, which
  // reflects today's clock) purely as a named regression set: the point of
  // the test below is that every one of these seven is now correctly
  // 'current' at this frozen date, not 'none'.
  const ORIGINALLY_FLAGGED_ROUTES = [
    'manchester-lahore',
    'birmingham-amritsar',
    'manchester-dubai',
    'london-heathrow-doha',
    'london-heathrow-jeddah',
    'london-gatwick-amritsar',
    'birmingham-delhi',
  ];

  it('Fare Signal coverage at the frozen audit date is exactly 81 current / 8 none -- identical to the pre-suppression-era baseline, because the suitability walk correctly finds each of the seven originally-flagged routes an older, already-fresh-as-of-this-date suitable observation instead of failing closed', () => {
    const allSignals = routes.map((route) => getFareSignalForRoute(route.slug, AUDIT_REFERENCE_DATE));
    const currentCount = allSignals.filter((s) => s.state === 'current').length;
    const noneCount = allSignals.filter((s) => s.state === 'none').length;
    for (const slug of ORIGINALLY_FLAGGED_ROUTES) {
      expect(getFareSignalForRoute(slug, AUDIT_REFERENCE_DATE).state, slug).toBe('current');
    }
    expect(currentCount).toBe(81);
    expect(allSignals.filter((s) => s.state === 'recent').length).toBe(0);
    expect(noneCount).toBe(8);
  });

  it('the eight routes still genuinely showing no current fare at the frozen audit date are a completely different set from the seven originally-flagged ones -- routes with no Economy evidence at all as of this date, or none of it suitable and none of it with an older fresh alternative, never the seven whose only problem was a poor NEWEST observation', () => {
    const noneSlugs = routes
      .filter((route) => getFareSignalForRoute(route.slug, AUDIT_REFERENCE_DATE).state === 'none')
      .map((route) => route.slug)
      .sort();
    for (const slug of ORIGINALLY_FLAGGED_ROUTES) {
      expect(noneSlugs, slug).not.toContain(slug);
    }
    expect(noneSlugs).toHaveLength(8);
  });
});
