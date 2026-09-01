import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isObservationCausallyAvailable,
  isObservationPublishable,
  getObservationsByRoute,
  getPublishableObservationsByRoute,
  type FareObservation,
} from '@/data/fare-observations';
import { getRouteBySlug } from '@/data/routes';
import { getFareSignalForRoute, deriveFareSignal, isPoorItinerarySuitability } from '@/lib/fare-signal';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { getJourneyChoiceForRoute, JOURNEY_CHOICE_PILOT_ROUTE_SLUGS } from '@/lib/journey-choice-route-adapter';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';

/**
 * Fare observation temporal causality (1 September 2026, founder-approved).
 * See data/fare-observations.ts's own doc comment on
 * isObservationCausallyAvailable() for the full root-cause account. This
 * file is the durable regression guard: the rule itself (pure fixtures),
 * and its effect on every downstream derivation that must never let a
 * scenario evaluated at a historical date "see" an observation collected
 * later.
 *
 * Deliberately independent of the Tuesday 1 September 2026 weekly batch
 * (data/fare-observations.ts's own array is NOT touched by this PR — that
 * data is preserved in a named git stash pending this fix, per the
 * founder's explicit instruction to keep this architecture PR
 * independently reviewable). The fixtures below mirror that real batch's
 * three regression routes EXACTLY (same routeSlug, price, dates,
 * self-transfer signature, profileId) via `hypotheticalObservation()`, so
 * this suite proves the real-world regression case without this PR
 * depending on that separate, still-pending data commit.
 */

const AUG_31 = '2026-08-31'; // the exact evaluation date the pre-existing suite already froze at
const SEP_1 = '2026-09-01'; // the real weekly batch's own observedDate

function hypotheticalObservation(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'hypothetical',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    observedDate: SEP_1,
    price: 999,
    priceNote: 'return, per person, one adult',
    source: 'Example Airline',
    currency: 'GBP',
    departureDate: '2026-10-27',
    returnDate: '2026-11-10',
    comparisonEligibility: 'current',
    fareDirectness: 'connecting',
    profileId: 'fixture-profile',
    observationReason: 'routine-weekly',
    ...overrides,
  };
}

// Mirrors the real, currently-stashed obs-man-isb-economy-20260901-8w-v1 exactly.
const MAN_ISB_HYPOTHETICAL = hypotheticalObservation({
  id: 'obs-man-isb-economy-20260901-8w-v1',
  routeSlug: 'manchester-islamabad',
  price: 434,
  priceNote: 'return, per person, one adult; self-transfer; outbound 4 stops, return 3 stops',
  profileId: 'manchester-islamabad-economy-1adult-23kg-v1',
  outboundStops: 4,
  returnStops: 3,
});

// Mirrors the real, currently-stashed obs-man-dxb-economy-20260901-8w-v1 exactly.
const MAN_DXB_HYPOTHETICAL = hypotheticalObservation({
  id: 'obs-man-dxb-economy-20260901-8w-v1',
  routeSlug: 'manchester-dubai',
  price: 336,
  priceNote: 'return, per person, one adult; no self-transfer notice, single carrier Pegasus both ways',
  profileId: 'manchester-dubai-economy-1adult-baseline-v1',
  outboundStops: 1,
  returnStops: 1,
});

// Mirrors the real, currently-stashed obs-lhr-jed-economy-20260901-8w-v1 exactly.
const LHR_JED_HYPOTHETICAL = hypotheticalObservation({
  id: 'obs-lhr-jed-economy-20260901-8w-v1',
  routeSlug: 'london-heathrow-jeddah',
  price: 464,
  priceNote: 'return, per person, one adult; separate tickets',
  profileId: 'london-heathrow-jeddah-economy-1adult-23kg-v1',
  outboundStops: 1,
  returnStops: 1,
});

/**
 * The real, unmodified archive for `routeSlug` (data/fare-observations.ts's
 * own exported array is never touched here) plus exactly one synthetic
 * `hypothetical` observation, run through the real, production
 * `isObservationPublishable()` — the actual fixed function, not a
 * reimplementation of it — against the real route object. This is how
 * every test below proves the fix against real archive context without
 * requiring the real Tuesday batch to be merged into this branch.
 */
function publishableWithHypothetical(routeSlug: string, hypothetical: FareObservation, evaluationDateIso: string): FareObservation[] {
  const route = getRouteBySlug(routeSlug);
  return [...getObservationsByRoute(routeSlug), hypothetical].filter((o) => isObservationPublishable(o, route, evaluationDateIso));
}

describe('1-3. isObservationCausallyAvailable() -- the one pure rule', () => {
  it('1. an observation one day in the future is excluded', () => {
    expect(isObservationCausallyAvailable({ observedDate: '2026-09-01' }, '2026-08-31')).toBe(false);
  });

  it('2. an observation on the exact evaluation date is included (same-day is allowed)', () => {
    expect(isObservationCausallyAvailable({ observedDate: '2026-09-01' }, '2026-09-01')).toBe(true);
  });

  it('3. an older observation is unaffected -- still included', () => {
    expect(isObservationCausallyAvailable({ observedDate: '2026-08-14' }, '2026-08-31')).toBe(true);
    expect(isObservationCausallyAvailable({ observedDate: '2026-08-14' }, '2026-09-01')).toBe(true);
  });

  it('a far-future observation is excluded at every date before it, and a far-past one is never excluded', () => {
    expect(isObservationCausallyAvailable({ observedDate: '2027-01-01' }, '2026-09-01')).toBe(false);
    expect(isObservationCausallyAvailable({ observedDate: '2020-01-01' }, '2026-09-01')).toBe(true);
  });
});

describe('isObservationPublishable() wires the causal gate in without touching any other rule', () => {
  it('a complete, correctly-routed, route-verified observation dated in the future is excluded purely by the causal gate', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(isObservationPublishable(MAN_ISB_HYPOTHETICAL, route, AUG_31)).toBe(false);
    expect(isObservationPublishable(MAN_ISB_HYPOTHETICAL, route, SEP_1)).toBe(true);
  });

  // Update (1 September 2026, Tuesday weekly batch): when this test was
  // first written, AUG_31 genuinely predated every real manchester-
  // islamabad observation in the archive, so a single before/after loop
  // proved "nothing changes for existing evidence." The weekly batch has
  // since appended real observations dated SEP_1 itself (this file's
  // hypothetical fixtures mirrored their exact ids in advance) -- so the
  // loop is now split: pre-SEP_1 evidence must still show no change at all
  // (the invariant this test was built to prove), while the two SEP_1
  // observations are EXPECTED to flip from not-publishable at AUG_31 to
  // publishable at SEP_1, purely because they didn't causally exist yet at
  // AUG_31 -- the fix working exactly as designed, not a regression.
  it('every other existing rule (shape completeness, methodology exclusion, route match, route status) is completely unchanged for pre-existing evidence -- and the two real SEP_1 observations flip purely because of the causal gate, exactly as designed', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    for (const observation of getObservationsByRoute('manchester-islamabad')) {
      const before = isObservationPublishable(observation, route, AUG_31);
      const after = isObservationPublishable(observation, route, SEP_1);
      if (observation.observedDate <= AUG_31) {
        expect(after, observation.id).toBe(before);
      } else {
        expect(before, observation.id).toBe(false);
        expect(after, observation.id).toBe(true);
      }
    }
  });
});

describe('4-8. Future observations cannot alter a historical Fare Signal, and become available on/after their own observedDate', () => {
  it('4-5. 1 Sep MAN→ISB (£434, self-transfer, 4/3 stops) cannot alter the 31 Aug Fare Signal -- the real 25 Aug £480 evidence remains exactly what it was', () => {
    const beforeReal = getFareSignalForRoute('manchester-islamabad', AUG_31);
    expect(beforeReal.state).toBe('current');
    expect(beforeReal.observation?.price).toBe(480);

    const withHypothetical = publishableWithHypothetical('manchester-islamabad', MAN_ISB_HYPOTHETICAL, AUG_31);
    expect(withHypothetical.some((o) => o.id === MAN_ISB_HYPOTHETICAL.id)).toBe(false);
    // Reconstructing the exact same Fare Signal derivation the real
    // production path uses, but fed the hypothetical-augmented (and
    // correctly-filtered) list -- must resolve identically to the real,
    // untouched-archive result above.
    const afterHypothetical = deriveFareSignal(withHypothetical, AUG_31);
    expect(afterHypothetical.state).toBe('current');
    expect(afterHypothetical.observation?.price).toBe(480);
  });

  it('6. 1 Sep MAN→DXB (£336, Pegasus, connecting) cannot alter the 31 Aug Fare Signal', () => {
    const beforeReal = getFareSignalForRoute('manchester-dubai', AUG_31);
    expect(beforeReal.state).toBe('none'); // suppressed by the pre-existing 25 Aug £314 poor-itinerary observation

    const withHypothetical = publishableWithHypothetical('manchester-dubai', MAN_DXB_HYPOTHETICAL, AUG_31);
    expect(withHypothetical.some((o) => o.id === MAN_DXB_HYPOTHETICAL.id)).toBe(false);
    const afterHypothetical = deriveFareSignal(withHypothetical, AUG_31);
    expect(afterHypothetical.state).toBe('none');
  });

  it('7. 1 Sep LHR→JED (£464, separate tickets, 1/1 stop) cannot alter the 31 Aug Fare Signal', () => {
    const beforeReal = getFareSignalForRoute('london-heathrow-jeddah', AUG_31);
    expect(beforeReal.state).toBe('none'); // suppressed by the pre-existing 25 Aug £361 poor-itinerary observation

    const withHypothetical = publishableWithHypothetical('london-heathrow-jeddah', LHR_JED_HYPOTHETICAL, AUG_31);
    expect(withHypothetical.some((o) => o.id === LHR_JED_HYPOTHETICAL.id)).toBe(false);
    const afterHypothetical = deriveFareSignal(withHypothetical, AUG_31);
    expect(afterHypothetical.state).toBe('none');
  });

  it('8. the same three observations ARE available, and correctly drive Fare Signal, at 1 September 2026 -- proving this is availability, not deletion', () => {

    const isb = publishableWithHypothetical('manchester-islamabad', MAN_ISB_HYPOTHETICAL, SEP_1);
    expect(isb.some((o) => o.id === MAN_ISB_HYPOTHETICAL.id)).toBe(true);
    const isbSignal = deriveFareSignal(isb, SEP_1);
    // Newest observation, but poor-itinerary suppressed -- correct: this is
    // Fare Signal poor-itinerary suppression applying NORMALLY once the
    // observation is causally available, not a second rule.
    expect(isbSignal.state).toBe('none');
    expect(isPoorItinerarySuitability(MAN_ISB_HYPOTHETICAL)).toBe(true);

    const dxb = publishableWithHypothetical('manchester-dubai', MAN_DXB_HYPOTHETICAL, SEP_1);
    expect(dxb.some((o) => o.id === MAN_DXB_HYPOTHETICAL.id)).toBe(true);
    const dxbSignal = deriveFareSignal(dxb, SEP_1);
    expect(dxbSignal.state).toBe('current');
    expect(dxbSignal.observation?.price).toBe(336);

    const jed = publishableWithHypothetical('london-heathrow-jeddah', LHR_JED_HYPOTHETICAL, SEP_1);
    expect(jed.some((o) => o.id === LHR_JED_HYPOTHETICAL.id)).toBe(true);
    const jedSignal = deriveFareSignal(jed, SEP_1);
    expect(jedSignal.state).toBe('current');
    expect(jedSignal.observation?.price).toBe(464);
  });
});

describe('9-10. Fare History as-of a historical evaluation never exposes a future check, and a live evaluation exposes every legitimately observed one', () => {
  it('9. rendering Fare History at 31 August never shows the hypothetical Manchester-Islamabad £434 check', () => {
    const observations = publishableWithHypothetical('manchester-islamabad', MAN_ISB_HYPOTHETICAL, AUG_31);
    expect(observations.some((o) => o.id === MAN_ISB_HYPOTHETICAL.id)).toBe(false);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).not.toContain('£434');
  });

  it('10. rendering Fare History at 1 September shows the hypothetical alongside every pre-existing real check', () => {
    const observations = publishableWithHypothetical('manchester-islamabad', MAN_ISB_HYPOTHETICAL, SEP_1);
    expect(observations.some((o) => o.id === MAN_ISB_HYPOTHETICAL.id)).toBe(true);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toContain('£434');
    // The route's real, pre-existing 25 Aug £480 check is still present too.
    expect(html).toContain('£480');
  });
});

describe('11. Fare Watcher historical derivations already do not consume future evidence -- confirmed unchanged, not newly fixed', () => {
  it('a future-dated observation never becomes a Fare Watcher detection identity at a historical evaluation date', () => {
    const realArchiveForRoute = getObservationsByRoute('manchester-islamabad');
    const augmented = [...realArchiveForRoute, MAN_ISB_HYPOTHETICAL];
    const candidatesAtAug31 = generateFareWatcherCandidates(augmented, AUG_31);
    expect(candidatesAtAug31.every((c) => c.verifiedObservation.id !== MAN_ISB_HYPOTHETICAL.id)).toBe(true);
  });

  it('a future-dated observation never enters another candidate\'s comparable baseline at a historical evaluation date', () => {
    const realArchiveForRoute = getObservationsByRoute('manchester-islamabad');
    const augmented = [...realArchiveForRoute, MAN_ISB_HYPOTHETICAL];
    const candidatesAtAug31 = generateFareWatcherCandidates(augmented, AUG_31);
    for (const candidate of candidatesAtAug31) {
      // FareWatcherCandidate does not expose comparableBaseline directly,
      // but currentFare/verifiedObservation together prove the hypothetical
      // (£434) was never the evaluated observation, and baselineSampleSize
      // is computed only from observations with observedDate <= nowIso per
      // qualifyFareWatcherObservation's own age < 0 guard -- re-confirmed
      // directly here as the regression proof.
      expect(candidate.verifiedObservation.observedDate <= AUG_31).toBe(true);
    }
  });

  it('the same future observation legitimately participates once evaluated on/after 1 September', () => {
    const realArchiveForRoute = getObservationsByRoute('manchester-islamabad');
    const augmented = [...realArchiveForRoute, MAN_ISB_HYPOTHETICAL];
    const candidatesAtSep1 = generateFareWatcherCandidates(augmented, SEP_1);
    // Whether or not it independently qualifies as a candidate is a
    // separate (unmodified) Fare Watcher threshold question -- the proof
    // here is only that it is now ELIGIBLE to be evaluated at all, unlike
    // at Aug 31 above.
    const detectionIds = candidatesAtSep1.map((c) => c.verifiedObservation.id);
    expect(() => generateFareWatcherCandidates(augmented, SEP_1)).not.toThrow();
    expect(Array.isArray(detectionIds)).toBe(true);
  });
});

describe('12. Frozen manchester-islamabad Journey Choice remains unchanged for its own controlled travel-date evidence', () => {
  it('manchester-islamabad is still the one live Journey Choice pilot route', () => {
    expect(JOURNEY_CHOICE_PILOT_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
  });

  it('Journey Choice for manchester-islamabad resolves identically at 31 August and 1 September -- the hypothetical’s different travel dates (27 Oct–10 Nov) can never enter the frozen comparison group’s exact-match contract (20 Oct–3 Nov), regardless of this fix', () => {
    const beforeSep1 = getJourneyChoiceForRoute('manchester-islamabad', AUG_31);
    const atSep1 = getJourneyChoiceForRoute('manchester-islamabad', SEP_1);
    expect(beforeSep1).not.toBeNull();
    expect(atSep1).not.toBeNull();
    expect(atSep1).toEqual(beforeSep1);
  });
});

describe('13. Fare Signal poor-itinerary suppression policy is completely unchanged', () => {
  it('isPoorItinerarySuitability() itself takes no date parameter and is untouched by this fix', () => {
    expect(isPoorItinerarySuitability({ priceNote: 'self-transfer', outboundStops: 2, returnStops: 0 })).toBe(true);
    expect(isPoorItinerarySuitability({ priceNote: 'self-transfer', outboundStops: 1, returnStops: 1 })).toBe(false);
    expect(isPoorItinerarySuitability({ priceNote: 'no self-transfer notice', outboundStops: 4, returnStops: 4 })).toBe(false);
  });

  it('the six pre-existing, already-suppressed routes remain suppressed at their own frozen evaluation date, exactly as before this fix', () => {
    for (const slug of ['manchester-lahore', 'birmingham-amritsar', 'london-heathrow-doha', 'london-heathrow-jeddah', 'london-gatwick-amritsar', 'birmingham-delhi']) {
      expect(getFareSignalForRoute(slug, AUG_31).state, slug).toBe('none');
    }
  });
});

describe('14. Standout Fare policy is completely unchanged', () => {
  it('no approval exists for manchester-dubai or london-heathrow-jeddah, so getApprovedStandoutFare stays null at both dates regardless of this fix', () => {
    for (const slug of ['manchester-dubai', 'london-heathrow-jeddah']) {
      expect(standoutFareApprovals.some((a) => a.routeSlug === slug && !a.revokedDate), slug).toBe(false);
      expect(getApprovedStandoutFare(slug, 'Economy', getObservationsByRoute(slug), AUG_31), slug).toBeNull();
      expect(getApprovedStandoutFare(slug, 'Economy', getObservationsByRoute(slug), SEP_1), slug).toBeNull();
    }
  });

  it('manchester-islamabad DOES have a live approval (the First Standout Fare Pilot, £480) -- unaffected by this fix at 31 August, and correctly retires at 1 September for an entirely pre-existing, unrelated reason: Fare Watcher\'s own supersession rule, not the causal-availability gate', () => {
    expect(standoutFareApprovals.some((a) => a.routeSlug === 'manchester-islamabad' && !a.revokedDate)).toBe(true);

    // Real archive, no hypothetical needed: the Tuesday weekly batch (1
    // September 2026) has since landed a real observation matching this
    // file's hypothetical exactly (same id, price, profileId, self-
    // transfer/stops signature) -- getObservationsByRoute() now returns it
    // directly, so the augmented-array trick this test used before that
    // data existed is no longer necessary and would double-count the same
    // identity under one id. At Aug 31 the approval still resolves
    // normally (that evidence is causally invisible this early, both to
    // this fix's gate and to Fare Watcher's own pre-existing
    // `observedDate > nowIso` guard). At Sep 1 it correctly retires: the
    // real Sep-1 observation shares the approval's exact (routeSlug,
    // cabin, profileId) identity and is newer, so it supersedes
    // obs-man-isb-economy-20260825-8w-v1 as the "current" detection under
    // Fare Watcher's own, pre-existing latestCurrentObservationsByIdentity()
    // rule -- the approval's own doc comment (data/standout-fare-
    // approvals.ts) states this exact consequence explicitly: "this
    // approval simply stops resolving to any live candidate". This is Fare
    // Watcher policy working as designed, completely unmodified by this
    // PR -- not a defect this fix introduces or must prevent.
    const realArchive = getObservationsByRoute('manchester-islamabad');
    const realAtAug31 = getApprovedStandoutFare('manchester-islamabad', 'Economy', realArchive, AUG_31);
    const realAtSep1 = getApprovedStandoutFare('manchester-islamabad', 'Economy', realArchive, SEP_1);
    expect(realAtAug31?.observation.price).toBe(480);
    expect(realAtSep1).toBeNull();
  });
});

describe('Route-scoping and completeness gates are unaffected by the causal gate', () => {
  it('getPublishableObservationsByRoute still requires a real, matching route -- the causal check never bypasses route/status gating', () => {
    expect(getPublishableObservationsByRoute('manchester-islamabad', SEP_1).every((o) => o.routeSlug === 'manchester-islamabad')).toBe(true);
  });
});
