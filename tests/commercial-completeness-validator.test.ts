import { describe, expect, it } from 'vitest';

import { buildPortfolioAudit, summarizePortfolioAudit } from '@/lib/portfolio-data-quality';

const NOW = '2026-10-04';
const rows = buildPortfolioAudit(NOW);
const summary = summarizePortfolioAudit(rows, NOW);

describe('commercial completeness reporting', () => {
  it('classifies every public route without forcing a fare or affiliate link', () => {
    expect(rows).toHaveLength(89);
    expect(
      summary.trafficReady
      + summary.trafficReadyNonMonetised
      + summary.fareGap
      + summary.evidenceGap
      + summary.hold
    ).toBe(89);
    expect(summary).toMatchObject({
      currentFare: 83,
      noFare: 6,
      monetisedHandoff: 59,
      nonMonetisedFallback: 30,
    });
  });

  it('reports safe fallbacks as non-monetised rather than pretending they are exact affiliate handoffs', () => {
    const fallback = rows.filter((row) => !row.monetised);
    expect(fallback).toHaveLength(30);
    expect(fallback.every((row) => row.commercialHandoffType === 'google-flights')).toBe(true);
    expect(fallback.every((row) => row.exactAirportPreserved === false)).toBe(true);
    expect(fallback.every((row) => row.currentCta === 'Search current flights')).toBe(true);
  });

  it('keeps the six unresolved fares held back at the 4 October boundary and explains each gap', () => {
    const noFare = rows.filter((row) => !row.farePublishable);
    expect(noFare).toHaveLength(6);
    expect(noFare.every((row) => Boolean(row.fareSuppressionReason))).toBe(true);
    expect(noFare.every((row) => row.currentFare === null)).toBe(true);
  });

  it('publishes the rescued connecting fares without labelling ended direct services traffic-ready', () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const row = rows.find((candidate) => candidate.slug === slug);
      expect(row?.serviceEnded).toBe(true);
      expect(row?.commercialReadiness).toBe('HOLD');
      expect(row?.farePublishable).toBe(true);
      expect(row?.currentFareKind).toBe('clean');
    }
  });

  it('keeps every monetised handoff tied to the exact route airport pair', () => {
    const monetised = rows.filter((row) => row.monetised);
    expect(monetised).toHaveLength(59);
    expect(monetised.every((row) => row.exactAirportPreserved)).toBe(true);
  });

  it('joins the settled GSC export onto all 89 routes and marks absent rows explicitly', () => {
    expect(rows.filter((row) => row.gscDataPresent)).toHaveLength(25);
    expect(rows.filter((row) => !row.gscDataPresent)).toHaveLength(64);
    expect(rows.find((row) => row.slug === 'manchester-dubai')?.gscLast28).toMatchObject({
      clicks: 0,
      impressions: 459,
      averagePosition: 43.411765,
    });
    expect(rows.find((row) => row.slug === 'birmingham-amritsar')?.gscLast28).toMatchObject({
      clicks: 0,
      impressions: 0,
      averagePosition: null,
    });
  });

  it('keeps the commercial opportunity score deterministic and readiness-aware', () => {
    const ready = rows.find((row) => row.slug === 'manchester-dubai');
    const evidenceGap = rows.find((row) => row.slug === 'london-gatwick-ahmedabad');
    expect(ready?.organicOpportunityScore).toBe(459);
    expect(evidenceGap?.organicOpportunityScore).toBe(17);
  });
});
