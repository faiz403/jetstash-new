import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FareObservation } from '@/data/fare-observations';
import { fareObservations } from '@/data/fare-observations';
import type { StandoutFareApproval } from '@/data/standout-fare-approvals';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';
import { deriveApprovedStandoutFare, getApprovedStandoutFare } from '@/lib/standout-fare';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import { deriveFareWindowReconciliation } from '@/lib/fare-window-reconciliation';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';

const NOW = '2026-08-25';

/** Same fixture shape/conventions as tests/fare-watcher.test.ts. */
function fixture(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture', routeSlug: 'fixture-route', cabin: 'Economy', observedDate: '2026-08-10',
    price: 500, priceNote: 'return, one adult', source: 'Example', observedVia: 'google-flights',
    sourceUrl: 'https://example.test', currency: 'GBP', baggage: 'not stated', profileId: 'fixture-v1',
    observationReason: 'routine-weekly', comparisonEligibility: 'current', departureDate: '2026-10-05', returnDate: '2026-10-19', fareDirectness: 'connecting',
    ...overrides,
  };
}

/**
 * Same fixed 8-week-horizon/14-night-stay convention as tests/fare-watcher.test.ts
 * and tests/fare-watcher-candidate-supersession.test.ts's own helpers --
 * departureDate/returnDate MUST track observedDate or every baseline fixture
 * falls outside FARE_WATCHER_MAX_HORIZON_DRIFT_DAYS (7 days) of the
 * candidate it's meant to be comparable with.
 */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function baselineFixture(id: string, observedDate: string, price: number): FareObservation {
  const departureDate = addDays(observedDate, 56);
  const returnDate = addDays(departureDate, 14);
  return fixture({ id, observedDate, price, departureDate, returnDate });
}

function approval(overrides: Partial<StandoutFareApproval> = {}): StandoutFareApproval {
  return {
    id: 'standout-fixture',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    detectionObservationId: 'detection',
    approvedVerifiedObservationId: 'recheck',
    approvedDate: '2026-08-10',
    approvedBy: 'founder',
    note: 'test fixture',
    ...overrides,
  };
}

describe('Standout Fare — First Public Standout Fare Pilot', () => {
  it('1 & 2. the approved MAN-ISB candidate renders a Standout state using the exact verified £480 evidence', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    expect(standout).not.toBeNull();
    expect(standout!.observation.id).toBe('obs-man-isb-economy-20260825-recheck-v1');
    expect(standout!.observation.price).toBe(480);
    expect(standout!.observation.airline).toBe('Riyadh Air');
    expect(standout!.observation.isSelfTransfer).toBe(false);
  });

  it('3. the £621 comparable tracked median is derived from Fare Watcher\'s live baseline, not hardcoded', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    expect(standout!.baselineMedian).toBe(621);
    // Proof it's derived, not a literal: change the archive and the median moves with it.
    const inflatedArchive = fareObservations.map((o) =>
      o.routeSlug === 'manchester-islamabad' && o.cabin === 'Economy' && o.comparisonEligibility === 'current' && o.observationReason !== 'emergency-recheck' && o.id !== 'obs-man-isb-economy-20260825-8w-v1'
        ? { ...o, price: o.price + 100 }
        : o
    );
    const movedStandout = getApprovedStandoutFare('manchester-islamabad', 'Economy', inflatedArchive, NOW);
    expect(movedStandout!.baselineMedian).not.toBe(621);
  });

  it('4. the £141 / ~22.7% derivation is correct', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    expect(standout!.differencePounds).toBe(141);
    expect(standout!.differencePercent).toBeCloseTo(22.7, 1);
    expect(standout!.qualification).toBe('standout-candidate');
  });

  it('5. baggage uncertainty remains visible, verbatim from the archive, never rewritten to a £0 or included claim', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    expect(standout!.baggageDetail).toBe('not stated; optional charges and bag fees may apply');
    expect(standout!.baggageDetail.toLowerCase()).not.toContain('included');
    expect(standout!.baggageDetail).not.toContain('£0');
  });

  it('6. a candidate with no founder approval never renders publicly', () => {
    // fixture-route has no entry in data/standout-fare-approvals.ts at all.
    const standout = getApprovedStandoutFare('fixture-route', 'Economy', fareObservations, NOW);
    expect(standout).toBeNull();
  });

  it('7. MAN-LHE was never a Standout Fare, and now shows no current Fare Signal at all (Fare Signal poor-itinerary suppression, 31 Aug 2026) — Standout Fare\'s own qualification logic is untouched and independent, confirmed by standout staying null exactly as before', () => {
    const standout = getApprovedStandoutFare('manchester-lahore', 'Economy', fareObservations, NOW);
    expect(standout).toBeNull();
    const signal = getFareSignalForRoute('manchester-lahore', NOW);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-lahore'), routeSlug: 'manchester-lahore', standoutFare: standout }));
    // Suppressed-fare explanation (2 Sep 2026, traveller-POV live product
    // review): renders the explanatory "Recent fares checked" copy instead
    // of the plain "No current fare tracked" it used to; Standout Fare's
    // own absence is unaffected either way.
    expect(html).toContain('Recent fares checked');
    expect(html).not.toContain('Fare spotted');
    expect(html).not.toContain('Standout Fare');
  });

  it('8. LHR-JED was never a Standout Fare, and now shows no current Fare Signal at all (Fare Signal poor-itinerary suppression, 31 Aug 2026)', () => {
    const standout = getApprovedStandoutFare('london-heathrow-jeddah', 'Economy', fareObservations, NOW);
    expect(standout).toBeNull();
    const signal = getFareSignalForRoute('london-heathrow-jeddah', NOW);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('london-heathrow-jeddah'), routeSlug: 'london-heathrow-jeddah', standoutFare: standout }));
    // Suppressed-fare explanation (2 Sep 2026, traveller-POV live product
    // review): renders the explanatory "Recent fares checked" copy instead
    // of the plain "No current fare tracked" it used to; Standout Fare's
    // own absence is unaffected either way.
    expect(html).toContain('Recent fares checked');
    expect(html).not.toContain('Fare spotted');
    expect(html).not.toContain('Standout Fare');
  });

  it('9. BHX-ATQ was never a Standout Fare, and now shows no current Fare Signal at all (Fare Signal poor-itinerary suppression, 31 Aug 2026)', () => {
    const standout = getApprovedStandoutFare('birmingham-amritsar', 'Economy', fareObservations, NOW);
    expect(standout).toBeNull();
    const signal = getFareSignalForRoute('birmingham-amritsar', NOW);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('birmingham-amritsar'), routeSlug: 'birmingham-amritsar', standoutFare: standout }));
    // Suppressed-fare explanation (2 Sep 2026, traveller-POV live product
    // review): renders the explanatory "Recent fares checked" copy instead
    // of the plain "No current fare tracked" it used to; Standout Fare's
    // own absence is unaffected either way.
    expect(html).toContain('Recent fares checked');
    expect(html).not.toContain('Fare spotted');
    expect(html).not.toContain('Standout Fare');
  });

  it('confirms only one approval exists in the real ledger, and it is MAN-ISB', () => {
    expect(standoutFareApprovals.filter((a) => !a.revokedDate)).toHaveLength(1);
    expect(standoutFareApprovals[0].routeSlug).toBe('manchester-islamabad');
  });

  it('10. a candidate that loses qualification (recheck raises price past the standing thresholds) fails closed', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const recheck = fixture({ id: 'recheck', price: 505, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const baseline = [baselineFixture('a', '2026-07-01', 500), baselineFixture('b', '2026-07-02', 510), baselineFixture('c', '2026-07-03', 520)];
    const observations = [detection, recheck, ...baseline];
    // Sanity: without the recheck, the stale detection price alone would have
    // qualified and rendered (approval points straight at the detection,
    // since that's the observation Fare Watcher would evaluate with no
    // matching recheck present).
    const detectionOnlyApproval = [approval({ approvedVerifiedObservationId: 'detection' })];
    expect(deriveApprovedStandoutFare(detectionOnlyApproval, 'fixture-route', 'Economy', [detection, ...baseline], '2026-08-11')).not.toBeNull();
    // With the recheck present and approved as the evidence, £505 no longer
    // qualifies against the £510 median -- it must fail closed, not fall
    // back to the stale £400 detection price.
    const approvals = [approval({ approvedVerifiedObservationId: 'recheck' })];
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', observations, '2026-08-11')).toBeNull();
  });

  it('11. an approval whose candidate has expired (travel dates already in the past) fails closed under Fare Watcher\'s OWN existing expiry rule', () => {
    const detection = fixture({ id: 'detection', price: 400, departureDate: '2026-01-01', returnDate: '2026-01-15', observedDate: '2025-12-01' });
    const recheck = fixture({ id: 'recheck', price: 400, observationReason: 'emergency-recheck', departureDate: '2026-01-01', returnDate: '2026-01-15', observedDate: '2025-12-01' });
    const baseline = [
      fixture({ id: 'a', observedDate: '2025-11-25', price: 500, departureDate: '2026-01-01', returnDate: '2026-01-15' }),
      fixture({ id: 'b', observedDate: '2025-11-26', price: 510, departureDate: '2026-01-01', returnDate: '2026-01-15' }),
      fixture({ id: 'c', observedDate: '2025-11-27', price: 520, departureDate: '2026-01-01', returnDate: '2026-01-15' }),
    ];
    const observations = [detection, recheck, ...baseline];
    const approvals = [approval({ approvedVerifiedObservationId: 'recheck' })];
    // As of a date before departure, this would have rendered.
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', observations, '2025-12-02')).not.toBeNull();
    // As of a date after the (now past) departure date, it must fail closed.
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', observations, NOW)).toBeNull();
  });

  it('12. an approval whose approved recheck evidence is missing from the archive fails closed rather than falling back to the stale detection price', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const baseline = [baselineFixture('a', '2026-07-01', 500), baselineFixture('b', '2026-07-02', 510), baselineFixture('c', '2026-07-03', 520)];
    // approval references a recheck id that was never appended to the archive.
    const approvals = [approval({ approvedVerifiedObservationId: 'a-recheck-that-does-not-exist' })];
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', [detection, ...baseline], '2026-08-11')).toBeNull();
  });

  it('13. an approval whose exact context (detection id) no longer matches any live candidate fails closed', () => {
    const baseline = [baselineFixture('a', '2026-07-01', 500), baselineFixture('b', '2026-07-02', 510), baselineFixture('c', '2026-07-03', 520)];
    // approval points at a detection id that isn't in the observation set at all.
    const approvals = [approval({ detectionObservationId: 'a-detection-that-was-never-made' })];
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', baseline, '2026-08-11')).toBeNull();
  });

  it('13b. a same-price recheck that arrives with a NEW observation id still fails closed until re-approved -- founder approval is of the exact evidence, not "whatever price appears later"', () => {
    const detection = fixture({ id: 'detection', price: 400, observationReason: 'routine-weekly' });
    const originalRecheck = fixture({ id: 'recheck', price: 400, observationReason: 'emergency-recheck', observedDate: '2026-08-10' });
    const laterRecheck = fixture({ id: 'later-recheck', price: 400, observationReason: 'emergency-recheck', observedDate: '2026-08-12' });
    const baseline = [baselineFixture('a', '2026-07-01', 500), baselineFixture('b', '2026-07-02', 510), baselineFixture('c', '2026-07-03', 520)];
    const approvals = [approval()]; // approvedVerifiedObservationId: 'recheck'
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', [detection, originalRecheck, ...baseline], '2026-08-11')).not.toBeNull();
    // A later recheck (even at the identical price) supersedes 'recheck' as the candidate's verified evidence -- the approval no longer matches it.
    expect(deriveApprovedStandoutFare(approvals, 'fixture-route', 'Economy', [detection, originalRecheck, laterRecheck, ...baseline], '2026-08-13')).toBeNull();
  });

  it('14 & 15. Journey Choice for manchester-islamabad remains exactly the frozen pilot, and the reconciliation sentence still fires', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW);
    expect(journeyChoice).not.toBeNull();
    expect(journeyChoice!.lowerFare).toMatchObject({ price: 601, airline: 'Etihad', departureDate: '2026-10-06', returnDate: '2026-10-20' });
    expect(journeyChoice!.fasterJourney).toMatchObject({ price: 626, airline: 'Turkish Airlines' });
    expect(journeyChoice!.otherOptions[0]).toMatchObject({ price: 621 });
    expect(journeyChoice!.decision.sentence).toBe('£25 more saves 14h 15m of journey time.');

    // The £480 Standout Fare's window (20 Oct-3 Nov) genuinely differs from
    // Journey Choice's own window (6-20 Oct) -- the reconciliation note must
    // still describe them as two different trips, never a saving over
    // Journey Choice's options. Argument order matches the real route page
    // call site exactly: Fare Signal's window first, Journey Choice's second.
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    const reconciliation = deriveFareWindowReconciliation(
      { departureDate: standout!.observation.departureDate, returnDate: standout!.observation.returnDate },
      { departureDate: journeyChoice!.lowerFare.departureDate, returnDate: journeyChoice!.lowerFare.returnDate }
    );
    expect(reconciliation).not.toBeNull();
    expect(reconciliation!.sentence).toContain('These are two different trips.');
    expect(reconciliation!.sentence).not.toMatch(/121|141|cheaper/i);
  });

  it('16. the affiliate URL/IDs for manchester-islamabad are unchanged by this pilot', () => {
    const url = getTripComRouteUrl('manchester-islamabad');
    expect(url).toContain('Allianceid=9804124');
    expect(url).toContain('SID=327450313');
    expect(url).toContain('trip_sub3=D19082296');
  });

  it('17. the rendered Standout state never introduces a baggage-included or guaranteed-saving claim, and avoids the banned superlatives', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    const signal = getFareSignalForRoute('manchester-islamabad', NOW);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-islamabad'), routeSlug: 'manchester-islamabad', standoutFare: standout }));
    expect(html).toContain('Standout Fare');
    expect(html).toContain('£141 below JetStash&#x27;s comparable tracked median of £621.');
    expect(html).toContain('Baggage: not stated; optional charges and bag fees may apply.');
    expect(html.toLowerCase()).not.toMatch(/cheapest|\bbest\b|bargain|amazing deal|guaranteed saving|market average|usual price|baggage included|baggage is included/);
    expect(html).not.toContain('£0');
  });

  it('a route\'s Standout Fare only ever applies to the exact observation Fare Signal is already displaying (id match), never merely by route slug or price', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    const decoy = { ...standout!, observation: { ...standout!.observation, id: 'a-different-observation-id' } };
    const signal = getFareSignalForRoute('manchester-islamabad', NOW);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-islamabad'), routeSlug: 'manchester-islamabad', standoutFare: decoy }));
    expect(html).toContain('Fare spotted');
    expect(html).not.toContain('Standout Fare');
  });

  it('the Standout CTA reuses the existing tripcom_click event, distinguished only by its source property (no new analytics event)', () => {
    const standout = getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW);
    const signal = getFareSignalForRoute('manchester-islamabad', NOW);
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-islamabad'), routeSlug: 'manchester-islamabad', standoutFare: standout }));
    expect(html).toContain('Check current price');
    // TrackedOutboundLink's onClick handler isn't visible in static markup
    // (client-only), so this asserts the actual wiring at the source level
    // -- same convention tests/fare-signal.test.ts already uses (reading
    // componentSrc) for architectural invariants that can't be observed
    // from rendered HTML alone.
    const componentSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    expect(componentSrc).toContain("event=\"tripcom_click\"");
    expect(componentSrc).toContain("standout ? 'fare-signal-standout' : 'fare-signal'");
    expect(componentSrc).not.toContain('journey_choice_standout');
  });
});
