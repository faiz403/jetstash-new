import { describe, expect, it } from 'vitest';
import { routes } from '@/data/routes';
import { getFareRangeSummary } from '@/data/fare-observations';
import type { DealCabin } from '@/data/deals';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getHomepageEvidenceExample } from '@/lib/homepage-evidence';
import {
  daysBetweenIso,
  meetsPromotedDepartureLeadTime,
  MIN_PROMOTED_DEPARTURE_LEAD_DAYS,
  PROMOTED_DEPARTURE_GUARD_START_DATE,
  PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS,
} from '@/lib/freshness-thresholds';
import { FARE_EVIDENCE_DATE } from './fare-evidence-clock';

/**
 * Departure expiry (3 November 2026). Every fare published until now departed on 17 November 2026,
 * and at midnight on 3 November the 15-day departure guard stopped promoting all of them at once.
 * That was the guard working. These tests keep it that way: the rule itself is unchanged, the
 * boundary falls on the right day, and on real data no surface promotes a fare that departs
 * inside the guard. Several date-sensitive suites now evaluate the data on FARE_EVIDENCE_DATE
 * (tests/fare-evidence-clock.ts); this file proves what happens the day after.
 */

const LEAD = MIN_PROMOTED_DEPARTURE_LEAD_DAYS + PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS;
const DAY_AFTER = '2026-11-03';
const CABINS: DealCabin[] = ['Economy', 'Premium Economy', 'Business'];

describe('the 15-day departure guard is unchanged', () => {
  it('is still 14 days plus a 1-day safety margin, applied from 17 October 2026', () => {
    expect(MIN_PROMOTED_DEPARTURE_LEAD_DAYS).toBe(14);
    expect(PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS).toBe(1);
    expect(PROMOTED_DEPARTURE_GUARD_START_DATE).toBe('2026-10-17');
  });

  it('promotes a 17 November departure on 2 November and stops on 3 November', () => {
    expect(meetsPromotedDepartureLeadTime('2026-11-17', '2026-11-02')).toBe(true);
    expect(meetsPromotedDepartureLeadTime('2026-11-17', '2026-11-03')).toBe(false);
    expect(meetsPromotedDepartureLeadTime('2026-11-17', '2026-11-17')).toBe(false);
    expect(meetsPromotedDepartureLeadTime('2026-11-01', '2026-11-03')).toBe(false);
  });

  it('never promotes a fare with no departure date', () => {
    expect(meetsPromotedDepartureLeadTime(undefined, DAY_AFTER)).toBe(false);
  });
});

describe('real data: nothing departing inside the guard is promoted', () => {
  it('the pinned evaluation day is the last day the 17 November evidence was eligible', () => {
    expect(daysBetweenIso(FARE_EVIDENCE_DATE, '2026-11-17')).toBe(LEAD);
  });

  it('17 November evidence that was current on 2 November is no longer promoted on 3 November', () => {
    const currentOnEvidenceDate = routes
      .map((route) => ({ slug: route.slug, signal: getFareSignalForRoute(route.slug, FARE_EVIDENCE_DATE) }))
      .filter(({ signal }) => signal.state === 'current' && signal.observation?.departureDate === '2026-11-17');
    // Not vacuous: dozens of routes relied on this evidence.
    expect(currentOnEvidenceDate.length).toBeGreaterThan(30);
    for (const { slug, signal } of currentOnEvidenceDate) {
      const next = getFareSignalForRoute(slug, DAY_AFTER);
      expect(next.observation?.id, slug).not.toBe(signal.observation!.id);
    }
  });

  for (const day of [DAY_AFTER, '2026-11-10', '2026-12-01']) {
    it(`on ${day}, every Fare Signal headline and self-transfer line departs at least ${LEAD} days later`, () => {
      for (const route of routes) {
        const signal = getFareSignalForRoute(route.slug, day);
        for (const observation of [signal.observation, signal.lowerSelfTransfer]) {
          if (!observation || signal.state === 'none') continue;
          expect(daysBetweenIso(day, observation.departureDate), `${route.slug} ${observation.id}`).toBeGreaterThanOrEqual(LEAD);
        }
      }
    });

    it(`on ${day}, no deal-card range is set by a fare departing inside the guard`, () => {
      for (const route of routes) {
        for (const cabin of CABINS) {
          const summary = getFareRangeSummary(route.slug, cabin, day);
          if (!summary) continue;
          expect(daysBetweenIso(day, summary.departureDate), `${route.slug} ${cabin}`).toBeGreaterThanOrEqual(LEAD);
        }
      }
    });

    it(`on ${day}, the homepage evidence example never shows a fare departing inside the guard`, () => {
      const example = getHomepageEvidenceExample(day);
      if (example?.kind !== 'fare') return;
      expect(daysBetweenIso(day, example.fare.departureDate)).toBeGreaterThanOrEqual(LEAD);
    });
  }
});
