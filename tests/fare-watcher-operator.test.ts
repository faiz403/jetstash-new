import { describe, expect, it } from 'vitest';
import type { FareObservation } from '@/data/fare-observations';
import { prepareFareWatcherOperatorReport } from '@/lib/fare-watcher-operator';
import type { WeeklyFareEvidenceEntry, WeeklyFareProfile } from '@/lib/weekly-fare-ingest';

const profile: WeeklyFareProfile = {
  observedDate: '2026-09-11',
  departureDate: '2026-11-03',
  returnDate: '2026-11-17',
  observationReason: 'routine-weekly',
};

function observation(id: string, observedDate: string, price: number): FareObservation {
  return {
    id,
    routeSlug: 'manchester-dubai',
    cabin: 'Economy',
    observedDate,
    price,
    priceNote: 'return, per person; baggage not stated',
    source: 'Example Airline',
    observedVia: 'google-flights',
    currency: 'GBP',
    baggage: 'not stated',
    profileId: 'manchester-dubai-economy-operator-v1',
    observationReason: 'routine-weekly',
    comparisonEligibility: 'current',
    departureDate: '2026-11-03',
    returnDate: '2026-11-17',
    fareDirectness: 'direct',
    outboundDirectness: 'direct',
    outboundStops: 0,
    returnDirectness: 'direct',
    returnStops: 0,
  };
}

function entry(overrides: Partial<WeeklyFareEvidenceEntry> = {}): WeeklyFareEvidenceEntry {
  return {
    routeSlug: 'manchester-dubai',
    usable: true,
    fare: 500,
    airline: 'Example Airline',
    outboundDirectness: 'direct',
    outboundStops: 0,
    returnDirectness: 'direct',
    returnStops: 0,
    baggage: 'not stated',
    source: 'google-flights',
    ...overrides,
  };
}

describe('Fare Watcher operator report', () => {
  const baseline = [
    observation('baseline-1', '2026-09-08', 600),
    observation('baseline-2', '2026-09-09', 610),
    observation('baseline-3', '2026-09-10', 620),
  ];

  it('is a dry run that reuses validation, baseline maths and a founder gate', () => {
    const report = prepareFareWatcherOperatorReport([entry()], profile, baseline, ['manchester-dubai']);
    const result = report.entries[0];

    expect(report.dryRun).toBe(true);
    expect(report.completeness).toEqual({ missing: [], unexpected: [] });
    expect(result.validation.status).toBe('VALID');
    expect(result.preparedCode).toContain("routeSlug: 'manchester-dubai'");
    expect(result.qualification).toMatchObject({ baselineMedian: 610, differencePounds: 110, qualification: 'standout-candidate' });
    expect(result.disposition).toBe('founder-review-required');
    expect(result.itineraryEvidenceComplete).toBe(true);
  });

  it('keeps a self-transfer with two stops suppressed even when its price qualifies', () => {
    const report = prepareFareWatcherOperatorReport([
      entry({
        fare: 500,
        airline: 'Multiple airlines',
        outboundDirectness: 'connecting',
        outboundStops: 2,
        outboundConnectionAirports: ['Bergamo (BGY)', 'Bucharest (OTP)'],
        returnDirectness: 'connecting',
        returnStops: 2,
        returnConnectionAirports: ['Istanbul (SAW)', 'Copenhagen (CPH)'],
        evidenceNote: 'self-transfer on both legs; total baggage cost not stated',
      }),
    ], profile, baseline);
    const result = report.entries[0];

    expect(result.qualification?.qualification).toBe('standout-candidate');
    expect(result.selfTransfer).toBe(true);
    expect(result.poorItinerary).toBe(true);
    expect(result.disposition).toBe('suppressed-poor-itinerary');
  });

  it('reports modest movement as ordinary and never turns it into a candidate', () => {
    const report = prepareFareWatcherOperatorReport([entry({ fare: 601 })], profile, baseline);
    const result = report.entries[0];

    expect(result.qualification).toMatchObject({ baselineMedian: 610, differencePounds: 9, qualification: 'ordinary-fare' });
    expect(result.disposition).toBe('ordinary');
  });

  it('does not manufacture a quality conclusion when per-leg stops are absent', () => {
    const report = prepareFareWatcherOperatorReport([
      entry({ outboundStops: undefined, returnStops: undefined }),
    ], profile, baseline);
    const result = report.entries[0];

    expect(result.validation.status).toBe('VALID');
    expect(result.itineraryEvidenceComplete).toBe(false);
    expect(result.poorItinerary).toBeNull();
    expect(result.disposition).toBe('founder-review-required');
  });

  it('fails closed for invalid evidence and does not prepare archive code', () => {
    const report = prepareFareWatcherOperatorReport([
      entry({ baggage: '', fare: undefined }),
    ], profile, baseline);
    const result = report.entries[0];

    expect(result.validation.status).toBe('INVALID');
    expect(result.preparedCode).toBeNull();
    expect(result.qualification).toBeNull();
    expect(result.disposition).toBe('invalid');
  });

  it('rejects stop counts that contradict the observed directness', () => {
    const report = prepareFareWatcherOperatorReport([
      entry({ outboundDirectness: 'direct', outboundStops: 1 }),
    ], profile, baseline);

    expect(report.entries[0].validation.status).toBe('INVALID');
    expect(report.entries[0].validation.issues.some((issue) => issue.field === 'outboundStops')).toBe(true);
  });
});
