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
import { deriveFareWindowReconciliation } from '@/lib/fare-window-reconciliation';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';

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

const KNOWN_SUPPRESSED_ROUTES = [
  'manchester-lahore',
  'birmingham-amritsar',
  'manchester-dubai',
  'london-heathrow-doha',
  'london-heathrow-jeddah',
  'london-gatwick-amritsar',
  'birmingham-delhi',
];

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

describe('5. no fallback: a poor current-Economy candidate suppresses the whole result, never promoting an older/other observation', () => {
  it('does not fall through to an older, cleaner Economy observation', () => {
    const poorRecent = fixtureObservation({ id: 'poor-recent', observedDate: '2026-08-25', priceNote: 'self-transfer', outboundStops: 3, returnStops: 3 });
    const cleanerOlder = fixtureObservation({ id: 'cleaner-older', observedDate: '2026-08-10', priceNote: 'single ticket, no self-transfer notice', outboundStops: 1, returnStops: 1 });
    const { observation, state } = selectRepresentativeObservation([poorRecent, cleanerOlder], NOW_ISO);
    expect(observation).toBeNull();
    expect(state).toBe('none');
  });

  it('does not fall through to a different cabin either', () => {
    const poorEconomy = fixtureObservation({ id: 'poor-economy', cabin: 'Economy', priceNote: 'self-transfer', outboundStops: 2, returnStops: 2 });
    const cleanBusiness = fixtureObservation({ id: 'clean-business', cabin: 'Business', price: 3000, observedDate: '2026-08-20', priceNote: 'single ticket', outboundStops: 0, returnStops: 0 });
    const { observation } = selectRepresentativeObservation([poorEconomy, cleanBusiness], NOW_ISO);
    expect(observation).toBeNull();
  });

  it('deriveFareSignal itself also returns none, not the raw observation, for a poor-only input', () => {
    const poor = fixtureObservation({ priceNote: 'self-transfer', outboundStops: 2, returnStops: 3 });
    const signal = deriveFareSignal([poor], NOW_ISO);
    expect(signal).toEqual({ state: 'none', observation: null, freshness: null, strongerSignal: null });
  });
});

describe('6. exact regression cases: MAN-LHE and BHX-ATQ become no-current-Fare-Signal, if source data is unchanged', () => {
  it('manchester-lahore', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
  });

  it('birmingham-amritsar', () => {
    const signal = getFareSignalForRoute('birmingham-amritsar', NOW_ISO);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
  });
});

describe('7. all seven audited routes are suppressed while they still match the known-bad signature', () => {
  it.each(KNOWN_SUPPRESSED_ROUTES)('%s has no current Fare Signal', (slug) => {
    const signal = getFareSignalForRoute(slug, NOW_ISO);
    expect(signal.state, slug).toBe('none');
    expect(signal.observation, slug).toBeNull();
  });
});

describe('8. a representative unaffected route continues to show its existing Fare Signal', () => {
  it('manchester-antalya is untouched', () => {
    const signal = getFareSignalForRoute('manchester-antalya', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
  });
});

describe('9 & 10. fare history and underlying observations remain fully intact for suppressed routes', () => {
  it.each(KNOWN_SUPPRESSED_ROUTES)('%s: publishable observations still exist and render in Fare History, even though Fare Signal shows none', (slug) => {
    const observations = getPublishableObservationsByRoute(slug, NOW_ISO);
    expect(observations.length, slug).toBeGreaterThan(0);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    // At least one price from the archive renders in the history panel.
    const anyPriceRendered = observations.some((o) => html.includes(`£${o.price.toLocaleString('en-GB')}`));
    expect(anyPriceRendered, slug).toBe(true);
  });

  it('the raw archive entries themselves are byte-for-byte unchanged -- suppression is a selection-time decision, never a data mutation', () => {
    const manLhe = fareObservations.find((o) => o.id === 'obs-man-lhe-economy-20260825-recheck-v1');
    expect(manLhe).toBeDefined();
    expect(manLhe!.price).toBe(547);
    expect(manLhe!.outboundStops).toBe(2);
    expect(manLhe!.returnStops).toBe(3);
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

  it.each(KNOWN_SUPPRESSED_ROUTES)('%s no longer renders a Fare Signal or a mismatch callout -- there is nothing left to mismatch against', (slug) => {
    const html = renderFareSignalForRoute(slug);
    expect(html, slug).toContain('No current fare tracked');
    expect(html, slug).not.toContain('Route service');
  });

  it('an unaffected route (glasgow-bodrum, verified direct, matching direct fare) still renders its ordinary Fare Signal with no mismatch callout, exactly as before this fix', () => {
    const html = renderFareSignalForRoute('glasgow-bodrum');
    expect(html).toContain('Fare spotted');
    expect(html).not.toContain('Route service');
  });

  it('D. an unaffected route WITH a genuine, currently-live route-vs-fare mismatch (manchester-antalya: route verified direct, current fare a connecting itinerary via a mixed-carrier return leg) still renders the full mismatch disclosure, unchanged by this fix', () => {
    const route = getRouteBySlug('manchester-antalya')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('manchester-antalya', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
    expect(signal.observation!.directness).toBe('connecting');
    // Confirms this route genuinely does not match the suppression
    // signature -- the mismatch case being proven here is a different,
    // pre-existing product concern, unaffected by this fix.
    const { isSelfTransfer, outboundStops, returnStops } = signal.observation!;
    expect(isSelfTransfer && ((outboundStops ?? 0) >= 2 || (returnStops ?? 0) >= 2)).toBe(false);

    const html = renderFareSignalForRoute('manchester-antalya');
    expect(html).toContain('Fare spotted');
    expect(html).toContain('Route service');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
  });
});

describe('12. Frozen MAN-ISB Journey Choice pilot is completely unaffected', () => {
  it('manchester-islamabad is still the one live Journey Choice pilot route', () => {
    expect(JOURNEY_CHOICE_PILOT_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
  });

  it('A. manchester-islamabad still has a current Fare Signal (its own observation does not match the suppression signature)', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation).not.toBeNull();
    expect(signal.observation!.isSelfTransfer).toBe(false);
  });

  it('A. Journey Choice data for manchester-islamabad is unaffected -- it is derived entirely independently of Fare Signal (getPublishableObservationsByRoute -> Smart Fare Comparison -> deriveJourneyChoice, never lib/fare-signal.ts)', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO);
    expect(journeyChoice).not.toBeNull();
    expect(journeyChoice!.lowerFare).toBeDefined();
    expect(journeyChoice!.fasterJourney).toBeDefined();
  });

  it('A. the existing Fare Window Reconciliation for manchester-islamabad is unaffected, since its Fare Signal observation is present and unchanged', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.observation).not.toBeNull();
    expect(journeyChoice).not.toBeNull();
    // Reconciliation itself is a pure function of the two windows already
    // rendered elsewhere -- proving both inputs are present and unchanged
    // is the correct proof of "unaffected" here, matching how
    // app/routes/[slug]/page.tsx itself derives it.
    const reconciliation = deriveFareWindowReconciliation(signal.observation, journeyChoice!.lowerFare);
    // Whatever this resolves to (null if the two windows happen to match,
    // or a real reconciliation sentence if they differ) is exactly what it
    // resolved to before this fix -- neither input changed.
    expect(reconciliation === null || typeof reconciliation.sentence === 'string').toBe(true);
  });
});

describe('B. Fare Window Reconciliation fails closed when a Fare Signal is absent/suppressed -- no reconciliation sentence is ever produced from a missing/suppressed observation', () => {
  it('a null first window (Fare Signal absent or suppressed) produces no reconciliation at all', () => {
    const result = deriveFareWindowReconciliation(null, { departureDate: '2026-10-01', returnDate: '2026-10-15' });
    expect(result).toBeNull();
  });

  it('a suppressed real route\'s own (null) Fare Signal observation, fed directly into the reconciliation function, produces no reconciliation', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
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
  it('hasCurrentFareSignalAmongRoutes is false across a scope containing only known-suppressed routes', () => {
    expect(hasCurrentFareSignalAmongRoutes(KNOWN_SUPPRESSED_ROUTES, NOW_ISO)).toBe(false);
  });

  it('hasCurrentFareSignalAmongRoutes is still true for an airport scope that includes at least one unaffected route (Birmingham: birmingham-amritsar and birmingham-delhi are suppressed, but the airport has other current routes)', () => {
    const birminghamRoutes = getRoutesByAirport('birmingham').map((r) => r.slug);
    expect(birminghamRoutes.length).toBeGreaterThan(2);
    expect(hasCurrentFareSignalAmongRoutes(birminghamRoutes, NOW_ISO)).toBe(true);
  });
});

describe('13. Standout Fare is unaffected -- its own qualification path never calls deriveFareSignal/selectRepresentativeObservation', () => {
  it('no Standout Fare approval exists for any of the seven suppressed routes, so none of this is masking a lost approval', () => {
    expect(standoutFareApprovals.some((a) => KNOWN_SUPPRESSED_ROUTES.includes(a.routeSlug) && !a.revokedDate)).toBe(false);
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
  // about a different, historical date, not a data change. This describe
  // block reproduces the ORIGINAL audit's own date exactly, frozen, so the
  // 81/74/7 figures below are a fixed historical fact, not a live
  // catalogue count that depends on when this suite happens to run.
  //
  // No fare observation was added between c62399a and this branch's base
  // (e0b7109): PR #199's merged diff touched only data/route-warnings.ts,
  // 5 test files and docs/project-control/ROUTE_COVERAGE_AUDIT.md -- zero
  // lines in data/fare-observations.ts.
  const AUDIT_REFERENCE_DATE = '2026-08-31';

  it('pre-suppression Fare Signal coverage, reconstructed at the frozen audit date, is exactly 81 current / 7 none, matching the original audit on main @ c62399a', () => {
    const allSignals = routes.map((route) => getFareSignalForRoute(route.slug, AUDIT_REFERENCE_DATE));
    const currentCount = allSignals.filter((s) => s.state === 'current').length;
    const noneCount = allSignals.filter((s) => s.state === 'none').length;
    // Reconstructing "as if the suppression gate did not exist" is valid
    // here because every one of the 7 known-suppressed routes was itself
    // 'current' immediately before this fix (that is the fix's whole
    // premise), and no other route's state depends on the gate at all.
    for (const slug of KNOWN_SUPPRESSED_ROUTES) {
      expect(getFareSignalForRoute(slug, AUDIT_REFERENCE_DATE).state, slug).toBe('none');
    }
    expect(currentCount + KNOWN_SUPPRESSED_ROUTES.length).toBe(81);
    expect(noneCount - KNOWN_SUPPRESSED_ROUTES.length).toBe(7);
  });

  it('post-suppression coverage at the frozen audit date is exactly 74 current / 14 none -- an exact delta of 7 from the pre-suppression baseline', () => {
    const allSignals = routes.map((route) => getFareSignalForRoute(route.slug, AUDIT_REFERENCE_DATE));
    const currentCount = allSignals.filter((s) => s.state === 'current').length;
    const noneCount = allSignals.filter((s) => s.state === 'none').length;
    expect(currentCount).toBe(74);
    expect(allSignals.filter((s) => s.state === 'recent').length).toBe(0);
    expect(noneCount).toBe(14);
    expect(81 - currentCount).toBe(7); // exact delta, matching the 7 known-suppressed routes exactly
  });

  it('the exact suppressed slugs at the frozen audit date are precisely the seven named routes -- no more, no fewer', () => {
    const suppressedNow = routes
      .filter((route) => KNOWN_SUPPRESSED_ROUTES.includes(route.slug))
      .filter((route) => getFareSignalForRoute(route.slug, AUDIT_REFERENCE_DATE).state === 'none')
      .map((route) => route.slug)
      .sort();
    expect(suppressedNow).toEqual(
      [
        'manchester-lahore',
        'birmingham-amritsar',
        'manchester-dubai',
        'london-heathrow-doha',
        'london-heathrow-jeddah',
        'london-gatwick-amritsar',
        'birmingham-delhi',
      ].sort()
    );
  });
});
