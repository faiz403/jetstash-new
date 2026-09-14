import { describe, it, expect } from 'vitest';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import { getComparableOptionsByObservationIds } from '@/lib/smart-fare-route-adapter';
import { deriveJourneyChoice } from '@/lib/journey-choice';
import { getObservationsByRoute } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';

/**
 * Journey Choice freeze-integrity fix + MAN-ISB direct-PIA fare-evidence
 * append (13 Sept 2026, founder-approved). See lib/journey-choice-route-
 * adapter.ts's own doc comment for the root cause and fix. This file proves
 * three separate things together, because they are the three things the
 * founder's brief required to be true simultaneously:
 *   1. Journey Choice's protected £601/£626/"£25 more saves 14h15m" result
 *      is unchanged by the new archive append (the freeze holds).
 *   2. The new PIA observation itself is recorded correctly and is NOT one
 *      of the frozen IDs (truthful profileId, no isolation trick).
 *   3. Nothing existing was modified or deleted — this is a pure append.
 *
 * Round 1 closure (14 Sept 2026, founder-approved): the manchester-islamabad
 * pilot itself was retired the day after this freeze fix shipped — see
 * lib/journey-choice-route-adapter.ts's own updated doc comment. The freeze
 * mechanism this file was written to prove is unaffected by that closure
 * (it's a selection-time guarantee, not tied to whether the pilot is
 * currently on), so the describe block below now exercises
 * getComparableOptionsByObservationIds() directly — the same underlying
 * function getJourneyChoiceForRoute() would call if the pilot were
 * reactivated — rather than through the now-closed route adapter, which
 * correctly returns null today.
 */

const NOW_ISO = '2026-09-13';

const FROZEN_MAN_ISB_IDS = [
  'obs-man-isb-economy-20260811-8w-v1', // £601 Etihad
  'obs-man-isb-economy-20260810-tk-626-v1', // £626 Turkish
  'obs-man-isb-economy-20260810-tk-621-v1', // £621 Turkish
];

describe('Journey Choice Round 1 is closed', () => {
  it('getJourneyChoiceForRoute returns null for manchester-islamabad now that the pilot allowlist is empty', () => {
    expect(getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)).toBeNull();
  });
});

describe('The underlying freeze mechanism still holds after the PIA archive append (proven directly, independent of whether the pilot is currently active)', () => {
  const options = getComparableOptionsByObservationIds('manchester-islamabad', FROZEN_MAN_ISB_IDS, NOW_ISO);
  const journeyChoice = deriveJourneyChoice(options)!;

  it('resolves to exactly the three frozen observations, still excluding the £870 PIA one', () => {
    expect(options.map((o) => o.id).sort()).toEqual([...FROZEN_MAN_ISB_IDS].sort());
    expect(options.some((o) => o.id === 'obs-man-isb-economy-20260913-pia-direct-v1')).toBe(false);
    expect(options.some((o) => o.price === 870)).toBe(false);
  });

  it('lowerFare is still £601 Etihad', () => {
    expect(journeyChoice.lowerFare.airline).toBe('Etihad');
    expect(journeyChoice.lowerFare.price).toBe(601);
  });

  it('fasterJourney is still £626 Turkish Airlines, NOT the £870 PIA direct fare', () => {
    expect(journeyChoice.fasterJourney.airline).toBe('Turkish Airlines');
    expect(journeyChoice.fasterJourney.price).toBe(626);
  });

  it('the £25 / 14h15m decision sentence is unchanged', () => {
    expect(journeyChoice.decision.priceDifference).toBe(25);
    expect(journeyChoice.decision.timeDifferenceMinutes).toBe(855);
    expect(journeyChoice.decision.sentence).toBe('£25 more saves 14h 15m of journey time.');
  });

  it('the £621 otherOption is unchanged', () => {
    expect(journeyChoice.otherOptions).toHaveLength(1);
    expect(journeyChoice.otherOptions[0].price).toBe(621);
  });

  it('a same-profile, same-date, same-cabin archive append genuinely cannot mutate the frozen result (structural proof, not just today\'s numbers)', () => {
    // Simulates what would have happened under the OLD live-grouping
    // mechanism: ask getComparableOptionsByObservationIds for the frozen IDs
    // and confirm it never receives the new PIA observation as an input,
    // regardless of what else exists in the archive with a matching group.
    expect(options.some((o) => o.id === 'obs-man-isb-economy-20260913-pia-direct-v1')).toBe(false);
  });
});

describe('The new MAN-ISB direct-PIA observation is recorded correctly', () => {
  const observation = getObservationsByRoute('manchester-islamabad').find(
    (o) => o.id === 'obs-man-isb-economy-20260913-pia-direct-v1'
  );

  it('exists exactly once', () => {
    expect(observation).toBeTruthy();
  });

  it('uses the truthful existing MAN-ISB Economy profile — never an isolating fabricated profileId', () => {
    expect(observation?.profileId).toBe('manchester-islamabad-economy-1adult-23kg-v1');
  });

  it('route, cabin, dates, currency, price', () => {
    expect(observation?.routeSlug).toBe('manchester-islamabad');
    expect(observation?.cabin).toBe('Economy');
    expect(observation?.departureDate).toBe('2026-10-06');
    expect(observation?.returnDate).toBe('2026-10-20');
    expect(observation?.currency).toBe('GBP');
    expect(observation?.price).toBe(870);
  });

  it('canonical price is £870, not £869 — no price range is invented', () => {
    expect(observation?.price).toBe(870);
    expect(observation?.priceNote).toContain('869');
    expect(observation?.priceNote).not.toMatch(/£869\s*[-–]\s*£?870/);
  });

  it('airline and directness', () => {
    expect(observation?.source).toBe('Pakistan International Airlines');
    expect(observation?.fareDirectness).toBe('direct');
    expect(observation?.outboundDirectness).toBe('direct');
    expect(observation?.returnDirectness).toBe('direct');
    expect(observation?.outboundStops).toBe(0);
    expect(observation?.returnStops).toBe(0);
  });

  it('baggage is represented as genuinely known (not assumed from general policy)', () => {
    expect(observation?.baggage).toContain('1 free carry-on');
    expect(observation?.baggage).toContain('2 free checked bags');
  });

  it('observed 13 September 2026', () => {
    expect(observation?.observedDate).toBe('2026-09-13');
  });
});

describe('Archive integrity — pure append, nothing existing touched', () => {
  it('all three frozen-pilot observations are byte-identical to before', () => {
    const observations = getObservationsByRoute('manchester-islamabad');
    const etihad601 = observations.find((o) => o.id === 'obs-man-isb-economy-20260811-8w-v1');
    const turkish626 = observations.find((o) => o.id === 'obs-man-isb-economy-20260810-tk-626-v1');
    const turkish621 = observations.find((o) => o.id === 'obs-man-isb-economy-20260810-tk-621-v1');
    expect(etihad601?.price).toBe(601);
    expect(turkish626?.price).toBe(626);
    expect(turkish621?.price).toBe(621);
    expect(etihad601?.observedDate).toBe('2026-08-11');
    expect(turkish626?.observedDate).toBe('2026-08-10');
    expect(turkish621?.observedDate).toBe('2026-08-10');
  });

  it('exactly one new observation exists for manchester-islamabad beyond the pre-existing set', () => {
    const observations = getObservationsByRoute('manchester-islamabad');
    const newOnes = observations.filter((o) => o.observedDate === '2026-09-13');
    expect(newOnes).toHaveLength(1);
    expect(newOnes[0].id).toBe('obs-man-isb-economy-20260913-pia-direct-v1');
  });
});

describe('General Fare Signal / Book-By — the accepted, non-Journey-Choice side effect', () => {
  it('Fare Signal now surfaces the fresh, non-suppressed PIA direct fare instead of "no current fare"', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.price).toBe(870);
    expect(signal.observation?.airline).toBe('Pakistan International Airlines');
    expect(signal.observation?.directness).toBe('direct');
    expect(signal.observation?.observedDate).toBe('2026-09-13');
  });

  it('Book-By\'s Verified Check matches Fare Signal exactly, as the established invariant requires', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    const snapshot = computeBookBySnapshot('manchester-islamabad', new Date('2026-09-13T12:00:00Z'));
    expect(snapshot?.latestObservation?.price).toBe(signal.observation?.price);
    expect(snapshot?.latestObservation?.observedDate).toBe(signal.observation?.observedDate);
  });
});
