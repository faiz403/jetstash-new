import { describe, expect, it } from 'vitest';
import { fareObservations } from '@/data/fare-observations';
import { deriveSmartFareComparison, type SmartFareOption } from '@/lib/smart-fare-comparison';
import { deriveTripValueVerdict } from '@/lib/trip-value-verdict';

const observed = fareObservations.filter(
  (observation) => observation.routeSlug === 'manchester-islamabad' && observation.observedDate === '2026-08-10'
);

function toSmartOption(observation: typeof observed[number]): SmartFareOption {
  return {
    id: observation.id,
    airline: observation.source,
    cabin: observation.cabin,
    price: observation.price,
    currency: 'GBP',
    departureDate: observation.departureDate!,
    returnDate: observation.returnDate!,
    checkedDate: observation.observedDate,
    directness: observation.fareDirectness!,
    stops: (observation.outboundStops ?? 0) + (observation.returnStops ?? 0),
    outboundStops: observation.outboundStops ?? null,
    returnStops: observation.returnStops ?? null,
    connectionAirports: [...new Set([
      ...(observation.outboundConnectionAirports ?? []),
      ...(observation.returnConnectionAirports ?? []),
    ])],
    outboundJourneyMinutes: observation.outboundJourneyMinutes ?? null,
    returnJourneyMinutes: observation.returnJourneyMinutes ?? null,
    outboundLayoverMinutes: observation.outboundLayoverMinutes ?? [],
    returnLayoverMinutes: observation.returnLayoverMinutes ?? [],
    baggage: {
      kind: 'extra-charge-unknown',
      detail: observation.baggage ?? 'not stated',
    },
    mandatoryFees: [],
    mandatoryFeeEvidence: 'incomplete',
  };
}

describe('Smart Fare Comparison', () => {
  it('derives the factual £5 / 2h45m difference from the two Turkish observations', () => {
    const comparison = deriveSmartFareComparison(observed.slice(0, 2).map(toSmartOption));

    expect(comparison.options.map((option) => option.totalJourneyMinutes)).toEqual([1450, 1285]);
    expect(comparison.pairStatements).toContainEqual(expect.objectContaining({
      kind: 'price-time',
      text: '£5 more saves 2h 45m of total journey time.',
    }));
    expect(comparison.statements).toContain('Turkish Airlines: checked baggage costs extra, but the amount was not shown.');
    expect(comparison.totalCostComparisonReady).toBe(false);
  });

  it('reports stops, connection airports and layover facts without naming a winner', () => {
    const comparison = deriveSmartFareComparison(observed.map(toSmartOption));

    expect(comparison.options[0]).toMatchObject({
      directness: 'connecting',
      stops: 2,
      connectionAirports: ['Istanbul Airport (IST)', 'Istanbul (IST)'],
      outboundLayoverMinutes: [230],
      returnLayoverMinutes: [60],
    });
    expect(comparison.statements).toContain('Turkish Airlines has a shorter outbound connection (1h 10m versus 3h 40m).');
    expect(comparison.pairStatements.filter((statement) => statement.kind === 'connection')).not.toHaveLength(0);
    expect(comparison.statements.join('\n')).not.toMatch(/\b(best|cheapest|better value|worth it|savings|recommended)\b/i);
  });

  it('supports known baggage fees and mandatory fees as explicit facts', () => {
    const comparison = deriveSmartFareComparison([
      {
        ...toSmartOption(observed[0]),
        baggage: { kind: 'extra-charge-known', fee: 45, detail: 'first checked bag fee shown' },
        mandatoryFees: [{ label: 'required airport fee', amount: 12, currency: 'GBP' }],
        mandatoryFeeEvidence: 'complete',
      },
      {
        ...toSmartOption(observed[1]),
        baggage: { kind: 'included', detail: 'first checked bag shown as included' },
        mandatoryFeeEvidence: 'complete',
      },
    ]);

    expect(comparison.totalCostComparisonReady).toBe(true);
    expect(comparison.statements).toContain('Turkish Airlines: checked baggage costs an additional £45.');
    expect(comparison.statements).toContain('Turkish Airlines: mandatory required airport fee is £12.');
  });

  it('does not weaken True Trip Cost when the same real options have unknown baggage fees', () => {
    const result = deriveTripValueVerdict(observed.slice(0, 2).map((observation) => ({
      id: observation.id,
      price: observation.price,
      baggage: { included: false, fee: null },
      totalJourneyMinutes: (observation.outboundJourneyMinutes ?? 0) + (observation.returnJourneyMinutes ?? 0),
      stops: (observation.outboundStops ?? 0) + (observation.returnStops ?? 0),
    })));

    expect(result.kind).toBe('insufficient-evidence');
    expect(result.optionId).toBeNull();
    expect(result.totalCost).toBeNull();
  });
});
