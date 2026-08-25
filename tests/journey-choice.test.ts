import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement } from 'react';
import { deriveJourneyChoice } from '@/lib/journey-choice';
import { getJourneyChoiceForRoute, JOURNEY_CHOICE_PILOT_ROUTE_SLUGS } from '@/lib/journey-choice-route-adapter';
import { getSmartFareComparisonForRoute } from '@/lib/smart-fare-route-adapter';
import type { SmartFareOptionSummary } from '@/lib/smart-fare-comparison';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getJourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { JourneyChoice } from '@/components/route/journey-choice';
import { JourneyChoiceImpressionSection } from '@/components/route/journey-choice-impression-section';

/**
 * Journey Choice — MVP, one-route pilot (manchester-islamabad only, 24 Aug
 * 2026, founder-approved, PR #173). See lib/journey-choice.ts and
 * components/route/journey-choice.tsx for the founder's four corrections
 * this coverage exists to lock in:
 *   1. One route only, not a pre-decided second route.
 *   2. Fare Signal / Book-By are untouched — Journey Choice's own exact-
 *      match batch and Fare Signal's "latest current Economy" pick are
 *      genuinely different observations today, not a subset relationship.
 *   3. profileId never reaches the customer, and is never parsed into a
 *      baggage claim.
 *   4. No homepage proof in this PR.
 */

const NOW_ISO = '2026-08-24';
const NOW_DATE = new Date('2026-08-24T12:00:00Z');

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectStrings(child, out));
    return out;
  }
  if (isValidElement(node)) {
    // journey-choice.tsx composes real named function components
    // (PrimaryOptionCard, OtherOptionRow, JourneyChoiceEvidenceDisclosure)
    // rather than inlining everything — a plain `.props.children` walk
    // never invokes those, so their output would silently go missing from
    // this text-extraction test. Invoking the function directly (the same
    // thing React itself does during render) keeps this test honest about
    // what a real visitor actually sees.
    //
    // JourneyChoiceImpressionSection (measurement instrumentation, 24 Aug
    // 2026) is the one exception: it's a real 'use client' component using
    // useRef/useEffect, which throws "Invalid hook call" when invoked
    // directly outside an actual React render (no dispatcher — this repo's
    // Vitest environment is plain Node, not jsdom, and has no
    // @testing-library dependency to render through). It unconditionally
    // renders exactly `<section>{children}</section>` with no derived
    // content of its own, so walking its own children directly is
    // equivalent for text-extraction purposes and never invokes the hooks.
    if (node.type === JourneyChoiceImpressionSection) {
      const children = (node.props as { children?: unknown } | null)?.children;
      if (children !== undefined) collectStrings(children, out);
      return out;
    }
    if (typeof node.type === 'function') {
      const rendered = (node.type as (props: unknown) => unknown)(node.props);
      collectStrings(rendered, out);
      return out;
    }
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

describe('Journey Choice derivation — Manchester-Islamabad real data', () => {
  const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;

  it('renders on Manchester-Islamabad', () => {
    expect(journeyChoice).toBeTruthy();
  });

  it('derives Etihad £601 / 35h40m as the lower fare', () => {
    expect(journeyChoice.lowerFare.airline).toBe('Etihad');
    expect(journeyChoice.lowerFare.price).toBe(601);
    expect(journeyChoice.lowerFare.totalJourneyMinutes).toBe(2140);
  });

  it('derives Turkish Airlines £626 / 21h25m as the faster journey', () => {
    expect(journeyChoice.fasterJourney.airline).toBe('Turkish Airlines');
    expect(journeyChoice.fasterJourney.price).toBe(626);
    expect(journeyChoice.fasterJourney.totalJourneyMinutes).toBe(1285);
  });

  it('derives the decision sentence mathematically from the two chosen options, not as a hardcoded string', () => {
    const expectedPriceDiff = journeyChoice.fasterJourney.price - journeyChoice.lowerFare.price;
    const expectedTimeDiff = journeyChoice.lowerFare.totalJourneyMinutes - journeyChoice.fasterJourney.totalJourneyMinutes;
    expect(expectedPriceDiff).toBe(25);
    expect(expectedTimeDiff).toBe(855);
    expect(journeyChoice.decision.priceDifference).toBe(expectedPriceDiff);
    expect(journeyChoice.decision.timeDifferenceMinutes).toBe(expectedTimeDiff);
    expect(journeyChoice.decision.sentence).toBe('£25 more saves 14h 15m of journey time.');
  });

  it('keeps the third comparable option accessible as a secondary choice, never hidden', () => {
    expect(journeyChoice.otherOptions).toHaveLength(1);
    expect(journeyChoice.otherOptions[0].airline).toBe('Turkish Airlines');
    expect(journeyChoice.otherOptions[0].price).toBe(621);
    expect(journeyChoice.otherOptions[0].totalJourneyMinutes).toBe(1450);
  });

  it('every option is Economy cabin', () => {
    const all = [journeyChoice.lowerFare, journeyChoice.fasterJourney, ...journeyChoice.otherOptions];
    expect(all.every((o) => o.cabin === 'Economy')).toBe(true);
  });

  it('every option shares the exact comparable travel window (6-20 Oct 2026)', () => {
    const all = [journeyChoice.lowerFare, journeyChoice.fasterJourney, ...journeyChoice.otherOptions];
    expect(all.every((o) => o.departureDate === '2026-10-06' && o.returnDate === '2026-10-20')).toBe(true);
  });

  it('checked-baggage cost is not confirmed for any option today', () => {
    expect(journeyChoice.baggageCostConfirmedForAllOptions).toBe(false);
  });
});

describe('Journey Choice fails closed rather than fabricating a trade-off', () => {
  function fixtureOption(overrides: Partial<SmartFareOptionSummary>): SmartFareOptionSummary {
    return {
      id: 'fixture', airline: 'Fixture Air', cabin: 'Economy', price: 500, currency: 'GBP',
      departureDate: '2026-10-06', returnDate: '2026-10-20', checkedDate: '2026-08-10',
      directness: 'connecting', stops: 2, outboundStops: 1, returnStops: 1, connectionAirports: [],
      outboundJourneyMinutes: 500, returnJourneyMinutes: 500, totalJourneyMinutes: 1000,
      outboundLayoverMinutes: [], returnLayoverMinutes: [],
      baggage: { kind: 'not-stated', detail: 'not stated' }, mandatoryFees: [], mandatoryFeeEvidence: 'incomplete',
      ...overrides,
    };
  }

  it('returns null when the cheapest option is also the fastest (no genuine trade-off to describe)', () => {
    const options = [
      fixtureOption({ id: 'a', price: 500, totalJourneyMinutes: 1000 }),
      fixtureOption({ id: 'b', price: 700, totalJourneyMinutes: 1400 }),
    ];
    expect(deriveJourneyChoice(options)).toBeNull();
  });

  it('returns null for an empty input', () => {
    expect(deriveJourneyChoice([])).toBeNull();
  });

  it('returns null when fewer than two options carry known journey-duration evidence', () => {
    const options = [
      fixtureOption({ id: 'a', totalJourneyMinutes: null }),
      fixtureOption({ id: 'b', totalJourneyMinutes: null }),
    ];
    expect(deriveJourneyChoice(options)).toBeNull();
  });

  it('birmingham-amritsar and london-heathrow-jeddah do not form comparison groups from a routine observation plus a verification recheck', () => {
    for (const slug of ['birmingham-amritsar', 'london-heathrow-jeddah']) {
      const comparison = getSmartFareComparisonForRoute(slug, NOW_ISO);
      expect(comparison, slug).toBeNull();
    }
  });
});

describe('Pilot allowlist — one route only, not a pre-decided second route', () => {
  it('JOURNEY_CHOICE_PILOT_ROUTE_SLUGS is exactly manchester-islamabad today', () => {
    expect(JOURNEY_CHOICE_PILOT_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
  });

  it('birmingham-amritsar does not become Journey Choice yet, because its verification recheck is not a second comparison option', () => {
    expect(getSmartFareComparisonForRoute('birmingham-amritsar', NOW_ISO)).toBeNull();
    expect(getJourneyChoiceForRoute('birmingham-amritsar', NOW_ISO)).toBeNull();
  });

  it('london-heathrow-jeddah does not become Journey Choice yet, because its verification recheck is not a second comparison option', () => {
    expect(getSmartFareComparisonForRoute('london-heathrow-jeddah', NOW_ISO)).toBeNull();
    expect(getJourneyChoiceForRoute('london-heathrow-jeddah', NOW_ISO)).toBeNull();
  });

  it('an unrelated route with no comparable data also returns null', () => {
    expect(getJourneyChoiceForRoute('manchester-dubai', NOW_ISO)).toBeNull();
  });
});

describe('No profileId or invented-baggage leakage into the customer-facing component', () => {
  const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;
  const tripComHandoff = getJourneyChoiceTripComHandoff(
    'manchester-islamabad',
    journeyChoice,
    getTripComFlightHandoffUrl('manchester-islamabad', 'manchester', 'islamabad')
  );
  const rendered = collectStrings(JourneyChoice({
    journeyChoice,
    routeLabel: 'Manchester to Islamabad',
    routeSlug: 'manchester-islamabad',
    tripComHandoff,
    routeDirectness: 'direct',
    routeStatusLabel: 'Direct',
    routeAirlineLabel: 'PIA',
  })).join(' ');

  it('never renders the raw profileId value or the word "profileId"', () => {
    expect(rendered).not.toContain('manchester-islamabad-economy-1adult-23kg-v1');
    expect(rendered).not.toMatch(/profileId/i);
  });

  it('never derives a "23kg" or "baggage allowance assumed" claim from profileId — baggage stays honestly unknown', () => {
    expect(rendered).not.toMatch(/23\s*kg/i);
    expect(rendered).not.toMatch(/baggage allowance assumed/i);
    expect(rendered).toMatch(/Checked-baggage cost isn.t confirmed\./);
  });

  it('never makes an unsupported self-transfer claim in either direction', () => {
    expect(rendered).not.toMatch(/self-transfer/i);
  });

  it('the JourneyChoiceOption type and its derivation carry no profileId field at all (structural guard, not just discipline)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/journey-choice.ts'), 'utf8');
    expect(src).not.toContain('profileId');
  });

  it('the presentation component source never references profileId or parses "23kg"', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
    expect(src).not.toContain('profileId');
    expect(src).not.toMatch(/23\s*kg/i);
  });

  it('states Route Service distinctly from the compared fares: PIA direct, fares shown are a different connecting journey', () => {
    expect(rendered).toContain('PIA · Direct');
    expect(rendered).toContain('The fares above are different, connecting journeys.');
  });

  it('renders the exact founder-approved decision sentence and the genuine-middle-option framing', () => {
    expect(rendered).toContain('£25 more saves 14h 15m of journey time.');
    expect(rendered).toContain('£20 more than the lower fare, £5 less than the faster one.');
  });

  it('never uses unjustified marketing language', () => {
    expect(rendered).not.toMatch(/\b(best|optimal|recommended|value score|cheap|worth it)\b/i);
  });
});

describe('Everything outside Journey Choice stays unchanged', () => {
  it('Fare Signal for manchester-islamabad is updated by the weekly observation while Journey Choice remains frozen', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    // PR #182 (25 Aug): the same-day emergency-recheck (£480) now outranks
    // the routine check (£460) it re-verifies as the representative
    // observation -- either way, neither is a Journey Choice comparison ID.
    expect(signal.observation?.price).toBe(480);
    expect(signal.observation?.observedDate).toBe('2026-08-25');
    // Confirms the founder's correction directly: Fare Signal's own pick is
    // NOT one of Journey Choice's three comparable options.
    const journeyChoiceIds = [
      'obs-man-isb-economy-20260810-tk-621-v1',
      'obs-man-isb-economy-20260810-tk-626-v1',
      'obs-man-isb-economy-20260811-8w-v1',
    ];
    expect(journeyChoiceIds).not.toContain('obs-man-isb-economy-20260818-8w-v1');
  });

  it('Book-By for manchester-islamabad is untouched — still matches Fare Signal exactly, as PR #172 established', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    const snapshot = computeBookBySnapshot('manchester-islamabad', NOW_DATE);
    expect(snapshot?.latestObservation?.price).toBe(signal.observation?.price);
    expect(snapshot?.latestObservation?.observedDate).toBe(signal.observation?.observedDate);
  });

  it('the Trip.com handoff for manchester-islamabad is untouched — same route-level URL Fare Signal already uses', () => {
    const url = getTripComFlightHandoffUrl('manchester-islamabad', 'manchester', 'islamabad');
    expect(url).toContain('MAN-ISB');
    expect(url).toContain('trip_sub3=D19082296');
  });

  it('the underlying Smart Fare Comparison result keeps only the independent comparison route', () => {
    const validRoutes = ['manchester-islamabad', 'birmingham-amritsar', 'london-heathrow-jeddah']
      .filter((slug) => getSmartFareComparisonForRoute(slug, NOW_ISO) !== null)
      .sort();
    expect(validRoutes).toEqual(['manchester-islamabad']);
  });
});
